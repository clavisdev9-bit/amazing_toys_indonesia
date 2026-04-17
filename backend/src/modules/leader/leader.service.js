'use strict';

const { query, withTransaction } = require('../../config/database');
const { AppError }               = require('../../middlewares/error.middleware');
const { writeAuditLog }          = require('../../utils/auditLog');

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

module.exports = {
  getDashboardKPIs, getSalesReport,
  createReturnRequest, listReturnRequests, processReturnRequest,
  getVisitorReport,
};
