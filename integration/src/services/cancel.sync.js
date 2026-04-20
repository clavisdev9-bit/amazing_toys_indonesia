'use strict';

const odoo = require('../clients/odoo.client');
const sos = require('../clients/sos.client');
const xref = require('../utils/xref');
const audit = require('../utils/audit');
const logger = require('../config/logger');

/**
 * FR-006: Cancel Odoo draft order for a SOS CANCELLED/EXPIRED transaction.
 */
async function cancelOrder(transactionId) {
  const entry = await xref.getXref('order', transactionId);
  if (!entry || !entry.odoo_id) {
    logger.info('Cancel sync: no Odoo order found in xref (normal for fast-expiring)', { transactionId });
    audit.log({ operation_type: 'CANCEL_SYNC', sos_entity_id: transactionId, action: 'SKIP', status: 'SUCCESS', request_summary: 'No xref entry' });
    return;
  }

  const odooOrderId = entry.odoo_id;

  let orders;
  try {
    orders = await odoo.searchRead('sale.order', [['id', '=', odooOrderId]], ['id', 'state']);
  } catch (err) {
    logger.error('Cancel sync: failed to fetch Odoo order state', { transactionId, odooOrderId, error: err.message });
    return;
  }

  const order = orders[0];
  if (!order) {
    logger.info('Cancel sync: Odoo order not found', { transactionId, odooOrderId });
    await xref.markXrefCancelled('order', transactionId);
    return;
  }

  if (order.state === 'cancel') {
    logger.info('Cancel sync: already cancelled in Odoo', { transactionId, odooOrderId });
    await xref.markXrefCancelled('order', transactionId);
    return;
  }

  if (order.state === 'sale') {
    logger.error('Cancel sync: CRITICAL — confirmed order cannot be auto-cancelled', { transactionId, odooOrderId });
    audit.log({ operation_type: 'CANCEL_SYNC', sos_entity_id: transactionId, odoo_entity_id: odooOrderId, action: 'FAIL', status: 'FAILED', error_message: 'Order already confirmed — manual resolution required' });
    return;
  }

  // state === 'draft' — cancel it
  try {
    await odoo.execute('sale.order', 'action_cancel', [odooOrderId]);
    await xref.markXrefCancelled('order', transactionId);
    audit.log({ operation_type: 'CANCEL_SYNC', sos_entity_id: transactionId, odoo_entity_id: odooOrderId, action: 'CANCEL', status: 'SUCCESS' });
    logger.info('Cancel sync: Odoo order cancelled', { transactionId, odooOrderId });
  } catch (err) {
    logger.error('Cancel sync: action_cancel failed', { transactionId, odooOrderId, error: err.message });
    audit.log({ operation_type: 'CANCEL_SYNC', sos_entity_id: transactionId, odoo_entity_id: odooOrderId, action: 'FAIL', status: 'FAILED', error_message: err.message });
  }
}

/**
 * FR-006: Sweep SOS for EXPIRED transactions and cancel matching Odoo draft orders.
 *
 * NOTE: Uses /admin/transactions?status=EXPIRED which returns only EXPIRED rows.
 * The old /cashier/transactions endpoint is cashier-scoped and always returns PAID —
 * using it caused PAID orders to be incorrectly cancelled in Odoo (bug fix).
 */
async function sweepExpired() {
  logger.info('Expiry sweep: running');
  let txns;
  try {
    const data = await sos.get('/admin/transactions?status=EXPIRED&limit=200');
    const raw  = data.data ?? data;
    txns = Array.isArray(raw) ? raw : (raw.items ?? raw.transactions ?? []);
  } catch (err) {
    logger.error('Expiry sweep: failed to fetch EXPIRED transactions', { error: err.message });
    return;
  }

  // Safety guard: only process transactions explicitly in EXPIRED state.
  // This prevents false-positives if the endpoint returns mixed statuses.
  const expired = txns.filter(t => t.status === 'EXPIRED');

  for (const txn of expired) {
    const entry = await xref.getXref('order', txn.transaction_id);
    if (!entry || entry.status === 'CANCELLED') continue;
    await cancelOrder(txn.transaction_id);
  }

  logger.info('Expiry sweep: complete', { checked: txns.length, expired: expired.length });
}

module.exports = { cancelOrder, sweepExpired };
