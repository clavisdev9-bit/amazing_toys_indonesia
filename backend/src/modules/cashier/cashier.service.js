'use strict';

const { withTransaction, query } = require('../../config/database');
const { AppError }               = require('../../middlewares/error.middleware');
const { writeAuditLog }          = require('../../utils/auditLog');
const { broadcastToCustomer, broadcastToTenant } = require('../../ws/websocket');
const notificationsSvc           = require('../notifications/notifications.service');
const { fireWebhook }            = require('../../utils/webhook');
const logger                     = require('../../config/logger');

/**
 * Get cashier's daily session recap.
 * Includes payment breakdown, voucher summary, group vs single split, and expired count.
 */
async function getDailyRecap(cashierId, date) {
  const shiftDate = date || new Date().toISOString().slice(0, 10);
  const result = await query(
    `SELECT cs.*, u.display_name AS cashier_name
     FROM cashier_sessions cs
     JOIN users u ON u.user_id = cs.cashier_id
     WHERE cs.cashier_id = $1 AND cs.shift_date = $2`,
    [cashierId, shiftDate]
  );

  const session = result.rows[0] || {
    cashier_id: cashierId,
    shift_date: shiftDate,
    txn_count: 0,
    total_cash: 0, total_qris: 0, total_edc: 0, total_transfer: 0,
  };

  const grandTotal =
    parseFloat(session.total_cash || 0) +
    parseFloat(session.total_qris || 0) +
    parseFloat(session.total_edc  || 0) +
    parseFloat(session.total_transfer || 0);

  // Voucher summary + group/single split + expired count
  const statsResult = await query(
    `SELECT
       COUNT(*) FILTER (WHERE voucher_code IS NOT NULL)::int             AS txn_with_voucher,
       COALESCE(SUM(discount_amount) FILTER (WHERE voucher_code IS NOT NULL), 0) AS total_discount,
       COUNT(*) FILTER (WHERE group_id IS NULL)::int                     AS txn_single_count,
       COUNT(*) FILTER (WHERE group_id IS NOT NULL)::int                 AS txn_group_count
     FROM transactions
     WHERE cashier_id = $1
       AND DATE(paid_at AT TIME ZONE 'Asia/Jakarta') = $2
       AND status = 'PAID'`,
    [cashierId, shiftDate]
  );

  const expiredResult = await query(
    `SELECT COUNT(*)::int AS txn_expired_count
     FROM transactions
     WHERE cashier_id = $1
       AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') = $2
       AND status = 'EXPIRED'`,
    [cashierId, shiftDate]
  );

  const stats   = statsResult.rows[0]   || {};
  const expired = expiredResult.rows[0] || {};

  return {
    ...session,
    grand_total:      grandTotal,
    txn_with_voucher: stats.txn_with_voucher  ?? 0,
    total_discount:   parseFloat(stats.total_discount ?? 0),
    txn_single_count: stats.txn_single_count  ?? 0,
    txn_group_count:  stats.txn_group_count   ?? 0,
    txn_expired_count: expired.txn_expired_count ?? 0,
  };
}

/**
 * Get transactions processed by a specific cashier on a given day.
 * LEADER/ADMIN may pass cashierId=null to get all cashiers for that date.
 */
async function getCashierTransactions(cashierId, date) {
  const shiftDate = date || new Date().toLocaleString('sv', { timeZone: 'Asia/Jakarta' }).slice(0, 10);
  const params = [shiftDate];
  const cashierFilter = cashierId
    ? (() => { params.push(cashierId); return `AND t.cashier_id = $${params.length}`; })()
    : '';
  const result = await query(
    `SELECT t.transaction_id, t.status, t.total_amount, t.payment_method,
            t.payment_reference, t.voucher_code, t.discount_amount,
            t.group_id, t.paid_at,
            c.full_name AS customer_name, u.display_name AS cashier_name
     FROM transactions t
     JOIN customers c ON c.customer_id = t.customer_id
     LEFT JOIN users u ON u.user_id = t.cashier_id
     WHERE DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') = $1
       AND t.status = 'PAID'
       ${cashierFilter}
     ORDER BY t.paid_at DESC`,
    params
  );
  return result.rows;
}

/**
 * List orders waiting for payment (RESERVED + PENDING + WAITING_PAYMENT), sorted by created_at ASC.
 * Used by cashier queue view in Model C flow.
 *
 * CR-053: Pre-order PENDING transactions are included regardless of creation date
 * because pre-orders may be created days before the event. The date filter only applies
 * to regular orders (REGULAR / RESERVED / WAITING_PAYMENT).
 */
async function getPaymentQueue(date) {
  const shiftDate = date || new Date().toLocaleString('sv', { timeZone: 'Asia/Jakarta' }).slice(0, 10);
  const result = await query(
    `SELECT t.transaction_id, t.status, t.order_type, t.total_amount, t.created_at, t.reserved_at,
            t.customer_phone AS walk_in_phone, t.created_by_role,
            c.full_name AS customer_name, c.phone_number AS customer_phone,
            ten.tenant_name, ten.booth_location,
            COUNT(ti.item_id) AS item_count
     FROM transactions t
     LEFT JOIN customers c ON c.customer_id = t.customer_id
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
     LEFT JOIN tenants ten ON ten.tenant_id = (
       SELECT ti2.tenant_id FROM transaction_items ti2
       WHERE ti2.transaction_id = t.transaction_id LIMIT 1
     )
     WHERE t.status IN ('RESERVED', 'PENDING', 'WAITING_PAYMENT')
       AND (
         DATE(t.created_at AT TIME ZONE 'Asia/Jakarta') = $1
         OR (t.status = 'PENDING' AND t.order_type = 'PREORDER')
       )
     GROUP BY t.transaction_id, t.order_type, c.full_name, c.phone_number, ten.tenant_name, ten.booth_location
     ORDER BY t.order_type DESC, t.created_at ASC`,
    [shiftDate],
  );
  return result.rows;
}

/**
 * CR-053: List PENDING pre-order transactions awaiting cashier payment.
 * No date filter — pre-orders can be approved days before payment day.
 * Used by the dedicated "Pre-Order" tab on the cashier dashboard.
 */
async function getPreorderPaymentQueue() {
  const result = await query(
    `SELECT t.transaction_id, t.status, t.order_type, t.total_amount, t.created_at, t.approved_at,
            t.expires_at, t.customer_phone AS walk_in_phone, t.created_by_role,
            c.full_name AS customer_name, c.phone_number AS customer_phone,
            ten.tenant_name, ten.booth_location,
            COUNT(ti.item_id) AS item_count
     FROM transactions t
     LEFT JOIN customers c ON c.customer_id = t.customer_id
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
     LEFT JOIN tenants ten ON ten.tenant_id = (
       SELECT ti2.tenant_id FROM transaction_items ti2
       WHERE ti2.transaction_id = t.transaction_id LIMIT 1
     )
     WHERE t.status = 'PENDING'
       AND t.order_type = 'PREORDER'
     GROUP BY t.transaction_id, t.order_type, c.full_name, c.phone_number, ten.tenant_name, ten.booth_location
     ORDER BY t.approved_at ASC NULLS LAST, t.created_at ASC`,
  );
  return result.rows;
}

/**
 * List EXPIRED transactions for a given date (default: today).
 * Used by cashier Kadaluarsa tab.
 */
async function getExpiredQueue(date) {
  const shiftDate = date || new Date().toLocaleString('sv', { timeZone: 'Asia/Jakarta' }).slice(0, 10);
  const result = await query(
    `SELECT t.transaction_id, t.status, t.total_amount, t.created_at, t.expires_at,
            t.customer_phone AS walk_in_phone, t.created_by_role,
            c.full_name AS customer_name, c.phone_number AS customer_phone,
            ten.tenant_name, ten.booth_location,
            COUNT(ti.item_id) AS item_count
     FROM transactions t
     LEFT JOIN customers c ON c.customer_id = t.customer_id
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
     LEFT JOIN tenants ten ON ten.tenant_id = (
       SELECT ti2.tenant_id FROM transaction_items ti2
       WHERE ti2.transaction_id = t.transaction_id LIMIT 1
     )
     WHERE t.status = 'EXPIRED'
       AND DATE(t.created_at AT TIME ZONE 'Asia/Jakarta') = $1
     GROUP BY t.transaction_id, c.full_name, c.phone_number, ten.tenant_name, ten.booth_location
     ORDER BY t.expires_at DESC`,
    [shiftDate],
  );
  return result.rows;
}

// ── Item Delete Requests ─────────────────────────────────────────────────────

/**
 * Create a PENDING delete request. Returns the new request row.
 */
async function createDeleteRequest(cashierId, cashierName, { transaction_id, product_id, product_name, qty, subtotal }) {
  const result = await query(
    `INSERT INTO item_delete_requests
       (transaction_id, product_id, product_name, qty, subtotal, cashier_id, cashier_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [transaction_id || null, product_id, product_name, qty, subtotal, cashierId, cashierName],
  );
  return result.rows[0];
}

/**
 * List PENDING delete requests submitted by a specific cashier.
 * Used by the cashier to restore pending state after page reload.
 */
async function getPendingDeleteRequests(cashierId) {
  const result = await query(
    `SELECT request_id, product_id, product_name, qty, subtotal, transaction_id, created_at
     FROM item_delete_requests
     WHERE cashier_id = $1 AND status = 'PENDING'
     ORDER BY created_at DESC`,
    [cashierId],
  );
  return result.rows;
}

// ── Group Checkout ────────────────────────────────────────────────────────────

/**
 * Cari TRX aktif milik customer berdasarkan nomor HP atau nama.
 * Digunakan kasir sebelum merge multi-booth.
 * Status yang dianggap "aktif": RESERVED, WAITING_PAYMENT, PENDING.
 */
async function getCustomerActiveTrx({ phone, name }) {
  if (!phone && !name) throw new AppError('Masukkan nomor HP atau nama customer.', 400);

  const conditions = [];
  const params     = [];

  if (phone) {
    params.push(`%${phone.replace(/\D/g, '')}%`);
    conditions.push(`(REGEXP_REPLACE(c.phone_number, '\\D', '', 'g') ILIKE $${params.length}
                   OR REGEXP_REPLACE(t.customer_phone, '\\D', '', 'g') ILIKE $${params.length})`);
  }
  if (name) {
    params.push(`%${name}%`);
    conditions.push(`c.full_name ILIKE $${params.length}`);
  }

  const whereClause = conditions.join(' OR ');

  const result = await query(
    `SELECT
       t.transaction_id, t.status, t.total_amount, t.subtotal_amount,
       t.tax_amount, t.created_at, t.reserved_at, t.group_id,
       t.customer_phone AS walk_in_phone,
       c.customer_id, c.full_name AS customer_name, c.phone_number AS customer_phone,
       json_agg(
         json_build_object(
           'product_name', p.product_name,
           'quantity',     ti.quantity,
           'unit_price',   ti.unit_price,
           'subtotal',     ti.subtotal,
           'tenant_name',  ten.tenant_name,
           'booth_location', ten.booth_location
         ) ORDER BY ten.tenant_name
       ) AS items,
       COUNT(DISTINCT ti.tenant_id) AS booth_count
     FROM transactions t
     LEFT JOIN customers c ON c.customer_id = t.customer_id
     JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
     JOIN products p ON p.product_id = ti.product_id
     JOIN tenants ten ON ten.tenant_id = ti.tenant_id
     WHERE t.status IN ('RESERVED', 'WAITING_PAYMENT', 'PENDING')
       AND t.group_id IS NULL
       AND (${whereClause})
     GROUP BY t.transaction_id, c.customer_id, c.full_name, c.phone_number
     ORDER BY t.created_at ASC`,
    params,
  );

  return result.rows;
}

/**
 * Generate group_code seperti GRP-20260613-0001.
 */
async function _generateGroupCode(client) {
  const seq = await client.query(`SELECT nextval('transaction_groups_seq') AS n`);
  const n   = String(seq.rows[0].n).padStart(4, '0');
  const d   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `GRP-${d}-${n}`;
}

/**
 * Merge beberapa TRX (dari booth berbeda) menjadi 1 group,
 * lalu proses pembayaran sekaligus.
 *
 * @param {object} opts
 * @param {string[]} opts.transactionIds  Array UUID TRX yang akan digabung (min 1)
 * @param {string}   opts.cashierId
 * @param {string}   opts.paymentMethod   CASH | QRIS | EDC | TRANSFER
 * @param {number}   [opts.cashReceived]  Hanya untuk CASH
 * @param {string}   [opts.paymentRef]    EDC / QRIS ref
 */
async function groupCheckout({ transactionIds, cashierId, paymentMethod, cashReceived, paymentRef }) {
  if (!transactionIds || transactionIds.length === 0) {
    throw new AppError('Pilih minimal 1 transaksi.', 400);
  }
  if (!['CASH', 'QRIS', 'EDC', 'TRANSFER'].includes(paymentMethod)) {
    throw new AppError('Metode pembayaran tidak valid.', 400);
  }

  // Jika hanya 1 TRX, langsung proses tanpa membuat group
  if (transactionIds.length === 1) {
    return _processSingleAsCashier({ transactionId: transactionIds[0], cashierId, paymentMethod, cashReceived, paymentRef });
  }

  const committed = await withTransaction(async (client) => {
    // 1. Lock + validasi semua TRX
    const txResult = await client.query(
      `SELECT t.*, c.full_name AS customer_name, c.phone_number AS customer_phone_reg
       FROM transactions t
       LEFT JOIN customers c ON c.customer_id = t.customer_id
       WHERE t.transaction_id = ANY($1)
       FOR UPDATE OF t`,
      [transactionIds],
    );

    if (txResult.rows.length !== transactionIds.length) {
      throw new AppError('Satu atau lebih transaksi tidak ditemukan.', 404);
    }

    for (const txn of txResult.rows) {
      if (!['RESERVED', 'WAITING_PAYMENT', 'PENDING'].includes(txn.status)) {
        throw new AppError(`Transaksi ${txn.transaction_id} tidak bisa diproses (status: ${txn.status}).`, 409);
      }
      if (txn.group_id) {
        throw new AppError(`Transaksi ${txn.transaction_id} sudah tergabung dalam group lain.`, 409);
      }
      if (txn.expires_at && new Date(txn.expires_at) < new Date()) {
        throw new AppError(`Transaksi ${txn.transaction_id} sudah kadaluarsa.`, 410);
      }
    }

    // 2. Hitung total group
    const totalAmount    = txResult.rows.reduce((s, t) => s + parseFloat(t.total_amount), 0);
    const subtotalAmount = txResult.rows.reduce((s, t) => s + parseFloat(t.subtotal_amount || t.total_amount), 0);
    const taxAmount      = txResult.rows.reduce((s, t) => s + parseFloat(t.tax_amount || 0), 0);

    if (paymentMethod === 'CASH' && (!cashReceived || cashReceived < totalAmount)) {
      throw new AppError('Jumlah diterima kurang dari total pembayaran group.', 400);
    }

    // 3. Ambil customer info dari TRX pertama
    const firstTxn      = txResult.rows[0];
    const customerId    = firstTxn.customer_id    || null;
    const customerPhone = firstTxn.customer_phone_reg || firstTxn.customer_phone || null;
    const customerName  = firstTxn.customer_name  || null;

    // 4. Buat group record
    const groupCode = await _generateGroupCode(client);
    const groupRes  = await client.query(
      `INSERT INTO transaction_groups
         (group_code, cashier_id, customer_id, customer_phone, customer_name,
          subtotal_amount, tax_amount, total_amount,
          payment_method, paid_at, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'PAID')
       RETURNING group_id, group_code`,
      [groupCode, cashierId, customerId, customerPhone, customerName,
       subtotalAmount, taxAmount, totalAmount, paymentMethod],
    );
    const { group_id: groupId, group_code: groupCodeResult } = groupRes.rows[0];

    const cashChange = paymentMethod === 'CASH'
      ? parseFloat(cashReceived) - totalAmount
      : null;

    // 5. Update semua TRX: set group_id + PAID; freeze amount_charged per-TRX (fraud protection)
    await client.query(
      `UPDATE transactions
         SET group_id = $1, status = 'PAID',
             payment_method = $2, payment_reference = $3,
             cash_received = $4, cash_change = $5,
             cashier_id = $6, paid_at = NOW(),
             amount_charged = total_amount
       WHERE transaction_id = ANY($7)`,
      [groupId, paymentMethod, paymentRef || null,
       cashReceived || null, cashChange, cashierId, transactionIds],
    );

    // 6. Update cashier session (1x untuk total group)
    const amountCol = { CASH: 'total_cash', QRIS: 'total_qris', EDC: 'total_edc', TRANSFER: 'total_transfer' }[paymentMethod] || 'total_cash';
    await client.query(
      `INSERT INTO cashier_sessions (cashier_id, shift_date, txn_count, ${amountCol})
       VALUES ($1, CURRENT_DATE, $2, $3)
       ON CONFLICT (cashier_id, shift_date) DO UPDATE
         SET txn_count    = cashier_sessions.txn_count + $2,
             ${amountCol} = cashier_sessions.${amountCol} + $3`,
      [cashierId, transactionIds.length, totalAmount],
    );

    // 7. Audit log
    await writeAuditLog({
      action: 'GROUP_PAYMENT_PROCESSED', actorId: cashierId, actorRole: 'CASHIER',
      entityType: 'TRANSACTION_GROUP', entityId: groupId,
      newValue: { groupCode: groupCodeResult, transactionIds, paymentMethod, totalAmount, cashChange },
    });

    // 8. Ambil semua tenant yang terlibat untuk notifikasi
    const tenantRes = await client.query(
      `SELECT DISTINCT ten.tenant_id, ten.tenant_name, ten.notification_device_token
       FROM transaction_items ti
       JOIN tenants ten ON ten.tenant_id = ti.tenant_id
       WHERE ti.transaction_id = ANY($1)`,
      [transactionIds],
    );

    return {
      groupId, groupCode: groupCodeResult,
      totalAmount, subtotalAmount, taxAmount, cashChange,
      customerId, customerName,
      transactionIds,
      tenants: tenantRes.rows,
      paidAt: new Date().toISOString(),
    };
  });

  // ── Post-commit: WS + notifikasi ─────────────────────────────────────────────
  if (committed.customerId) {
    try {
      broadcastToCustomer(committed.customerId, {
        event:          'GROUP_ORDER_PAID',
        groupId:        committed.groupId,
        groupCode:      committed.groupCode,
        transactionIds: committed.transactionIds,
        message:        'Pembayaran berhasil. Tunjukkan struk ke masing-masing booth untuk mengambil barang.',
      });
    } catch (e) { logger.warn('WS GROUP_ORDER_PAID customer failed', { error: e.message }); }
  }

  for (const tenant of committed.tenants) {
    try {
      broadcastToTenant(tenant.tenant_id, {
        event:     'ORDER_PAID',
        groupId:   committed.groupId,
        groupCode: committed.groupCode,
        message:   `Group ${committed.groupCode} sudah dibayar — siapkan barang!`,
      });
    } catch (e) { logger.warn('WS tenant ORDER_PAID (group) failed', { error: e.message }); }
    notificationsSvc.sendOrderNotification(tenant, committed.groupId).catch(() => {});
  }

  fireWebhook('/webhook/order-paid', {
    groupId:        committed.groupId,
    transactionIds: committed.transactionIds,
    status:         'PAID',
    totalAmount:    committed.totalAmount,
    paidAt:         committed.paidAt,
  });

  return {
    groupId:     committed.groupId,
    groupCode:   committed.groupCode,
    status:      'PAID',
    paymentMethod,
    totalAmount: committed.totalAmount,
    cashChange:  committed.cashChange,
    paidAt:      committed.paidAt,
    transactionCount: committed.transactionIds.length,
  };
}

/**
 * Proses 1 TRX tunggal sebagai pembayaran cashier (Jalur A).
 * Wrapper tipis di atas payments.service untuk konsistensi endpoint.
 */
async function _processSingleAsCashier({ transactionId, cashierId, paymentMethod, cashReceived, paymentRef }) {
  const paymentsSvc = require('../payments/payments.service');
  return paymentsSvc.processPayment({ transactionId, paymentMethod, cashReceived, paymentRef, cashierId });
}

/**
 * Ambil detail group beserta semua TRX dan item-nya.
 * Digunakan kasir untuk preview sebelum proses, atau helper untuk lookup pickup.
 */
async function getGroupDetail(groupId) {
  const groupRes = await query(
    `SELECT g.*, u.display_name AS cashier_name
     FROM transaction_groups g
     LEFT JOIN users u ON u.user_id = g.cashier_id
     WHERE g.group_id::text = $1 OR g.group_code = $1`,
    [groupId],
  );
  const group = groupRes.rows[0];
  if (!group) throw new AppError('Group transaksi tidak ditemukan.', 404);

  const txnRes = await query(
    `SELECT t.transaction_id, t.status, t.total_amount, t.payment_method,
            t.created_at, t.reserved_at, t.paid_at,
            json_agg(
              json_build_object(
                'product_id',     ti.product_id,
                'product_name',   p.product_name,
                'quantity',       ti.quantity,
                'unit_price',     ti.unit_price,
                'subtotal',       ti.subtotal,
                'pickup_status',  ti.pickup_status,
                'tenant_id',      ti.tenant_id,
                'tenant_name',    ten.tenant_name,
                'booth_location', ten.booth_location
              ) ORDER BY ten.tenant_name
            ) AS items
     FROM transactions t
     JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
     JOIN products p ON p.product_id = ti.product_id
     JOIN tenants ten ON ten.tenant_id = ti.tenant_id
     WHERE t.group_id = $1
     GROUP BY t.transaction_id
     ORDER BY t.created_at ASC`,
    [group.group_id],
  );

  return { ...group, transactions: txnRes.rows };
}

/**
 * List group invoices untuk hari ini (max 100).
 */
async function listGroups() {
  const res = await query(
    `SELECT g.group_id, g.group_code, g.customer_name, g.customer_phone,
            g.total_amount, g.payment_method, g.payment_status, g.created_at,
            u.display_name AS cashier_name,
            COUNT(t.transaction_id)::int AS transaction_count
     FROM transaction_groups g
     LEFT JOIN users u ON u.user_id = g.cashier_id
     LEFT JOIN transactions t ON t.group_id = g.group_id
     WHERE g.created_at >= CURRENT_DATE
     GROUP BY g.group_id, u.display_name
     ORDER BY g.created_at DESC
     LIMIT 100`,
  );
  return res.rows;
}

/**
 * List all EDC transactions for a cashier on a given day.
 * Used for reconciliation against physical EDC machine / bank statement.
 */
async function getEdcLog(cashierId, date) {
  const shiftDate = date || new Date().toISOString().slice(0, 10);
  const params = [shiftDate];
  const cashierFilter = cashierId
    ? (() => { params.push(cashierId); return `AND t.cashier_id = $${params.length}`; })()
    : '';

  const result = await query(
    `SELECT
       t.transaction_id, t.total_amount, t.payment_reference,
       t.paid_at, t.group_id,
       c.full_name AS customer_name,
       u.display_name AS cashier_name,
       tg.group_code
     FROM transactions t
     JOIN customers c ON c.customer_id = t.customer_id
     LEFT JOIN users u ON u.user_id = t.cashier_id
     LEFT JOIN transaction_groups tg ON tg.group_id = t.group_id
     WHERE t.payment_method = 'EDC'
       AND t.status = 'PAID'
       AND DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') = $1
       ${cashierFilter}
     ORDER BY t.paid_at DESC`,
    params
  );
  return result.rows;
}

/**
 * Generate a comprehensive shift handover report for a cashier on a given day.
 * Combines recap summary + EDC log + voucher usage detail — designed for printing.
 */
async function getShiftReport(cashierId, date) {
  const shiftDate = date || new Date().toISOString().slice(0, 10);

  const [recap, transactions, edcLog] = await Promise.all([
    getDailyRecap(cashierId, shiftDate),
    getCashierTransactions(cashierId, shiftDate),
    getEdcLog(cashierId, shiftDate),
  ]);

  const voucherTxns = transactions.filter(t => t.voucher_code);

  return {
    cashier_id:   cashierId,
    shift_date:   shiftDate,
    cashier_name: recap.cashier_name,
    summary:      recap,
    transactions,
    edc_log:      edcLog,
    voucher_txns: voucherTxns,
    generated_at: new Date().toISOString(),
  };
}

/**
 * CR-060: Lookup customer by phone number untuk preview info di kasir POS.
 * Returns { customer_id, full_name, phone_number, email } atau null jika tidak ditemukan.
 */
async function lookupCustomerByPhone(phone) {
  const { rows } = await query(
    `SELECT customer_id, full_name, phone_number, email
     FROM customers
     WHERE phone_number = $1
     LIMIT 1`,
    [phone.trim()],
  );
  return rows[0] || null;
}

module.exports = {
  getDailyRecap,
  getCashierTransactions,
  getPaymentQueue,
  getExpiredQueue,
  getPreorderPaymentQueue,   // CR-053
  createDeleteRequest,
  getPendingDeleteRequests,
  getEdcLog,
  getShiftReport,
  // Group checkout
  getCustomerActiveTrx,
  groupCheckout,
  getGroupDetail,
  listGroups,
  // CR-060
  lookupCustomerByPhone,
};
