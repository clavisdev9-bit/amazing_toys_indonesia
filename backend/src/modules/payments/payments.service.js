'use strict';

const { withTransaction, query } = require('../../config/database');
const { AppError }               = require('../../middlewares/error.middleware');
const { writeAuditLog }          = require('../../utils/auditLog');
const notificationsSvc           = require('../notifications/notifications.service');
const { broadcastToCustomer, broadcastToTenant } = require('../../ws/websocket');
const { fireWebhook }            = require('../../utils/webhook');
const { isCashierProcessable }   = require('../orders/status.machine');
const waSvc                      = require('../wa/wa.service');
const logger                     = require('../../config/logger');

/**
 * Cashier scans / searches transaction to review before payment.
 * Accepts PENDING (legacy self-order), RESERVED, and WAITING_PAYMENT statuses.
 */
async function lookupTransaction(transactionId) {
  const result = await query(
    `SELECT t.transaction_id, t.status, t.total_amount,
            t.subtotal_amount, t.tax_rate, t.tax_amount,
            t.voucher_code, t.discount_amount,
            t.expires_at, t.customer_phone AS walk_in_phone,
            c.full_name AS customer_name, c.phone_number AS customer_phone,
            c.email AS customer_email,
            t.created_at AS checkout_time, t.created_by_role,
            t.order_type, t.shipping_name, t.shipping_phone,
            t.shipping_address, t.shipping_city, t.shipping_province
     FROM transactions t
     LEFT JOIN customers c ON c.customer_id = t.customer_id
     WHERE t.transaction_id = $1`,
    [transactionId]
  );
  const txn = result.rows[0];
  if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);

  if (txn.status === 'PAID') throw new AppError('Transaksi sudah diproses.', 409);
  if (txn.status === 'CANCELLED') throw new AppError('Transaksi sudah dibatalkan.', 422);
  if (txn.status === 'EXPIRED') throw new AppError('Transaksi sudah kadaluarsa.', 410);
  if (txn.status === 'COMPLETED' || txn.status === 'HANDED_OVER') {
    throw new AppError('Transaksi sudah selesai.', 409);
  }
  if (!isCashierProcessable(txn.status)) {
    throw new AppError(`Transaksi tidak bisa diproses (status: ${txn.status}).`, 409);
  }

  const itemsResult = await query(
    `SELECT ti.product_id, ti.quantity, ti.approved_quantity, ti.approval_status,
            ti.unit_price, ti.subtotal,
            p.product_name, p.image_url,
            ten.tenant_id, ten.tenant_name, ten.booth_location
     FROM transaction_items ti
     JOIN products p ON p.product_id = ti.product_id
     JOIN tenants ten ON ten.tenant_id = ti.tenant_id
     WHERE ti.transaction_id = $1`,
    [transactionId]
  );

  return { ...txn, items: itemsResult.rows };
}

/**
 * Cashier scans QR to advance RESERVED → WAITING_PAYMENT.
 * For legacy PENDING orders, this is a no-op (stays PENDING, handled in processPayment).
 */
async function scanReservedOrder(transactionId, cashierId) {
  return withTransaction(async (client) => {
    const txResult = await client.query(
      `SELECT * FROM transactions WHERE transaction_id = $1 FOR UPDATE`,
      [transactionId]
    );
    const txn = txResult.rows[0];
    if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);

    // Legacy PENDING: skip the scan step, go straight to payment screen
    if (txn.status === 'PENDING') {
      return { transactionId, status: 'PENDING', skipped: true };
    }

    if (txn.status === 'WAITING_PAYMENT') {
      return { transactionId, status: 'WAITING_PAYMENT', alreadyScanned: true };
    }

    if (txn.status !== 'RESERVED') {
      throw new AppError(`Tidak bisa scan order dengan status '${txn.status}'.`, 409);
    }

    await client.query(
      `UPDATE transactions SET status = 'WAITING_PAYMENT' WHERE transaction_id = $1`,
      [transactionId]
    );

    await writeAuditLog({
      action: 'TXN_SCANNED', actorId: cashierId, actorRole: 'CASHIER',
      entityType: 'TRANSACTION', entityId: transactionId,
      oldValue: { status: 'RESERVED' },
      newValue: { status: 'WAITING_PAYMENT' },
    });

    return { transactionId, status: 'WAITING_PAYMENT' };
  });
}

/**
 * Process payment for a PENDING transaction.
 * Sends push notifications to all tenants whose products are in the order.
 *
 * @param {object} opts
 * @param {string} opts.transactionId
 * @param {string} opts.paymentMethod   CASH | QRIS | EDC | TRANSFER
 * @param {number} opts.cashReceived    Only for CASH method
 * @param {string} opts.paymentRef      EDC approval code / QRIS ref
 * @param {string} opts.cashierId       UUID of cashier processing the payment
 */
async function processPayment({ transactionId, paymentMethod, cashReceived, paymentRef, cashierId }) {
  return withTransaction(async (client) => {
    const txResult = await client.query(
      `SELECT * FROM transactions WHERE transaction_id = $1 FOR UPDATE`,
      [transactionId]
    );
    const txn = txResult.rows[0];
    if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);
    // Accept PENDING (legacy), WAITING_PAYMENT (Model C), RESERVED (helper skipped scan)
    if (!isCashierProcessable(txn.status)) {
      throw new AppError(`Transaksi tidak bisa dibayar (status: ${txn.status}).`, 409);
    }
    if (txn.expires_at && new Date(txn.expires_at) < new Date()) {
      throw new AppError('Transaksi sudah kadaluarsa.', 410);
    }

    // Validate cash
    if (paymentMethod === 'CASH') {
      if (!cashReceived || cashReceived < txn.total_amount) {
        throw new AppError('Jumlah diterima kurang dari total pembayaran.');
      }
    }

    const cashChange = paymentMethod === 'CASH'
      ? parseFloat(cashReceived) - parseFloat(txn.total_amount)
      : null;

    // Mark as PAID; freeze amount_charged = total_amount at this moment (fraud protection)
    await client.query(
      `UPDATE transactions
       SET status = 'PAID', payment_method = $1, payment_reference = $2,
           cash_received = $3, cash_change = $4, cashier_id = $5, paid_at = NOW(),
           amount_charged = $6
       WHERE transaction_id = $7`,
      [paymentMethod, paymentRef || null, cashReceived || null, cashChange, cashierId, txn.total_amount, transactionId]
    );

    // CR-05X: jika PREORDER, langsung transisi ke AWAITING_SHIPMENT (tidak masuk pickup queue)
    const isPreorder = txn.order_type === 'PREORDER';
    if (isPreorder) {
      await client.query(
        `UPDATE transactions SET status = 'AWAITING_SHIPMENT' WHERE transaction_id = $1`,
        [transactionId],
      );
    }

    // Update cashier session recap
    const amountCol = {
      CASH:     'total_cash',
      QRIS:     'total_qris',
      EDC:      'total_edc',
      TRANSFER: 'total_transfer',
    }[paymentMethod] || 'total_cash';

    await client.query(
      `INSERT INTO cashier_sessions (cashier_id, shift_date, txn_count, ${amountCol})
       VALUES ($1, CURRENT_DATE, 1, $2)
       ON CONFLICT (cashier_id, shift_date) DO UPDATE
         SET txn_count   = cashier_sessions.txn_count + 1,
             ${amountCol} = cashier_sessions.${amountCol} + $2`,
      [cashierId, txn.total_amount]
    );

    await writeAuditLog({
      action: 'PAYMENT_PROCESSED', actorId: cashierId, actorRole: 'CASHIER',
      entityType: 'TRANSACTION', entityId: transactionId,
      oldValue: { status: txn.status },
      newValue: { status: 'PAID', paymentMethod, cashChange },
    });

    // Retrieve affected tenants for push notification + WS broadcast
    const tenantResult = await client.query(
      `SELECT DISTINCT ten.tenant_id, ten.tenant_name, ten.notification_device_token
       FROM transaction_items ti
       JOIN tenants ten ON ten.tenant_id = ti.tenant_id
       WHERE ti.transaction_id = $1`,
      [transactionId]
    );

    // Notify registered customer's browser
    if (txn.customer_id) {
      try {
        broadcastToCustomer(txn.customer_id, {
          event: isPreorder ? 'PREORDER_CONFIRMED' : 'ORDER_PAID',
          transactionId,
          orderType: txn.order_type || 'REGULAR',
        });
      } catch (e) { logger.warn('WS customer ORDER_PAID failed', { error: e.message }); }
    }

    // Notify HELPER/TENANT booth that order is ready for handover (Model C) — skip for preorder
    if (!isPreorder) {
      for (const tenant of tenantResult.rows) {
        try {
          broadcastToTenant(tenant.tenant_id, {
            event: 'ORDER_PAID',
            transactionId,
            message: `Order ${transactionId} sudah dibayar — siapkan barang!`,
          });
        } catch (e) { logger.warn('WS tenant ORDER_PAID failed', { error: e.message }); }
        notificationsSvc.sendOrderNotification(tenant, transactionId).catch(() => {});
      }
    }

    const paidAt = new Date().toISOString();

    // Notify integration service (Odoo order push)
    fireWebhook('/webhook/order-paid', {
      transactionId,
      status: 'PAID',
      subtotalAmount:  parseFloat(txn.subtotal_amount ?? txn.total_amount),
      taxRate:         parseFloat(txn.tax_rate ?? 12),
      taxAmount:       parseFloat(txn.tax_amount ?? 0),
      totalAmount:     parseFloat(txn.total_amount),
      paidAt,
      customerId: txn.customer_id,
    });

    // CR-05X: kirim WA konfirmasi preorder setelah payment (fire-and-forget)
    const effectivePhone = txn.customer_phone || null;
    if (isPreorder && effectivePhone) {
      const totalFormatted = new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
      }).format(txn.total_amount);
      // Ambil preorder_note dari produk dalam transaksi (non-blocking)
      query(
        `SELECT DISTINCT p.preorder_note FROM transaction_items ti
         JOIN products p ON p.product_id = ti.product_id
         WHERE ti.transaction_id = $1 AND p.is_preorder = TRUE AND p.preorder_note IS NOT NULL`,
        [transactionId],
      ).then(async (noteRes) => {
        const estimasiNote = noteRes.rows.map(r => r.preorder_note).filter(Boolean).join('; ');
        const custRow = await query(
          `SELECT c.full_name FROM customers c
           JOIN transactions t ON t.customer_id = c.customer_id
           WHERE t.transaction_id = $1`,
          [transactionId],
        ).catch(() => ({ rows: [] }));
        const customerName = custRow.rows[0]?.full_name || 'Customer';
        waSvc.sendPreorderConfirmed(effectivePhone, customerName, totalFormatted, estimasiNote)
          .catch(err => logger.warn('[WA-PREORDER] sendPreorderConfirmed error', { error: err.message }));
      }).catch(() => {});
    }

    return {
      transactionId,
      status: isPreorder ? 'AWAITING_SHIPMENT' : 'PAID',
      orderType: txn.order_type || 'REGULAR',
      paymentMethod,
      cashChange,
      paidAt,
    };
  });
}

module.exports = { lookupTransaction, scanReservedOrder, processPayment };
