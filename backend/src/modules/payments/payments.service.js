'use strict';

const { withTransaction, query } = require('../../config/database');
const { AppError }               = require('../../middlewares/error.middleware');
const { writeAuditLog }          = require('../../utils/auditLog');
const notificationsSvc           = require('../notifications/notifications.service');
const { broadcastToCustomer }    = require('../../ws/websocket');
const { fireWebhook }            = require('../../utils/webhook');

/**
 * Cashier scans / searches transaction to review before payment.
 * Only PENDING transactions can be processed.
 */
async function lookupTransaction(transactionId) {
  const result = await query(
    `SELECT t.transaction_id, t.status, t.total_amount, t.expires_at,
            c.full_name AS customer_name, c.phone_number AS customer_phone,
            c.email AS customer_email,
            t.created_at AS checkout_time
     FROM transactions t
     JOIN customers c ON c.customer_id = t.customer_id
     WHERE t.transaction_id = $1`,
    [transactionId]
  );
  const txn = result.rows[0];
  if (!txn) throw new AppError('Transaksi tidak ditemukan.', 404);

  if (txn.status === 'PAID') throw new AppError('Transaksi sudah diproses.', 409);
  if (txn.status === 'CANCELLED') throw new AppError('Transaksi sudah dibatalkan.', 409);
  if (txn.status === 'EXPIRED' || new Date(txn.expires_at) < new Date()) {
    throw new AppError('Transaksi sudah kadaluarsa.', 410);
  }

  const itemsResult = await query(
    `SELECT ti.quantity, ti.unit_price, ti.subtotal,
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
    if (txn.status !== 'PENDING') throw new AppError('Transaksi tidak dalam status PENDING.', 409);
    if (new Date(txn.expires_at) < new Date()) throw new AppError('Transaksi sudah kadaluarsa.', 410);

    // Validate cash
    if (paymentMethod === 'CASH') {
      if (!cashReceived || cashReceived < txn.total_amount) {
        throw new AppError('Jumlah diterima kurang dari total pembayaran.');
      }
    }

    const cashChange = paymentMethod === 'CASH'
      ? parseFloat(cashReceived) - parseFloat(txn.total_amount)
      : null;

    // Mark as PAID
    await client.query(
      `UPDATE transactions
       SET status = 'PAID', payment_method = $1, payment_reference = $2,
           cash_received = $3, cash_change = $4, cashier_id = $5, paid_at = NOW()
       WHERE transaction_id = $6`,
      [paymentMethod, paymentRef || null, cashReceived || null, cashChange, cashierId, transactionId]
    );

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
      oldValue: { status: 'PENDING' },
      newValue: { status: 'PAID', paymentMethod, cashChange },
    });

    // Retrieve affected tenants for push notification
    const tenantResult = await client.query(
      `SELECT DISTINCT ten.tenant_id, ten.tenant_name, ten.notification_device_token
       FROM transaction_items ti
       JOIN tenants ten ON ten.tenant_id = ti.tenant_id
       WHERE ti.transaction_id = $1`,
      [transactionId]
    );

    // Notify the customer's browser to redirect to the order detail page
    broadcastToCustomer(txn.customer_id, { event: 'ORDER_PAID', transactionId });

    // Fire-and-forget notifications (non-blocking)
    for (const tenant of tenantResult.rows) {
      notificationsSvc.sendOrderNotification(tenant, transactionId).catch(() => {});
    }

    const paidAt = new Date().toISOString();

    // Notify integration service (Odoo order push)
    fireWebhook('/webhook/order-paid', {
      transactionId,
      status: 'PAID',
      totalAmount: parseFloat(txn.total_amount),
      paidAt,
      customerId: txn.customer_id,
    });

    return {
      transactionId,
      status: 'PAID',
      paymentMethod,
      cashChange,
      paidAt,
    };
  });
}

module.exports = { lookupTransaction, processPayment };
