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
 * Get list of transactions processed by a cashier on a given day.
 */
async function getCashierTransactions(date) {
  const shiftDate = date || new Date().toLocaleString('sv', { timeZone: 'Asia/Jakarta' }).slice(0, 10);
  const result = await query(
    `SELECT t.transaction_id, t.status, t.total_amount, t.payment_method, t.paid_at,
            c.full_name AS customer_name
     FROM transactions t
     JOIN customers c ON c.customer_id = t.customer_id
     WHERE DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') = $1
       AND t.status = 'PAID'
     ORDER BY t.paid_at DESC`,
    [shiftDate]
  );
  return result.rows;
}

module.exports = { getDailyRecap, getCashierTransactions };
