'use strict';

const { withTransaction, query } = require('../../config/database');
const { AppError }               = require('../../middlewares/error.middleware');
const { writeAuditLog }          = require('../../utils/auditLog');
const { broadcastToCustomer }    = require('../../ws/websocket');
const waSvc                      = require('../wa/wa.service');
const emailSvc                   = require('../../services/email.service');
const logger                     = require('../../config/logger');

// ── Private helpers ───────────────────────────────────────────────────────────

async function _fetchPreorderTxn(client, txnId, requiredStatus) {
  const res = await client.query(
    `SELECT t.transaction_id, t.order_type, t.status, t.customer_id, t.customer_phone, t.total_amount,
            COALESCE(c.phone_number, t.customer_phone) AS resolved_phone,
            COALESCE(c.full_name, 'Customer')          AS resolved_name,
            c.email                                    AS customer_email
       FROM transactions t
       LEFT JOIN customers c ON c.customer_id = t.customer_id
      WHERE t.transaction_id = $1 FOR UPDATE OF t`,
    [txnId],
  );
  const txn = res.rows[0];
  if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);
  if (txn.order_type !== 'PREORDER') throw new AppError('Bukan transaksi Pre-Order.', 400);
  if (txn.status !== requiredStatus) {
    throw new AppError(
      `Status transaksi tidak sesuai (${txn.status}). Harap status ${requiredStatus}.`, 409,
    );
  }
  return txn;
}

function _broadcastSafe(customerId, payload) {
  if (!customerId) return;
  try {
    broadcastToCustomer(customerId, payload);
  } catch (e) {
    logger.warn(`[PREORDER] WS broadcast failed (${payload.event})`, { error: e.message });
  }
}

// Fire-and-forget WA notification; swallows errors so caller never throws.
function _sendWaNotification(phone, fn, label) {
  if (!phone) return;
  fn().catch(err => logger.warn(`[PREORDER] ${label} error`, { error: err.message }));
}

// Fire-and-forget email notification; swallows errors so caller never throws.
function _sendEmailNotification(email, fn, label) {
  if (!email) return;
  fn().catch(err => logger.warn(`[PREORDER] ${label} email error`, { error: err.message }));
}

// ── Public functions ──────────────────────────────────────────────────────────

/**
 * List semua transaksi PREORDER, opsional filter by status.
 *
 * @param {object} filters
 * @param {string} [filters.status]  awaiting | shipped | arrived | handover | completed | all
 */
async function getPreorderList({ status } = {}) {
  const statusMap = {
    pending:   ['PENDING_APPROVAL', 'PENDING'],   // BUG-051-02b: pre-order disetujui/menunggu pembayaran
    paid:      ['PAID'],                          // BUG-051-02: transaksi sudah dibayar, belum diproses
    awaiting:  ['AWAITING_SHIPMENT'],
    shipped:   ['SHIPPED'],
    arrived:   ['ARRIVED'],
    handover:  ['PREORDER_HANDOVER'],
    completed: ['COMPLETED'],
    active:    ['PENDING_APPROVAL', 'PENDING', 'PAID', 'AWAITING_SHIPMENT', 'SHIPPED', 'ARRIVED', 'PREORDER_HANDOVER'],
    all:       ['PENDING_APPROVAL', 'PENDING', 'PAID', 'AWAITING_SHIPMENT', 'SHIPPED', 'ARRIVED', 'PREORDER_HANDOVER', 'COMPLETED'],
  };

  const allowedStatuses = statusMap[status] || statusMap.active;

  const res = await query(
    `SELECT
       t.transaction_id, t.status, t.order_type,
       t.total_amount, t.payment_method, t.paid_at,
       t.shipping_name, t.shipping_phone, t.shipping_address,
       t.shipping_city, t.shipping_province,
       t.courier, t.tracking_number,
       t.shipped_at, t.arrived_at, t.handed_over_at,
       c.full_name  AS customer_name,
       c.phone_number AS customer_phone_reg,
       t.customer_phone AS walk_in_phone,
       u.display_name   AS cashier_name,
       json_agg(
         json_build_object(
           'product_name', p.product_name,
           'quantity',     COALESCE(ti.approved_quantity, ti.quantity),
           'unit_price',   ti.unit_price,
           'subtotal',     ti.subtotal,
           'is_preorder',  p.is_preorder,
           'preorder_note',p.preorder_note
         ) ORDER BY p.product_name
       ) AS items
     FROM transactions t
     LEFT JOIN customers c ON c.customer_id = t.customer_id
     LEFT JOIN users u ON u.user_id = t.cashier_id
     JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
     JOIN products p ON p.product_id = ti.product_id
     WHERE t.order_type = 'PREORDER'
       AND t.status = ANY($1)
     GROUP BY t.transaction_id, c.full_name, c.phone_number, u.display_name
     ORDER BY t.paid_at DESC
     LIMIT 200`,
    [allowedStatuses],
  );

  return res.rows.map(txn => ({
    ...txn,
    customer_name:  txn.customer_name || txn.shipping_name || 'Walk-in',
    customer_phone: txn.customer_phone_reg || txn.walk_in_phone || txn.shipping_phone || null,
  }));
}

/**
 * Admin input resi pengiriman → SHIPPED.
 *
 * @param {string} txnId
 * @param {{ courier: string, tracking_number: string }} payload
 * @param {string} actorId    UUID of the admin performing the action
 * @param {string} actorRole  Role of the admin (ADMIN | LEADER)
 */
async function updateShipment(txnId, { courier, tracking_number: trackingNumber }, actorId, actorRole) {
  const updated = await withTransaction(async (client) => {
    const txn = await _fetchPreorderTxn(client, txnId, 'AWAITING_SHIPMENT');

    await client.query(
      `UPDATE transactions
         SET status = 'SHIPPED', courier = $1, tracking_number = $2, shipped_at = NOW()
       WHERE transaction_id = $3`,
      [courier.trim(), trackingNumber.trim(), txnId],
    );

    await writeAuditLog({
      action: 'PREORDER_SHIPPED', actorId, actorRole,
      entityType: 'TRANSACTION', entityId: txnId,
      newValue: { status: 'SHIPPED', courier, trackingNumber },
    });

    return {
      transactionId:  txnId,
      status:         'SHIPPED',
      courier:        courier.trim(),
      trackingNumber: trackingNumber.trim(),
      customerId:     txn.customer_id,
      customerPhone:  txn.resolved_phone,
      customerName:   txn.resolved_name,
      customerEmail:  txn.customer_email || null,
    };
  });

  _sendWaNotification(updated.customerPhone,
    () => waSvc.sendPreorderShipped(updated.customerPhone, updated.customerName, updated.courier, updated.trackingNumber),
    'sendPreorderShipped');
  _sendEmailNotification(updated.customerEmail,
    () => emailSvc.sendPreorderShippedEmail(updated.customerEmail, updated.customerName, updated.courier, updated.trackingNumber),
    'sendPreorderShipped');
  _broadcastSafe(updated.customerId, {
    event:          'PREORDER_SHIPPED',
    transactionId:  txnId,
    courier:        updated.courier,
    trackingNumber: updated.trackingNumber,
  });

  return updated;
}

/**
 * Admin konfirmasi barang sudah sampai di Indonesia → ARRIVED.
 *
 * @param {string} txnId
 * @param {string} actorId    UUID of the admin performing the action
 * @param {string} actorRole  Role of the admin (ADMIN | LEADER)
 */
async function confirmArrived(txnId, actorId, actorRole) {
  const updated = await withTransaction(async (client) => {
    // CR-050: flow AWAITING_SHIPMENT → ARRIVED (SHIPPED removed). Accept both for backward compat.
    let txn;
    try {
      txn = await _fetchPreorderTxn(client, txnId, 'AWAITING_SHIPMENT');
    } catch (e) {
      if (e.message && e.message.includes('Status transaksi tidak sesuai')) {
        txn = await _fetchPreorderTxn(client, txnId, 'SHIPPED');
      } else {
        throw e;
      }
    }

    await client.query(
      `UPDATE transactions SET status = 'ARRIVED', arrived_at = NOW() WHERE transaction_id = $1`,
      [txnId],
    );

    await writeAuditLog({
      action: 'PREORDER_ARRIVED', actorId, actorRole,
      entityType: 'TRANSACTION', entityId: txnId,
      newValue: { status: 'ARRIVED' },
    });

    return {
      transactionId: txnId,
      status:        'ARRIVED',
      customerId:    txn.customer_id,
      customerPhone: txn.resolved_phone,
      customerName:  txn.resolved_name,
      customerEmail: txn.customer_email || null,
    };
  });

  _sendWaNotification(updated.customerPhone,
    () => waSvc.sendPreorderArrived(updated.customerPhone, updated.customerName),
    'sendPreorderArrived');
  _sendEmailNotification(updated.customerEmail,
    () => emailSvc.sendPreorderArrivedEmail(updated.customerEmail, updated.customerName),
    'sendPreorderArrived');
  _broadcastSafe(updated.customerId, { event: 'PREORDER_ARRIVED', transactionId: txnId });

  return updated;
}

/**
 * Helper serahkan barang fisik ke customer → COMPLETED.
 *
 * @param {string} txnId
 * @param {string} actorId    UUID helper/admin
 * @param {string} actorRole  HELPER | ADMIN | LEADER
 */
async function handover(txnId, actorId, actorRole) {
  const updated = await withTransaction(async (client) => {
    const txn = await _fetchPreorderTxn(client, txnId, 'ARRIVED');

    await client.query(
      `UPDATE transactions
         SET status = 'COMPLETED', handed_over_at = NOW()
       WHERE transaction_id = $1`,
      [txnId],
    );

    await writeAuditLog({
      action: 'PREORDER_HANDOVER', actorId, actorRole,
      entityType: 'TRANSACTION', entityId: txnId,
      newValue: { status: 'COMPLETED' },
    });

    return {
      transactionId: txnId,
      status:        'COMPLETED',
      customerId:    txn.customer_id,
      customerPhone: txn.resolved_phone,
      customerName:  txn.resolved_name,
      customerEmail: txn.customer_email || null,
      totalAmount:   txn.total_amount,
    };
  });

  _sendWaNotification(updated.customerPhone,
    () => waSvc.sendPreorderCompleted(updated.customerPhone, updated.customerName),
    'sendPreorderCompleted');
  _sendEmailNotification(updated.customerEmail,
    () => emailSvc.sendPreorderCompletedEmail(updated.customerEmail, updated.customerName),
    'sendPreorderCompleted');
  _broadcastSafe(updated.customerId, { event: 'PREORDER_COMPLETED', transactionId: txnId });

  return updated;
}

/**
 * BUG-051-02: Admin konfirmasi pre-order siap kirim → PAID → AWAITING_SHIPMENT.
 * Step ini wajib ada sebelum admin bisa konfirmasi kedatangan (confirmArrived).
 */
async function confirmReadyToShip(txnId, actorId, actorRole) {
  const updated = await withTransaction(async (client) => {
    const txn = await _fetchPreorderTxn(client, txnId, 'PAID');

    await client.query(
      `UPDATE transactions SET status = 'AWAITING_SHIPMENT' WHERE transaction_id = $1`,
      [txnId],
    );

    await writeAuditLog({
      action: 'PREORDER_READY_TO_SHIP', actorId, actorRole,
      entityType: 'TRANSACTION', entityId: txnId,
      newValue: { status: 'AWAITING_SHIPMENT' },
    });

    return {
      transactionId: txnId,
      status:        'AWAITING_SHIPMENT',
      customerId:    txn.customer_id,
      customerPhone: txn.resolved_phone,
      customerName:  txn.resolved_name,
    };
  });

  _broadcastSafe(updated.customerId, {
    event: 'PREORDER_READY_TO_SHIP', transactionId: txnId,
  });

  return updated;
}

module.exports = { getPreorderList, updateShipment, confirmArrived, handover, confirmReadyToShip };
