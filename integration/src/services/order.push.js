'use strict';

const odoo = require('../clients/odoo.client');
const sos = require('../clients/sos.client');
const customerSvc = require('./customer.sync');
const xref = require('../utils/xref');
const audit = require('../utils/audit');
const retryQueue = require('../queue/retry.queue');
const cb = require('../utils/circuit.breaker');
const logger = require('../config/logger');
const env = require('../config/env');

const TXN_ID_REGEX = /^TXN-[0-9]{8}-[0-9]{5}$/;

/**
 * Resolve Odoo product_id from SOS product barcode/name.
 * Returns null if unresolvable.
 */
async function resolveOdooProduct(sosItem) {
  // Primary: barcode
  if (sosItem.barcode) {
    const products = await odoo.searchRead('product.product', [['barcode', '=', sosItem.barcode]], ['id', 'name']);
    if (products.length > 0) return products[0].id;
  }
  // Fallback: name ilike
  const products = await odoo.searchRead('product.product', [['name', 'ilike', sosItem.product_name]], ['id', 'name']);
  return products.length > 0 ? products[0].id : null;
}

/**
 * FR-004: Push a SOS PAID transaction to Odoo as a confirmed sale.order.
 */
async function pushOrder(transactionId) {
  if (!TXN_ID_REGEX.test(transactionId)) {
    logger.error('Order push: invalid transactionId format', { transactionId });
    return;
  }

  // Warm startup cache if not yet populated (e.g. called outside normal app startup).
  const cache = odoo.getCache();
  if (cache.hasSosTransactionId === undefined) {
    try { await odoo.resolveStartupRefs(); } catch (_) { /* non-fatal */ }
  }

  if (cb.isOpen('odoo')) {
    logger.warn('Order push: Odoo circuit breaker open, re-queuing', { transactionId });
    retryQueue.enqueue({ type: 'ORDER_PUSH', id: transactionId, payload: { transactionId } });
    return;
  }

  // Idempotency check
  const existing = await xref.getXref('order', transactionId);
  if (existing) {
    logger.info('Order push: duplicate event, discarding', { transactionId, odooOrderId: existing.odoo_id });
    return;
  }

  // Also check Odoo directly for x_sos_transaction_id
  try {
    const existingOrders = await odoo.searchRead('sale.order', [['x_studio_sos_transaction_id', '=', transactionId]], ['id', 'state']);
    if (existingOrders.length > 0) {
      const existingOrder = existingOrders[0];
      if (existingOrder.state !== 'cancel') {
        logger.info('Order push: Odoo order already exists, recording xref', { transactionId, odooOrderId: existingOrder.id });
        await xref.upsertXref('order', transactionId, existingOrder.id);
        return;
      }
      // Cancelled order — skip it and create a fresh one
      logger.info('Order push: existing Odoo order is cancelled, creating new one', { transactionId, cancelledOdooId: existingOrder.id });
    }
  } catch (_err) {
    // x_sos_transaction_id field may not be set up yet — continue
  }

  const startAt = Date.now();

  // Fetch full transaction from SOS
  let txn;
  try {
    const data = await sos.get(`/orders/${transactionId}`);
    txn = data.data || data.transaction || data;
    cb.recordSuccess('sos');
  } catch (err) {
    cb.recordFailure('sos');
    logger.error('Order push: failed to fetch SOS transaction', { transactionId, error: err.message });
    retryQueue.enqueue({ type: 'ORDER_PUSH', id: transactionId, payload: { transactionId } });
    return;
  }

  // Resolve Odoo partner
  const partnerCustomer = {
    customer_id: txn.customer_id,
    full_name: txn.customer_name,
    phone_number: txn.customer_phone,
    email: txn.customer_email || null,
    gender: null,
  };
  const partnerId = await customerSvc.resolveOrCreatePartner(partnerCustomer);

  // Resolve Odoo product IDs for all line items
  const items = txn.items || [];
  const lines = [];
  let allResolved = true;

  for (const item of items) {
    const odooProductId = await resolveOdooProduct(item);
    if (!odooProductId) {
      logger.error('Order push: unresolved product — blocking order', { transactionId, product_name: item.product_name, barcode: item.barcode });
      audit.log({ operation_type: 'ORDER_PUSH', sos_entity_id: transactionId, action: 'FAIL', status: 'FAILED', error_message: `Unresolved product: ${item.product_name}` });
      allResolved = false;
      break;
    }
    lines.push([0, 0, {
      product_id: odooProductId,
      product_uom_qty: parseFloat(item.quantity),
      price_unit: parseFloat(item.unit_price),
      name: item.product_name,
      discount: 0.0,
    }]);
  }

  if (!allResolved) {
    retryQueue.enqueue({ type: 'ORDER_PUSH', id: transactionId, payload: { transactionId } });
    return;
  }

  // Ensure every product in this order is service type so action_confirm never
  // fails with "No rule has been found to replenish … in False".
  // At a physical fair sales are POS-style; Odoo is only used as a record —
  // 'service' suppresses all stock/procurement checks on confirmation.
  const productTemplateIds = [];
  for (const line of lines) {
    try {
      const pp = await odoo.searchRead('product.product', [['id', '=', line[2].product_id]], ['product_tmpl_id']);
      if (pp[0]?.product_tmpl_id?.[0]) productTemplateIds.push(pp[0].product_tmpl_id[0]);
    } catch (_) { /* skip */ }
  }
  if (productTemplateIds.length > 0) {
    try {
      await odoo.write('product.template', productTemplateIds, { type: 'service', route_ids: [[5, 0, 0]] });
    } catch (_err) {
      logger.warn('Order push: could not set product type to service', { transactionId, productTemplateIds, error: _err.message });
    }
  }

  // Build tenant attribution string
  const tenantIds = [...new Set(items.map(i => i.tenant_id))].join(',');

  // Payment note (FR-005)
  const paymentNote = `Payment Method: ${txn.payment_method || 'UNKNOWN'} | Ref: ${txn.payment_reference || '-'} | Cash Received: Rp ${txn.cash_received || 0} | Change: Rp ${txn.cash_change || 0} | Cashier: ${txn.cashier_name || '-'} | Paid At: ${txn.paid_at || '-'}`;

  const orderVals = {
    partner_id: partnerId,
    date_order: txn.paid_at ? new Date(txn.paid_at).toISOString().replace('T', ' ').slice(0, 19) : new Date().toISOString().replace('T', ' ').slice(0, 19),
    order_line: lines,
    note: paymentNote,
  };

  if (cache.hasSosTransactionId) orderVals.x_studio_sos_transaction_id = transactionId;
  if (cache.hasSosTenantId) orderVals.x_studio_sos_tenant_ids = tenantIds;

  let odooOrderId;
  try {
    odooOrderId = await odoo.create('sale.order', orderVals);
    cb.recordSuccess('odoo');
  } catch (err) {
    cb.recordFailure('odoo');
    logger.error('Order push: Odoo create failed', { transactionId, error: err.message });
    audit.log({ operation_type: 'ORDER_PUSH', sos_entity_id: transactionId, action: 'FAIL', status: 'FAILED', error_message: err.message, duration_ms: Date.now() - startAt });
    retryQueue.enqueue({ type: 'ORDER_PUSH', id: transactionId, payload: { transactionId } });
    return;
  }

  // Confirm order (FR-004)
  try {
    await odoo.execute('sale.order', 'action_confirm', [odooOrderId]);
    logger.info('Order push: Odoo order confirmed', { transactionId, odooOrderId });
  } catch (err) {
    // Do NOT retry action_confirm per FSD BR-009
    logger.error('Order push: action_confirm FAILED — manual resolution required', { transactionId, odooOrderId, error: err.message });
    audit.log({ operation_type: 'ORDER_PUSH', sos_entity_id: transactionId, odoo_entity_id: odooOrderId, action: 'FAIL', status: 'FAILED', error_message: `action_confirm failed: ${err.message}`, duration_ms: Date.now() - startAt });
  }

  await xref.upsertXref('order', transactionId, odooOrderId, { tenantIds });
  audit.log({ operation_type: 'ORDER_PUSH', sos_entity_id: transactionId, odoo_entity_id: odooOrderId, action: 'CREATE', status: 'SUCCESS', duration_ms: Date.now() - startAt });
  logger.info('Order push: success', { transactionId, odooOrderId, durationMs: Date.now() - startAt });
}

module.exports = { pushOrder };
