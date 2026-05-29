'use strict';

/**
 * Payment Voucher Service — FR-PV-001
 *
 * After order.push.js confirms a sale.order, this service completes the
 * Odoo accounting chain:
 *   [B] Create invoice  (sale.order → account.move out_invoice)
 *   [C] Post invoice    (draft → posted)
 *   [D] Register payment + reconcile (account.payment → reconcile to invoice)
 *
 * Step [A] (confirm SO) is handled by order.push.js; this service only
 * verifies the SO is in state=sale before proceeding.
 *
 * Idempotency: voucher_status column on integration_xref drives resume logic.
 *   PENDING    → run B, C, D
 *   CONFIRMED  → run B, C, D
 *   INVOICED   → run C, D  (invoice already created)
 *   PAID       → skip all  (already done)
 *   FAILED     → re-run from last checkpoint on manual retry
 */

const odoo      = require('../clients/odoo.client');
const sos       = require('../clients/sos.client');
const { query } = require('../config/database');
const retryQ    = require('../queue/retry.queue');
const cb        = require('../utils/circuit.breaker');
const audit     = require('../utils/audit');
const logger    = require('../config/logger');

const TXN_ID_REGEX = /^TXN-[0-9]{8}-[0-9]{5}$/;

// Voucher lifecycle states
const VS = {
  PENDING:   'PENDING',
  CONFIRMED: 'CONFIRMED',
  INVOICED:  'INVOICED',
  PAID:      'PAID',
  FAILED:    'FAILED',
};

// ── DB helpers ────────────────────────────────────────────────────────────────

async function _getState(transactionId) {
  const r = await query(
    `SELECT odoo_id, odoo_invoice_id, odoo_payment_id, voucher_status
     FROM integration_xref
     WHERE entity_type = 'order' AND sos_id = $1`,
    [transactionId],
  );
  return r.rows[0] || null;
}

async function _patch(transactionId, fields) {
  const sets = [];
  const vals = [];
  let i = 1;
  if (fields.voucher_status  !== undefined) { sets.push(`voucher_status  = $${i++}`); vals.push(fields.voucher_status); }
  if (fields.odoo_invoice_id !== undefined) { sets.push(`odoo_invoice_id = $${i++}`); vals.push(fields.odoo_invoice_id); }
  if (fields.odoo_payment_id !== undefined) { sets.push(`odoo_payment_id = $${i++}`); vals.push(fields.odoo_payment_id); }
  sets.push(`voucher_synced_at = NOW()`);
  vals.push(transactionId);
  if (!sets.length) return;
  await query(
    `UPDATE integration_xref SET ${sets.join(', ')}
     WHERE entity_type = 'order' AND sos_id = $${i}`,
    vals,
  );
}

// ── Journal mapping ───────────────────────────────────────────────────────────

async function _getJournalId(paymentMethod) {
  try {
    const r = await query(
      "SELECT value FROM system_settings WHERE key = 'integration_config'",
    );
    if (r.rows[0]?.value) {
      let cfg = r.rows[0].value;
      if (typeof cfg === 'string') cfg = JSON.parse(cfg);
      const map = cfg.odoo_payment_journals;
      if (map && map[paymentMethod]) return parseInt(map[paymentMethod], 10);
    }
  } catch (_) { /* fall through */ }
  return null;
}

// ── Public entry point ────────────────────────────────────────────────────────

async function pushPaymentVoucher(transactionId) {
  if (!TXN_ID_REGEX.test(transactionId)) {
    logger.error('PaymentVoucher: invalid transactionId', { transactionId });
    return { success: false, error: 'Invalid transactionId format' };
  }
  try {
    return await _doPushVoucher(transactionId);
  } catch (err) {
    logger.error('PaymentVoucher: unexpected error — re-queuing', { transactionId, error: err.message });
    retryQ.enqueue({ type: 'PAYMENT_VOUCHER', id: transactionId, payload: { transactionId } });
    return { success: false, error: err.message };
  }
}

// ── Core logic ────────────────────────────────────────────────────────────────

async function _doPushVoucher(transactionId) {
  if (cb.isOpen('odoo')) {
    logger.warn('PaymentVoucher: circuit breaker open — re-queuing', { transactionId });
    retryQ.enqueue({ type: 'PAYMENT_VOUCHER', id: transactionId, payload: { transactionId } });
    return { success: false, error: 'Odoo circuit breaker open' };
  }

  // ── Idempotency: read current state ─────────────────────────────────────────
  const state = await _getState(transactionId);

  if (!state?.odoo_id) {
    // SO push not yet complete; retry later
    logger.warn('PaymentVoucher: xref/odoo_id not found — SO push may be in flight, re-queuing', { transactionId });
    retryQ.enqueue({ type: 'PAYMENT_VOUCHER', id: transactionId, payload: { transactionId } });
    return { success: false, error: 'SO xref not ready' };
  }

  if (state.voucher_status === VS.PAID) {
    logger.info('PaymentVoucher: already PAID — skip', { transactionId });
    return { success: true, odoo_invoice_id: state.odoo_invoice_id, odoo_payment_id: state.odoo_payment_id };
  }

  const soId     = state.odoo_id;
  const startAt  = Date.now();

  // ── Fetch SOS transaction ────────────────────────────────────────────────────
  let txn;
  try {
    const data = await sos.get(`/orders/${transactionId}`);
    txn = data.data || data.transaction || data;
    cb.recordSuccess('sos');
  } catch (err) {
    cb.recordFailure('sos');
    logger.error('PaymentVoucher: SOS fetch failed — re-queuing', { transactionId, error: err.message });
    retryQ.enqueue({ type: 'PAYMENT_VOUCHER', id: transactionId, payload: { transactionId } });
    return { success: false, error: `SOS fetch: ${err.message}` };
  }

  const totalAmount   = parseFloat(txn.total_amount   ?? 0);
  const paymentMethod = (txn.payment_method ?? 'CASH').toUpperCase();
  const paidAtDate    = (txn.paid_at ?? new Date().toISOString()).slice(0, 10);

  // ── [A-check] Verify SO confirmed; read partner_id ──────────────────────────
  let odooPartnerId;
  if (!state.voucher_status || state.voucher_status === VS.PENDING || state.voucher_status === VS.FAILED) {
    try {
      const orders = await odoo.searchRead(
        'sale.order', [['id', '=', soId]], ['id', 'state', 'partner_id'],
      );
      const order = orders[0];
      if (!order) {
        // SO deleted or never existed — terminal failure, no point retrying.
        logger.error('PaymentVoucher: [A] SO not found in Odoo — marking FAILED', { transactionId, soId });
        await _patch(transactionId, { voucher_status: VS.FAILED }).catch(() => {});
        return { success: false, error: `SO id=${soId} not found in Odoo` };
      }

      odooPartnerId = Array.isArray(order.partner_id) ? order.partner_id[0] : order.partner_id;

      if (order.state !== 'sale' && order.state !== 'done') {
        logger.warn('PaymentVoucher: SO not confirmed yet — re-queuing', { transactionId, soId, soState: order.state });
        retryQ.enqueue({ type: 'PAYMENT_VOUCHER', id: transactionId, payload: { transactionId } });
        return { success: false, error: `SO state=${order.state}` };
      }

      await _patch(transactionId, { voucher_status: VS.CONFIRMED });
      cb.recordSuccess('odoo');
      logger.info('PaymentVoucher: [A] SO confirmed', { transactionId, soId });
    } catch (err) {
      cb.recordFailure('odoo');
      logger.error('PaymentVoucher: [A] verify SO failed — re-queuing', { transactionId, soId, error: err.message });
      retryQ.enqueue({ type: 'PAYMENT_VOUCHER', id: transactionId, payload: { transactionId } });
      return { success: false, error: `[A] verify SO: ${err.message}` };
    }
  }

  // Re-read partner from SO if we skipped the [A] block
  if (!odooPartnerId) {
    try {
      const orders = await odoo.searchRead('sale.order', [['id', '=', soId]], ['partner_id']);
      const o = orders[0];
      odooPartnerId = Array.isArray(o?.partner_id) ? o.partner_id[0] : o?.partner_id;
    } catch (_) { /* non-fatal; payment.create will fail with a clear error if missing */ }
  }

  // ── [B] Create invoice ───────────────────────────────────────────────────────
  let invoiceId = state.odoo_invoice_id;

  if (!invoiceId) {
    try {
      // Always search by SO relationship first — invoice_origin may be SO name, not TXN ID
      const existing = await odoo.searchRead(
        'account.move',
        [['line_ids.sale_line_ids.order_id', '=', soId], ['move_type', '=', 'out_invoice'], ['state', '!=', 'cancel']],
        ['id', 'state', 'payment_state'],
      );

      if (existing.length) {
        invoiceId = existing[0].id;
        logger.info('PaymentVoucher: [B] invoice already exists', { transactionId, soId, invoiceId });
      } else {
        // Create via sale.advance.payment.inv wizard (Odoo 18 public API)
        const wizardId = await odoo.create('sale.advance.payment.inv', {
          advance_payment_method: 'delivered',
          sale_order_ids: [[6, 0, [soId]]],
        });
        cb.recordSuccess('odoo');

        const action = await odoo.callKw(
          'sale.advance.payment.inv', 'create_invoices', [[wizardId]],
          { context: { active_ids: [soId], active_model: 'sale.order' } },
        );
        cb.recordSuccess('odoo');

        // action.res_id is the newly created invoice ID
        if (action?.res_id) {
          invoiceId = action.res_id;
        } else {
          // Fallback: search again by SO link
          const created = await odoo.searchRead(
            'account.move',
            [['line_ids.sale_line_ids.order_id', '=', soId], ['move_type', '=', 'out_invoice'], ['state', '!=', 'cancel']],
            ['id', 'state'],
          );
          if (!created.length) throw new Error('Invoice not found after wizard create_invoices');
          invoiceId = created[0].id;
        }

        logger.info('PaymentVoucher: [B] invoice created via wizard', { transactionId, soId, invoiceId });
      }

      await _patch(transactionId, { odoo_invoice_id: invoiceId, voucher_status: VS.INVOICED });
    } catch (err) {
      cb.recordFailure('odoo');
      logger.error('PaymentVoucher: [B] create invoice failed', { transactionId, error: err.message });
      await _patch(transactionId, { voucher_status: VS.FAILED }).catch(() => {});
      retryQ.enqueue({ type: 'PAYMENT_VOUCHER', id: transactionId, payload: { transactionId } });
      return { success: false, error: `[B] create invoice: ${err.message}` };
    }
  }

  // ── [C] Post invoice ─────────────────────────────────────────────────────────
  try {
    const moves = await odoo.searchRead(
      'account.move', [['id', '=', invoiceId]], ['state', 'payment_state'],
    );
    const move = moves[0];

    if (move?.payment_state === 'paid' || move?.payment_state === 'in_payment') {
      // Already reconciled — short-circuit
      await _patch(transactionId, { voucher_status: VS.PAID });
      logger.info('PaymentVoucher: [C] invoice already paid — DONE', { transactionId, invoiceId });
      return { success: true, odoo_invoice_id: invoiceId, odoo_payment_id: state.odoo_payment_id };
    }

    if (move?.state === 'draft') {
      await odoo.execute('account.move', 'action_post', [invoiceId]);
      cb.recordSuccess('odoo');
      logger.info('PaymentVoucher: [C] invoice posted', { transactionId, invoiceId });
    } else {
      logger.info('PaymentVoucher: [C] invoice already posted', { transactionId, invoiceId, state: move?.state });
    }
  } catch (err) {
    cb.recordFailure('odoo');
    logger.error('PaymentVoucher: [C] post invoice failed', { transactionId, invoiceId, error: err.message });
    retryQ.enqueue({ type: 'PAYMENT_VOUCHER', id: transactionId, payload: { transactionId } });
    return { success: false, error: `[C] post invoice: ${err.message}` };
  }

  // ── [D] Register payment + reconcile ─────────────────────────────────────────
  const journalId = await _getJournalId(paymentMethod);
  if (!journalId) {
    const msg = `Journal not configured for ${paymentMethod}. Set via Admin → Integrasi → Odoo Payment Journals.`;
    logger.error(`PaymentVoucher: [D] ${msg}`, { transactionId });
    await _patch(transactionId, { voucher_status: VS.FAILED }).catch(() => {});
    return { success: false, error: msg };
  }

  const cache      = odoo.getCache();
  const currencyId = cache.currencyIdIdr || null;

  // Use account.payment.register wizard — Odoo 18 recommended approach:
  // creates + posts + reconciles the payment in one call.
  // Always check invoice payment_state first (idempotency), regardless of cached odoo_payment_id.
  let paymentId = state.odoo_payment_id;
  try {
    const invoiceData = await odoo.searchRead(
      'account.move',
      [['id', '=', invoiceId]],
      ['payment_state', 'reconciled_payment_ids'],
    );
    const invState = invoiceData[0];

    if (invState?.payment_state === 'paid' || invState?.payment_state === 'in_payment') {
      const reconPayments = invState.reconciled_payment_ids || [];
      paymentId = reconPayments[0] || paymentId || 0;
      logger.info('PaymentVoucher: [D] invoice already has payment — skip wizard', { transactionId, invoiceId, paymentId });
    } else {
      // Create wizard — creates + posts + reconciles in one step (Odoo 18 pattern)
      const wizardId = await odoo.callKw(
        'account.payment.register', 'create',
        [{ journal_id: journalId, payment_date: paidAtDate, communication: transactionId }],
        { context: { active_ids: [invoiceId], active_model: 'account.move', active_id: invoiceId } },
      );
      cb.recordSuccess('odoo');

      const action = await odoo.callKw(
        'account.payment.register', 'action_create_payments',
        [[wizardId]],
        { context: { active_ids: [invoiceId], active_model: 'account.move' } },
      );
      cb.recordSuccess('odoo');

      paymentId = action?.res_id || paymentId || 0;
      logger.info('PaymentVoucher: [D] payment registered via wizard', { transactionId, invoiceId, paymentId });
    }

    await _patch(transactionId, { odoo_payment_id: paymentId });
  } catch (err) {
    cb.recordFailure('odoo');
    logger.error('PaymentVoucher: [D] register payment failed', { transactionId, error: err.message });
    retryQ.enqueue({ type: 'PAYMENT_VOUCHER', id: transactionId, payload: { transactionId } });
    return { success: false, error: `[D] register payment: ${err.message}` };
  }

  // ── Verify final state ────────────────────────────────────────────────────────
  // paid       = fully reconciled (cash journal)
  // in_payment = payment registered, pending bank statement (bank journal) — acceptable
  try {
    const final = await odoo.searchRead(
      'account.move', [['id', '=', invoiceId]], ['state', 'payment_state', 'amount_residual'],
    );
    const ps = final[0]?.payment_state;
    logger.info('PaymentVoucher: final state', {
      transactionId, invoiceId, paymentId,
      state:          final[0]?.state,
      paymentState:   ps,
      amountResidual: final[0]?.amount_residual,
    });
    if (ps !== 'paid' && ps !== 'in_payment') {
      logger.warn('PaymentVoucher: unexpected payment_state — marking PAID anyway', { transactionId, paymentState: ps });
    }
  } catch (_) { /* non-fatal */ }

  await _patch(transactionId, { voucher_status: VS.PAID });
  audit.log({
    operation_type: 'PAYMENT_VOUCHER',
    sos_entity_id:  transactionId,
    odoo_entity_id: invoiceId,
    action:         'CREATE',
    status:         'SUCCESS',
    duration_ms:    Date.now() - startAt,
  });
  logger.info('PaymentVoucher: complete', {
    transactionId, soId, invoiceId, paymentId,
    durationMs: Date.now() - startAt,
  });
  return { success: true, odoo_invoice_id: invoiceId, odoo_payment_id: paymentId };
}

module.exports = { pushPaymentVoucher };
