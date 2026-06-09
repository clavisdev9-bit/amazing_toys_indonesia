'use strict';

const { query } = require('../../config/database');

/**
 * Get cashier's daily session recap.
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

  return { ...session, grand_total: grandTotal };
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
    `SELECT t.transaction_id, t.status, t.total_amount, t.payment_method, t.paid_at,
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
 * List orders waiting for payment (RESERVED + PENDING), sorted by created_at ASC.
 * Used by cashier queue view in Model C flow.
 */
async function getPaymentQueue(date) {
  const shiftDate = date || new Date().toLocaleString('sv', { timeZone: 'Asia/Jakarta' }).slice(0, 10);
  const result = await query(
    `SELECT t.transaction_id, t.status, t.total_amount, t.created_at, t.reserved_at,
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
       AND DATE(t.created_at AT TIME ZONE 'Asia/Jakarta') = $1
     GROUP BY t.transaction_id, c.full_name, c.phone_number, ten.tenant_name, ten.booth_location
     ORDER BY t.created_at ASC`,
    [shiftDate],
  );
  return result.rows;
}

module.exports = { getDailyRecap, getCashierTransactions, getPaymentQueue };
