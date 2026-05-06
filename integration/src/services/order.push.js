'use strict';

const odoo = require('../clients/odoo.client');
const sos = require('../clients/sos.client');
const customerSvc = require('./customer.sync');
const xref = require('../utils/xref');
const audit = require('../utils/audit');
const retryQueue = require('../queue/retry.queue');
const cb = require('../utils/circuit.breaker');
const logger = require('../config/logger');

const TXN_ID_REGEX = /^TXN-[0-9]{8}-[0-9]{5}$/;

const toOdooDatetime = (iso) =>
  new Date(iso || undefined).toISOString().replace('T', ' ').slice(0, 19);

/**
 * Resolve Odoo product.product id for a SOS order line item.
 * Strategy (in order):
 *   1. product_odoo_id (template ID from SOS products table) → find the variant
 *   2. barcode lookup on product.product
 *   3. name ilike lookup on product.product
 * Returns null if unresolvable; throws if Odoo is unreachable.
 */
async function resolveOdooProduct(sosItem) {
  if (sosItem.product_odoo_id) {
    const variants = await odoo.searchRead(
      'product.product',
      [['product_tmpl_id', '=', sosItem.product_odoo_id]],
      ['id', 'name']
    );
    if (variants.length > 0) return variants[0].id;
  }
  if (sosItem.barcode) {
    const products = await odoo.searchRead(
      'product.product',
      [['barcode', '=', sosItem.barcode]],
      ['id', 'name']
    );
    if (products.length > 0) return products[0].id;
  }
  const products = await odoo.searchRead(
    'product.product',
    [['name', 'ilike', sosItem.product_name]],
    ['id', 'name']
  );
  return products.length > 0 ? products[0].id : null;
}

/**
 * FR-004: Push a SOS PAID transaction to Odoo as a confirmed, locked sale.order.
 * Returns { success: bool, odoo_order_id: int|null, error: string|null }.
 *
 * Any unhandled exception is caught at the top level and re-queued for retry
 * so no transaction is ever silently dropped.
 */
async function pushOrder(transactionId) {
  if (!TXN_ID_REGEX.test(transactionId)) {
    logger.error('Order push: invalid transactionId format', { transactionId });
    return { success: false, odoo_order_id: null, error: 'Invalid transactionId format' };
  }

  try {
    return await _doPushOrder(transactionId);
  } catch (err) {
    logger.error('Order push: unexpected error — re-queuing for retry', {
      transactionId,
      error: err.message,
      stack: err.stack,
    });
    retryQueue.enqueue({ type: 'ORDER_PUSH', id: transactionId, payload: { transactionId } });
    return { success: false, odoo_order_id: null, error: err.message };
  }
}

async function _doPushOrder(transactionId) {
  // Warm startup cache (currency ID, custom field availability).
  const cache = odoo.getCache();
  if (cache.hasSosTransactionId === undefined) {
    try {
      await odoo.resolveStartupRefs();
    } catch (err) {
      logger.error('Order push: Odoo startup refs failed — custom fields and idempotency check disabled. Verify Odoo credentials.', {
        transactionId,
        error: err.message,
      });
    }
  }
  if (!cache.hasSosTransactionId) {
    logger.warn('Order push: x_studio_sos_transaction_id not found in Odoo — idempotency check disabled, duplicate orders possible on retry', { transactionId });
  }

  if (cb.isOpen('odoo')) {
    logger.warn('Order push: Odoo circuit breaker open — re-queuing', { transactionId });
    retryQueue.enqueue({ type: 'ORDER_PUSH', id: transactionId, payload: { transactionId } });
    return { success: false, odoo_order_id: null, error: 'Odoo circuit breaker open' };
  }

  // ── Idempotency: local xref ──────────────────────────────────────────────────
  const existing = await xref.getXref('order', transactionId);
  if (existing) {
    // If a previous attempt created the order but action_confirm failed, re-attempt confirmation.
    if (existing.sync_metadata?.confirmFailed && existing.odoo_id) {
      logger.warn('Order push: previous attempt left order unconfirmed — re-attempting confirmation', {
        transactionId,
        odooOrderId: existing.odoo_id,
      });
      return _reConfirmOrder(transactionId, existing.odoo_id, existing.sync_metadata);
    }
    logger.info('Order push: duplicate event discarded', { transactionId, odooOrderId: existing.odoo_id });
    return { success: true, odoo_order_id: existing.odoo_id, error: null };
  }

  // ── Idempotency: check Odoo directly via x_studio field ─────────────────────
  try {
    const existingOrders = await odoo.searchRead(
      'sale.order',
      [['x_studio_sos_transaction_id', '=', transactionId]],
      ['id', 'state']
    );
    if (existingOrders.length > 0) {
      const existingOrder = existingOrders[0];
      if (existingOrder.state !== 'cancel') {
        logger.info('Order push: Odoo order already exists — recording xref', {
          transactionId,
          odooOrderId: existingOrder.id,
        });
        await xref.upsertXref('order', transactionId, existingOrder.id);
        return { success: true, odoo_order_id: existingOrder.id, error: null };
      }
      logger.info('Order push: existing Odoo order is cancelled — will create a new one', {
        transactionId,
        cancelledOdooId: existingOrder.id,
      });
    }
  } catch (err) {
    logger.warn('Order push: Odoo idempotency check failed — proceeding without it', {
      transactionId,
      error: err.message,
    });
  }

  const startAt = Date.now();

  // ── Fetch full transaction from SOS ──────────────────────────────────────────
  let txn;
  try {
    const data = await sos.get(`/orders/${transactionId}`);
    txn = data.data || data.transaction || data;
    cb.recordSuccess('sos');
  } catch (err) {
    cb.recordFailure('sos');
    logger.error('Order push: SOS transaction fetch failed', { transactionId, error: err.message });
    retryQueue.enqueue({ type: 'ORDER_PUSH', id: transactionId, payload: { transactionId } });
    return { success: false, odoo_order_id: null, error: `SOS fetch failed: ${err.message}` };
  }

  // ── Resolve Odoo partner ─────────────────────────────────────────────────────
  const partnerId = await customerSvc.resolveOrCreatePartner({
    customer_id: txn.customer_id,
    full_name: txn.customer_name,
    phone_number: txn.customer_phone,
    email: txn.customer_email || null,
    gender: null,
  });

  // ── Resolve Odoo product IDs for all line items ──────────────────────────────
  const items = txn.items || [];
  const lines = [];

  for (const item of items) {
    let odooProductId;
    try {
      odooProductId = await resolveOdooProduct(item);
      cb.recordSuccess('odoo');
    } catch (err) {
      cb.recordFailure('odoo');
      logger.error('Order push: Odoo product lookup failed — re-queuing', {
        transactionId,
        product_name: item.product_name,
        error: err.message,
      });
      retryQueue.enqueue({ type: 'ORDER_PUSH', id: transactionId, payload: { transactionId } });
      return { success: false, odoo_order_id: null, error: `Product lookup failed: ${err.message}` };
    }

    if (!odooProductId) {
      logger.error('Order push: product not found in Odoo — blocking order', {
        transactionId,
        product_name: item.product_name,
        barcode: item.barcode,
      });
      audit.log({
        operation_type: 'ORDER_PUSH',
        sos_entity_id: transactionId,
        action: 'FAIL',
        status: 'FAILED',
        error_message: `Unresolved product: ${item.product_name}`,
      });
      retryQueue.enqueue({ type: 'ORDER_PUSH', id: transactionId, payload: { transactionId } });
      return { success: false, odoo_order_id: null, error: `Unresolved product in Odoo: ${item.product_name}` };
    }

    lines.push([0, 0, {
      product_id: odooProductId,
      product_uom_qty: parseFloat(item.quantity),
      price_unit: parseFloat(item.unit_price),
      name: item.product_name,
      discount: 0.0,
    }]);
  }

  // ── Build order values ───────────────────────────────────────────────────────
  const tenantIdList = [...new Set(items.map(i => i.tenant_id).filter(Boolean))];
  const tenantIds    = tenantIdList.join(',');

  // Payment details captured in note (FR-005).
  const paymentNote = [
    `Payment Method: ${txn.payment_method || 'UNKNOWN'}`,
    `Ref: ${txn.payment_reference || '-'}`,
    `Cash Received: Rp ${txn.cash_received || 0}`,
    `Change: Rp ${txn.cash_change || 0}`,
    `Cashier: ${txn.cashier_name || '-'}`,
    `Paid At: ${txn.paid_at || '-'}`,
  ].join(' | ');

  const dateOrder = toOdooDatetime(txn.paid_at);

  const orderVals = {
    partner_id: partnerId,
    origin: transactionId,
    date_order: dateOrder,
    order_line: lines,
    note: paymentNote,
  };

  // warehouse_id is required for action_confirm to resolve delivery routes.
  if (cache.warehouseId) orderVals.warehouse_id = cache.warehouseId;
  if (cache.hasSosTransactionId) orderVals.x_studio_sos_transaction_id = transactionId;
  if (cache.hasSosTenantId) {
    if (cache.tenantIdFieldType === 'many2many') {
      const odooTenantIds = [];
      for (const tid of tenantIdList) {
        const odooId = await xref.getOdooIdBySosId('tenant', tid);
        if (odooId) {
          odooTenantIds.push(odooId);
        } else {
          logger.warn('Order push: no Odoo xref for tenant — skipping tenant field entry', { transactionId, tenantId: tid });
        }
      }
      if (odooTenantIds.length > 0) {
        orderVals.x_studio_sos_tenant_ids = [[6, 0, odooTenantIds]];
      }
    } else {
      orderVals.x_studio_sos_tenant_ids = tenantIds;
    }
  }

  // ── Step 1: Create draft sale.order (Quotation) ──────────────────────────────
  let odooOrderId;
  try {
    odooOrderId = await odoo.create('sale.order', orderVals);
    cb.recordSuccess('odoo');
    logger.info('Order push: sale.order created (draft/quotation)', { transactionId, odooOrderId });
  } catch (err) {
    cb.recordFailure('odoo');
    logger.error('Order push: sale.order create failed', { transactionId, error: err.message });
    audit.log({
      operation_type: 'ORDER_PUSH',
      sos_entity_id: transactionId,
      action: 'FAIL',
      status: 'FAILED',
      error_message: err.message,
      duration_ms: Date.now() - startAt,
    });
    retryQueue.enqueue({ type: 'ORDER_PUSH', id: transactionId, payload: { transactionId } });
    return { success: false, odoo_order_id: null, error: `Create failed: ${err.message}` };
  }

  // ── Step 2: Confirm → state = 'sale' ────────────────────────────────────────
  try {
    await odoo.execute('sale.order', 'action_confirm', [odooOrderId]);
    logger.info('Order push: order confirmed (state=sale)', { transactionId, odooOrderId });
  } catch (err) {
    const isRouteError = err.message.includes('No rule has been found to replenish');
    if (isRouteError && cache.fallbackRouteId) {
      // Route misconfiguration: set a fallback route on all order lines and retry confirm once.
      try {
        const orderLines = await odoo.searchRead(
          'sale.order.line', [['order_id', '=', odooOrderId]], ['id']
        );
        const lineIds = orderLines.map(l => l.id);
        if (lineIds.length > 0) {
          await odoo.write('sale.order.line', lineIds, { route_id: cache.fallbackRouteId });
        }
        await odoo.execute('sale.order', 'action_confirm', [odooOrderId]);
        logger.info('Order push: order confirmed after applying fallback route', {
          transactionId, odooOrderId, fallbackRouteId: cache.fallbackRouteId,
        });
        // Confirmed — fall through to lock step.
      } catch (retryErr) {
        logger.error('Order push: action_confirm failed even after fallback route fix', {
          transactionId, odooOrderId, error: retryErr.message,
        });
        audit.log({
          operation_type: 'ORDER_PUSH',
          sos_entity_id: transactionId,
          odoo_entity_id: odooOrderId,
          action: 'FAIL',
          status: 'FAILED',
          error_message: `action_confirm failed (route+fallback): ${retryErr.message}`,
          duration_ms: Date.now() - startAt,
        });
        await xref.upsertXref('order', transactionId, odooOrderId, { tenantIds, confirmFailed: true });
        return { success: false, odoo_order_id: odooOrderId, error: `action_confirm failed: ${retryErr.message}` };
      }
    } else {
      logger.error('Order push: action_confirm FAILED — manual resolution required', {
        transactionId, odooOrderId, error: err.message,
      });
      audit.log({
        operation_type: 'ORDER_PUSH',
        sos_entity_id: transactionId,
        odoo_entity_id: odooOrderId,
        action: 'FAIL',
        status: 'FAILED',
        error_message: `action_confirm failed: ${err.message}`,
        duration_ms: Date.now() - startAt,
      });
      await xref.upsertXref('order', transactionId, odooOrderId, { tenantIds, confirmFailed: true });
      return { success: false, odoo_order_id: odooOrderId, error: `action_confirm failed: ${err.message}` };
    }
  }

  // ── Step 3: Lock order → locked = true ──────────────────────────────────────
  try {
    await odoo.execute('sale.order', 'action_lock', [odooOrderId]);
    logger.info('Order push: order locked', { transactionId, odooOrderId });
  } catch (err) {
    // Non-fatal: order is confirmed (state=sale) but could not be locked.
    // Log for manual review; do not roll back.
    logger.warn('Order push: action_lock failed — order confirmed but not locked', {
      transactionId,
      odooOrderId,
      error: err.message,
    });
  }

  // ── Step 4: Verify delivery order auto-creation ──────────────────────────────
  // Odoo creates stock.picking automatically after action_confirm for storable products.
  // If picking_ids is empty, the product type is likely 'service' or routes are missing.
  try {
    const orders = await odoo.searchRead(
      'sale.order',
      [['id', '=', odooOrderId]],
      ['id', 'state', 'locked', 'picking_ids']
    );
    const order = orders[0];
    if (order) {
      const pickingCount = Array.isArray(order.picking_ids) ? order.picking_ids.length : 0;
      if (pickingCount === 0) {
        logger.warn(
          'Order push: no delivery order created — verify product type is "product" (storable) and warehouse has outgoing routes',
          { transactionId, odooOrderId }
        );
      } else {
        logger.info('Order push: delivery order(s) created', { transactionId, odooOrderId, pickingCount });
      }
    }
  } catch (_err) {
    // Non-fatal verification — delivery creation is handled by Odoo procurement.
  }

  // ── Finalise ─────────────────────────────────────────────────────────────────
  await xref.upsertXref('order', transactionId, odooOrderId, { tenantIds });
  audit.log({
    operation_type: 'ORDER_PUSH',
    sos_entity_id: transactionId,
    odoo_entity_id: odooOrderId,
    action: 'CREATE',
    status: 'SUCCESS',
    duration_ms: Date.now() - startAt,
  });
  logger.info('Order push: success', { transactionId, odooOrderId, durationMs: Date.now() - startAt });
  return { success: true, odoo_order_id: odooOrderId, error: null };
}

/**
 * Re-attempt confirmation on an order that was created but left in draft
 * because a previous action_confirm call failed.
 */
async function _reConfirmOrder(transactionId, odooOrderId, meta) {
  const cache = odoo.getCache();

  // Ensure warehouse is set before retrying confirmation.
  if (cache.warehouseId) {
    try {
      await odoo.write('sale.order', [odooOrderId], { warehouse_id: cache.warehouseId });
    } catch (_) { /* non-fatal */ }
  }

  // Verify the draft order still exists and is in a confirmable state.
  let orderState;
  try {
    const orders = await odoo.searchRead('sale.order', [['id', '=', odooOrderId]], ['id', 'state']);
    orderState = orders[0]?.state;
  } catch (_) { /* non-fatal — proceed and let action_confirm report the error */ }

  if (!orderState) {
    // Order was deleted from Odoo — clear the stale xref so a fresh order gets created.
    logger.warn('Order push: draft order deleted from Odoo — clearing xref for recreation', { transactionId, odooOrderId });
    await xref.deleteXref('order', transactionId);
    return { success: false, odoo_order_id: null, error: 'Draft order deleted; xref cleared for recreation' };
  }

  if (orderState !== 'draft' && orderState !== 'sent') {
    // Already confirmed (or cancelled). Clear the flag and treat as success if confirmed.
    const newMeta = { ...meta };
    delete newMeta.confirmFailed;
    await xref.upsertXref('order', transactionId, odooOrderId, newMeta);
    const isSuccess = orderState === 'sale' || orderState === 'done';
    logger.info('Order push: order already past draft state — clearing confirmFailed', { transactionId, odooOrderId, orderState });
    return { success: isSuccess, odoo_order_id: odooOrderId, error: isSuccess ? null : `Order state: ${orderState}` };
  }

  try {
    await odoo.execute('sale.order', 'action_confirm', [odooOrderId]);
    logger.info('Order push: re-confirmation succeeded', { transactionId, odooOrderId });
  } catch (err) {
    const isRouteError = err.message.includes('No rule has been found to replenish');
    if (isRouteError) {
      // Route misconfiguration in Odoo — order created but can't be auto-confirmed.
      // Accept the draft and stop retrying; Odoo admin must confirm manually.
      logger.warn('Order push: route error on confirmation — leaving as draft for manual confirmation in Odoo', {
        transactionId, odooOrderId,
      });
      const newMeta = { ...meta };
      delete newMeta.confirmFailed;
      newMeta.manualConfirmRequired = true;
      await xref.upsertXref('order', transactionId, odooOrderId, newMeta);
      return { success: true, odoo_order_id: odooOrderId, error: null };
    }
    logger.error('Order push: re-confirmation failed — manual resolution required', {
      transactionId, odooOrderId, error: err.message,
    });
    return { success: false, odoo_order_id: odooOrderId, error: `action_confirm failed: ${err.message}` };
  }

  try {
    await odoo.execute('sale.order', 'action_lock', [odooOrderId]);
  } catch (_) { /* non-fatal */ }

  const newMeta = { ...meta };
  delete newMeta.confirmFailed;
  await xref.upsertXref('order', transactionId, odooOrderId, newMeta);

  logger.info('Order push: re-confirmation complete', { transactionId, odooOrderId });
  return { success: true, odoo_order_id: odooOrderId, error: null };
}

module.exports = { pushOrder };
