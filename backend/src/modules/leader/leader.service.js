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
      // Recalculate subtotal and total from remaining items (no tax)
      await client.query(
        `UPDATE transactions t
         SET subtotal_amount = COALESCE(sub.s, 0),
             tax_amount      = 0,
             total_amount    = COALESCE(sub.s, 0)
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

// ── Top Customers ────────────────────────────────────────────────────────────

async function getTopCustomers({ dateFrom, dateTo, limit = 10 }) {
  const result = await query(
    `SELECT
       COALESCE(c.full_name, t.customer_phone, 'Walk-in')   AS customer_name,
       COALESCE(c.phone_number, t.customer_phone, '-')       AS phone,
       COUNT(DISTINCT t.transaction_id)::INTEGER              AS total_transaksi,
       SUM(ti.quantity)::INTEGER                              AS total_item,
       SUM(t.total_amount)                                    AS total_belanja,
       ROUND(AVG(t.total_amount))                             AS avg_belanja,
       MAX(t.paid_at)                                         AS last_purchase
     FROM transactions t
     LEFT JOIN customers c   ON c.customer_id = t.customer_id
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
     WHERE t.status = 'PAID'
       AND DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2
     GROUP BY c.customer_id, c.full_name, c.phone_number, t.customer_phone
     ORDER BY total_belanja DESC
     LIMIT $3`,
    [dateFrom, dateTo, limit]
  );

  return result.rows.map((r, i) => ({
    rank:          i + 1,
    customerName:  r.customer_name,
    phone:         r.phone,
    totalTransaksi: r.total_transaksi,
    totalItem:     r.total_item,
    totalBelanja:  Number(r.total_belanja),
    avgBelanja:    Number(r.avg_belanja),
    lastPurchase:  r.last_purchase,
  }));
}

// ── R-02: Revenue Per Tenant Ranking ────────────────────────────────────────

async function getTenantRanking({ dateFrom, dateTo }) {
  const result = await query(
    `SELECT
       ten.tenant_id,
       ten.tenant_name,
       ten.booth_location,
       COUNT(DISTINCT t.transaction_id)::INTEGER   AS total_transaksi,
       SUM(ti.subtotal)                             AS revenue,
       SUM(ti.quantity)::INTEGER                    AS total_item,
       ROUND(AVG(t.total_amount))                   AS avg_order_value
     FROM transaction_items ti
     JOIN tenants ten ON ten.tenant_id = ti.tenant_id
     JOIN transactions t ON t.transaction_id = ti.transaction_id
     WHERE t.status = 'PAID'
       AND DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2
     GROUP BY ten.tenant_id, ten.tenant_name, ten.booth_location
     ORDER BY revenue DESC`,
    [dateFrom, dateTo]
  );
  const rows = result.rows.map((r, i) => ({
    rank:           i + 1,
    tenantId:       r.tenant_id,
    tenantName:     r.tenant_name,
    boothLocation:  r.booth_location,
    totalTransaksi: r.total_transaksi,
    revenue:        Number(r.revenue),
    totalItem:      r.total_item,
    avgOrderValue:  Number(r.avg_order_value),
  }));
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  return { rows, totalRevenue };
}

// ── R-03: Payment Settlement ─────────────────────────────────────────────────

async function getSettlementReport({ dateFrom, dateTo }) {
  const [breakdown, pending, daily] = await Promise.all([
    query(
      `SELECT
         COALESCE(payment_method, 'UNKNOWN') AS payment_method,
         COUNT(*)::INTEGER                   AS count,
         SUM(total_amount)                   AS amount
       FROM transactions
       WHERE status = 'PAID'
         AND DATE(paid_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2
       GROUP BY payment_method
       ORDER BY amount DESC`,
      [dateFrom, dateTo]
    ),
    query(
      `SELECT
         COUNT(*)::INTEGER        AS pending_count,
         COALESCE(SUM(total_amount), 0) AS pending_amount
       FROM transactions
       WHERE status IN ('PENDING', 'RESERVED', 'WAITING_PAYMENT')
         AND DATE(created_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2`,
      [dateFrom, dateTo]
    ),
    query(
      `SELECT
         DATE(paid_at AT TIME ZONE 'Asia/Jakarta')::TEXT AS date,
         COUNT(*)::INTEGER                                AS count,
         SUM(total_amount)                                AS amount
       FROM transactions
       WHERE status = 'PAID'
         AND DATE(paid_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2
       GROUP BY DATE(paid_at AT TIME ZONE 'Asia/Jakarta')
       ORDER BY date ASC`,
      [dateFrom, dateTo]
    ),
  ]);

  const totalPaid   = breakdown.rows.reduce((s, r) => s + Number(r.amount), 0);
  const totalTxn    = breakdown.rows.reduce((s, r) => s + r.count, 0);

  return {
    breakdown: breakdown.rows.map((r) => ({
      paymentMethod: r.payment_method,
      count:         r.count,
      amount:        Number(r.amount),
    })),
    pending: {
      count:  pending.rows[0].pending_count,
      amount: Number(pending.rows[0].pending_amount),
    },
    daily: daily.rows.map((r) => ({
      date:   r.date,
      count:  r.count,
      amount: Number(r.amount),
    })),
    totalPaid,
    totalTxn,
  };
}

// ── R-04: Voucher Usage Report ───────────────────────────────────────────────

async function getVoucherReport({ dateFrom, dateTo }) {
  const [summary, detail] = await Promise.all([
    query(
      `SELECT
         COUNT(*)::INTEGER             AS total_usage,
         COALESCE(SUM(vu.discount_amount), 0) AS total_discount
       FROM voucher_usages vu
       WHERE DATE(vu.used_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2`,
      [dateFrom, dateTo]
    ),
    query(
      `SELECT
         v.code,
         v.description,
         v.discount_type,
         v.discount_value,
         COUNT(vu.id)::INTEGER         AS usage_count,
         SUM(vu.discount_amount)       AS total_discount,
         MIN(vu.used_at)               AS first_used,
         MAX(vu.used_at)               AS last_used
       FROM vouchers v
       LEFT JOIN voucher_usages vu
         ON vu.voucher_code = v.code
         AND DATE(vu.used_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2
       GROUP BY v.id, v.code, v.description, v.discount_type, v.discount_value
       HAVING COUNT(vu.id) > 0
       ORDER BY usage_count DESC`,
      [dateFrom, dateTo]
    ),
  ]);

  return {
    summary: {
      totalUsage:    summary.rows[0].total_usage,
      totalDiscount: Number(summary.rows[0].total_discount),
    },
    vouchers: detail.rows.map((r) => ({
      code:          r.code,
      description:   r.description,
      discountType:  r.discount_type,
      discountValue: Number(r.discount_value),
      usageCount:    r.usage_count,
      totalDiscount: Number(r.total_discount),
      firstUsed:     r.first_used,
      lastUsed:      r.last_used,
    })),
  };
}

// ── R-06: Top Products (all tenants) ────────────────────────────────────────

async function getTopProducts({ dateFrom, dateTo, tenantId, limit = 20 }) {
  const conditions = [
    `t.status = 'PAID'`,
    `DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2`,
  ];
  const params = [dateFrom, dateTo];

  if (tenantId) {
    params.push(tenantId);
    conditions.push(`ti.tenant_id = $${params.length}`);
  }

  const result = await query(
    `SELECT
       p.product_id,
       p.product_name,
       p.category,
       ten.tenant_name,
       SUM(ti.quantity)::INTEGER   AS qty_sold,
       ti.unit_price               AS price,
       SUM(ti.subtotal)            AS revenue
     FROM transaction_items ti
     JOIN transactions t  ON t.transaction_id  = ti.transaction_id
     JOIN products p      ON p.product_id       = ti.product_id
     JOIN tenants ten     ON ten.tenant_id       = ti.tenant_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.product_id, p.product_name, p.category, ten.tenant_name, ti.unit_price
     ORDER BY revenue DESC
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );

  return result.rows.map((r, i) => ({
    rank:        i + 1,
    productId:   r.product_id,
    productName: r.product_name,
    category:    r.category,
    tenantName:  r.tenant_name,
    qtySold:     r.qty_sold,
    price:       Number(r.price),
    revenue:     Number(r.revenue),
  }));
}

// ── R-07: Conversion Rate ────────────────────────────────────────────────────

async function getConversionRate({ dateFrom, dateTo }) {
  const result = await query(
    `SELECT
       DATE(created_at AT TIME ZONE 'Asia/Jakarta')::TEXT AS date,
       COUNT(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL) AS visitors,
       COUNT(DISTINCT customer_id) FILTER (WHERE status = 'PAID' AND customer_id IS NOT NULL) AS buyers,
       COUNT(*) FILTER (WHERE status = 'PAID')::INTEGER AS paid_txn,
       COUNT(*)::INTEGER                                  AS total_txn
     FROM transactions
     WHERE DATE(created_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2
     GROUP BY DATE(created_at AT TIME ZONE 'Asia/Jakarta')
     ORDER BY date ASC`,
    [dateFrom, dateTo]
  );

  const rows = result.rows.map((r) => {
    const visitors = parseInt(r.visitors) || 0;
    const buyers   = parseInt(r.buyers)   || 0;
    return {
      date:           r.date,
      visitors,
      buyers,
      paidTxn:        r.paid_txn,
      totalTxn:       r.total_txn,
      conversionRate: visitors > 0 ? Math.round((buyers / visitors) * 100) : 0,
    };
  });

  const totalVisitors = rows.reduce((s, r) => s + r.visitors, 0);
  const totalBuyers   = rows.reduce((s, r) => s + r.buyers,   0);
  return {
    rows,
    overall: {
      visitors:       totalVisitors,
      buyers:         totalBuyers,
      conversionRate: totalVisitors > 0 ? Math.round((totalBuyers / totalVisitors) * 100) : 0,
    },
  };
}

// ── R-08: Helper Performance ─────────────────────────────────────────────────

async function getHelperPerformance({ dateFrom, dateTo }) {
  const result = await query(
    `SELECT
       u.user_id,
       u.display_name,
       COUNT(DISTINCT t.transaction_id)::INTEGER                          AS total_order,
       COUNT(DISTINCT t.transaction_id) FILTER (WHERE t.status = 'PAID')::INTEGER AS paid_order,
       COALESCE(SUM(t.total_amount) FILTER (WHERE t.status = 'PAID'), 0) AS revenue,
       COUNT(DISTINCT t.transaction_id) FILTER (WHERE t.status = 'CANCELLED')::INTEGER AS cancelled_order
     FROM users u
     JOIN transactions t ON t.created_by_user = u.user_id
     WHERE u.role = 'HELPER'
       AND DATE(t.created_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2
     GROUP BY u.user_id, u.display_name
     ORDER BY revenue DESC`,
    [dateFrom, dateTo]
  );

  return result.rows.map((r) => ({
    userId:         r.user_id,
    displayName:    r.display_name,
    totalOrder:     r.total_order,
    paidOrder:      r.paid_order,
    cancelledOrder: r.cancelled_order,
    revenue:        Number(r.revenue),
    successRate:    r.total_order > 0
      ? Math.round((r.paid_order / r.total_order) * 100)
      : 0,
  }));
}

// ── R-10: Tax Report ─────────────────────────────────────────────────────────

async function getTaxReport({ dateFrom, dateTo }) {
  const [byRate, daily] = await Promise.all([
    query(
      `SELECT
         tax_rate,
         COUNT(*)::INTEGER        AS txn_count,
         SUM(subtotal_amount)     AS subtotal,
         SUM(tax_amount)          AS tax_amount,
         SUM(total_amount)        AS total_amount
       FROM transactions
       WHERE status = 'PAID'
         AND DATE(paid_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2
       GROUP BY tax_rate
       ORDER BY tax_rate ASC`,
      [dateFrom, dateTo]
    ),
    query(
      `SELECT
         DATE(paid_at AT TIME ZONE 'Asia/Jakarta')::TEXT AS date,
         SUM(subtotal_amount)     AS subtotal,
         SUM(tax_amount)          AS tax_amount,
         SUM(total_amount)        AS total_amount
       FROM transactions
       WHERE status = 'PAID'
         AND DATE(paid_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2
       GROUP BY DATE(paid_at AT TIME ZONE 'Asia/Jakarta')
       ORDER BY date ASC`,
      [dateFrom, dateTo]
    ),
  ]);

  return {
    byRate: byRate.rows.map((r) => ({
      taxRate:     Number(r.tax_rate),
      txnCount:    r.txn_count,
      subtotal:    Number(r.subtotal),
      taxAmount:   Number(r.tax_amount),
      totalAmount: Number(r.total_amount),
    })),
    daily: daily.rows.map((r) => ({
      date:        r.date,
      subtotal:    Number(r.subtotal),
      taxAmount:   Number(r.tax_amount),
      totalAmount: Number(r.total_amount),
    })),
    totals: {
      subtotal:    byRate.rows.reduce((s, r) => s + Number(r.subtotal),    0),
      taxAmount:   byRate.rows.reduce((s, r) => s + Number(r.tax_amount),  0),
      totalAmount: byRate.rows.reduce((s, r) => s + Number(r.total_amount),0),
    },
  };
}

module.exports = {
  getDashboardKPIs, getSalesReport,
  getTopCustomers,
  createReturnRequest, listReturnRequests, processReturnRequest,
  getVisitorReport,
  listDeleteRequests, reviewDeleteRequest,
  getDiscrepancies,
  getTenantRanking,
  getSettlementReport,
  getVoucherReport,
  getTopProducts,
  getConversionRate,
  getHelperPerformance,
  getTaxReport,
};
