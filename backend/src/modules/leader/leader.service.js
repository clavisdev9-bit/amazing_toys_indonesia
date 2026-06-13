'use strict';

const { query, withTransaction } = require('../../config/database');
const { AppError }               = require('../../middlewares/error.middleware');
const { writeAuditLog }          = require('../../utils/auditLog');
const { broadcastToLeaders }     = require('../../ws/websocket');

// ── KPI Dashboard ────────────────────────────────────────────────────────────

async function getDashboardKPIs(date) {
  const d = date || new Date().toISOString().slice(0, 10);
  const [revenue, txnCounts, visitors, topTenants] = await Promise.all([
    // Revenue by payment method today
    query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total_revenue,
             COUNT(*) FILTER (WHERE status = 'PAID') AS paid_count,
             COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count,
             COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_count
      FROM transactions
      WHERE DATE(created_at AT TIME ZONE 'Asia/Jakarta') = $1`, [d]),

    // Payment breakdown
    query(`
      SELECT payment_method, COUNT(*) AS count, SUM(total_amount) AS amount
      FROM transactions
      WHERE status = 'PAID' AND DATE(paid_at AT TIME ZONE 'Asia/Jakarta') = $1
      GROUP BY payment_method`, [d]),

    // Unique visitors today
    query(`
      SELECT COUNT(DISTINCT customer_id) AS visitor_count
      FROM transactions
      WHERE DATE(created_at AT TIME ZONE 'Asia/Jakarta') = $1`, [d]),

    // Top 5 tenants by revenue
    query(`
      SELECT ten.tenant_name, ten.booth_location,
             SUM(ti.subtotal) AS revenue, COUNT(DISTINCT ti.transaction_id) AS orders
      FROM transaction_items ti
      JOIN tenants ten ON ten.tenant_id = ti.tenant_id
      JOIN transactions t ON t.transaction_id = ti.transaction_id
      WHERE t.status = 'PAID' AND DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') = $1
      GROUP BY ten.tenant_id, ten.tenant_name, ten.booth_location
      ORDER BY revenue DESC
      LIMIT 5`, [d]),
  ]);

  return {
    date: d,
    summary: revenue.rows[0],
    paymentBreakdown: txnCounts.rows,
    uniqueVisitors: visitors.rows[0].visitor_count,
    topTenants: topTenants.rows,
  };
}

// ── Sales Report ─────────────────────────────────────────────────────────────

async function getSalesReport({ startDate, endDate, tenantId }) {
  const conditions = [`t.status = 'PAID'`];
  const params = [];

  if (startDate) { params.push(startDate); conditions.push(`DATE(t.paid_at) >= $${params.length}`); }
  if (endDate)   { params.push(endDate);   conditions.push(`DATE(t.paid_at) <= $${params.length}`); }
  if (tenantId)  { params.push(tenantId);  conditions.push(`ti.tenant_id = $${params.length}`); }

  const where = conditions.join(' AND ');

  const result = await query(`
    SELECT ten.tenant_id, ten.tenant_name, ten.booth_location,
           p.product_name, p.category,
           SUM(ti.quantity) AS qty_sold,
           ti.unit_price, SUM(ti.subtotal) AS subtotal
    FROM transaction_items ti
    JOIN transactions t ON t.transaction_id = ti.transaction_id
    JOIN tenants ten ON ten.tenant_id = ti.tenant_id
    JOIN products p ON p.product_id = ti.product_id
    WHERE ${where}
    GROUP BY ten.tenant_id, ten.tenant_name, ten.booth_location, p.product_name, p.category, ti.unit_price
    ORDER BY ten.tenant_name, subtotal DESC`,
    params
  );

  return result.rows;
}

// ── Return / Cancellation Workflow ───────────────────────────────────────────

async function createReturnRequest({ transactionId, requestedBy, reason }) {
  const result = await query(
    `INSERT INTO return_requests (transaction_id, requested_by, reason)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [transactionId, requestedBy, reason]
  );
  return result.rows[0];
}

async function listReturnRequests(status) {
  const where = status ? `WHERE rr.status = $1` : '';
  const params = status ? [status] : [];
  const result = await query(`
    SELECT rr.*, t.total_amount, t.payment_method,
           c.full_name AS customer_name, c.phone_number AS customer_phone,
           u.display_name AS requested_by_name
    FROM return_requests rr
    JOIN transactions t ON t.transaction_id = rr.transaction_id
    JOIN customers c ON c.customer_id = t.customer_id
    JOIN users u ON u.user_id = rr.requested_by
    ${where}
    ORDER BY rr.created_at DESC`,
    params
  );
  return result.rows;
}

async function processReturnRequest({ requestId, leaderId, approved, rejectionNote }) {
  return withTransaction(async (client) => {
    const reqResult = await client.query(
      `SELECT rr.*, t.status AS txn_status FROM return_requests rr
       JOIN transactions t ON t.transaction_id = rr.transaction_id
       WHERE rr.request_id = $1 FOR UPDATE`,
      [requestId]
    );
    const req = reqResult.rows[0];
    if (!req) throw new AppError('Return request tidak ditemukan.', 404);
    if (req.status !== 'PENDING') throw new AppError('Request sudah diproses.');

    const newStatus = approved ? 'APPROVED' : 'REJECTED';

    await client.query(
      `UPDATE return_requests SET status = $1, processed_by = $2,
              rejection_note = $3, processed_at = NOW()
       WHERE request_id = $4`,
      [newStatus, leaderId, rejectionNote || null, requestId]
    );

    if (approved) {
      // Restore stock and cancel transaction
      const items = await client.query(
        `SELECT product_id, quantity FROM transaction_items WHERE transaction_id = $1`,
        [req.transaction_id]
      );
      for (const item of items.rows) {
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2`,
          [item.quantity, item.product_id]
        );
      }
      await client.query(
        `UPDATE transactions SET status = 'CANCELLED', cancelled_at = NOW(),
                cancellation_reason = 'Return approved by Leader'
         WHERE transaction_id = $1`,
        [req.transaction_id]
      );
    }

    await writeAuditLog({
      action: approved ? 'RETURN_APPROVED' : 'RETURN_REJECTED',
      actorId: leaderId, actorRole: 'LEADER',
      entityType: 'RETURN_REQUEST', entityId: requestId,
      newValue: { status: newStatus, rejectionNote },
    });

    return { requestId, status: newStatus };
  });
}

// ── Visitor Report ───────────────────────────────────────────────────────────

async function getVisitorReport({ startDate, endDate }) {
  const conditions = [];
  const params = [];
  if (startDate) { params.push(startDate); conditions.push(`DATE(c.registered_at) >= $${params.length}`); }
  if (endDate)   { params.push(endDate);   conditions.push(`DATE(c.registered_at) <= $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(`
    SELECT DATE(c.registered_at AT TIME ZONE 'Asia/Jakarta') AS date,
           c.gender,
           COUNT(*) AS count
    FROM customers c
    ${where}
    GROUP BY DATE(c.registered_at AT TIME ZONE 'Asia/Jakarta'), c.gender
    ORDER BY date DESC`,
    params
  );
  return result.rows;
}

// ── Item Delete Approval Workflow ────────────────────────────────────────────

/**
 * List delete requests, default to PENDING.
 */
async function listDeleteRequests(status = 'PENDING') {
  const result = await query(
    `SELECT request_id, transaction_id, product_id, product_name, qty, subtotal,
            cashier_id, cashier_name, status, reason, reviewed_by, created_at, reviewed_at
     FROM item_delete_requests
     WHERE status = $1
     ORDER BY created_at ASC`,
    [status],
  );
  return result.rows;
}

/**
 * Approve or reject a delete request.
 * On approval with transaction_id: removes the item from transaction_items
 * and recalculates the transaction total.
 */
async function reviewDeleteRequest(requestId, leaderId, action, reason) {
  return withTransaction(async (client) => {
    const reqRes = await client.query(
      `SELECT * FROM item_delete_requests WHERE request_id = $1 FOR UPDATE`,
      [requestId],
    );
    const req = reqRes.rows[0];
    if (!req) throw new AppError('Permintaan hapus tidak ditemukan.', 404);
    if (req.status !== 'PENDING') throw new AppError('Permintaan sudah diproses.', 409);

    // FIX 1: Block approval on PAID transactions to prevent post-payment fraud
    if (action === 'approve' && req.transaction_id) {
      const txnCheck = await client.query(
        `SELECT status FROM transactions WHERE transaction_id = $1`,
        [req.transaction_id],
      );
      if (txnCheck.rows.length > 0 && txnCheck.rows[0].status === 'PAID') {
        // FIX 4: Broadcast fraud alert to all online leaders before rejecting
        broadcastToLeaders({
          event: 'fraud_alert:delete_on_paid',
          data: {
            cashier_id:     req.cashier_id,
            cashier_name:   req.cashier_name,
            transaction_id: req.transaction_id,
            product_name:   req.product_name,
            qty:            req.qty,
            subtotal:       req.subtotal,
            attempted_at:   new Date(),
          },
        });
        throw new AppError('Tidak dapat menghapus item dari transaksi yang sudah dibayar.', 409);
      }
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    await client.query(
      `UPDATE item_delete_requests
       SET status = $1, reviewed_by = $2, reason = $3, reviewed_at = NOW()
       WHERE request_id = $4`,
      [newStatus, leaderId, reason || null, requestId],
    );

    // If approved and the request is tied to an existing transaction, remove the item
    if (action === 'approve' && req.transaction_id) {
      // BUG-058: block if this is the last non-rejected item — recalculate would produce
      // total_amount = 0, violating transactions_total_amount_check (total_amount > 0).
      const remainingRes = await client.query(
        `SELECT COUNT(*) AS cnt
         FROM transaction_items
         WHERE transaction_id = $1
           AND approval_status != 'REJECTED'
           AND product_id != $2`,
        [req.transaction_id, req.product_id],
      );
      if (parseInt(remainingRes.rows[0].cnt, 10) === 0) {
        throw new AppError(
          'Tidak dapat menghapus semua item dari transaksi. Batalkan transaksi terlebih dahulu jika tidak ada item yang tersisa.',
          422,
        );
      }

      // Restore stock — item is leaving the transaction so stock comes back
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2`,
        [req.qty, req.product_id],
      );

      await client.query(
        `DELETE FROM transaction_items
         WHERE transaction_id = $1 AND product_id = $2`,
        [req.transaction_id, req.product_id],
      );
      // Recalculate subtotal, tax, and total from remaining items
      await client.query(
        `UPDATE transactions t
         SET subtotal_amount = COALESCE(sub.s, 0),
             tax_amount      = ROUND(COALESCE(sub.s, 0) * t.tax_rate / 100),
             total_amount    = COALESCE(sub.s, 0) + ROUND(COALESCE(sub.s, 0) * t.tax_rate / 100)
         FROM (
           SELECT COALESCE(SUM(subtotal), 0) AS s
           FROM transaction_items
           WHERE transaction_id = $1 AND approval_status != 'REJECTED'
         ) sub
         WHERE t.transaction_id = $1`,
        [req.transaction_id],
      );
    }

    return { request_id: requestId, status: newStatus, cashier_id: req.cashier_id, product_id: req.product_id };
  });
}

// ── FIX 5: Discrepancy Check ─────────────────────────────────────────────────

/**
 * Return PAID transactions where amount_charged differs from current total_amount.
 * Indicates an item was removed after payment — possible fraud indicator.
 */
async function getDiscrepancies(date) {
  const d = date || new Date().toLocaleString('sv', { timeZone: 'Asia/Jakarta' }).slice(0, 10);
  const result = await query(
    `SELECT t.transaction_id,
            t.amount_charged,
            t.total_amount,
            (t.amount_charged - t.total_amount) AS difference,
            u.display_name AS cashier_name,
            t.paid_at
     FROM transactions t
     LEFT JOIN users u ON u.user_id = t.cashier_id
     WHERE t.status = 'PAID'
       AND t.amount_charged IS NOT NULL
       AND t.amount_charged <> t.total_amount
       AND DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') = $1
     ORDER BY t.paid_at DESC`,
    [d],
  );
  return result.rows;
}

module.exports = {
  getDashboardKPIs, getSalesReport,
  createReturnRequest, listReturnRequests, processReturnRequest,
  getVisitorReport,
  listDeleteRequests, reviewDeleteRequest,
  getDiscrepancies,
};
