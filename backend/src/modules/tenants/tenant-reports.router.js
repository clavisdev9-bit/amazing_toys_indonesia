'use strict';

const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { query } = require('../../config/database');
const { AppError } = require('../../middlewares/error.middleware');

const router = express.Router();
const tenantAuth = [authenticate, authorize('TENANT', 'LEADER', 'ADMIN')];

// ── Shared date validation helper ──────────────────────────────────────────────

function parseDateParams(req) {
  const { date_from, date_to } = req.query;
  if (!date_from || !date_to) {
    throw new AppError('Parameter date_from dan date_to wajib diisi.', 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date_from) || !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
    throw new AppError('Format tanggal harus YYYY-MM-DD.', 400);
  }
  if (date_from > date_to) {
    throw new AppError('Invalid date range', 400);
  }
  return { dateFrom: date_from, dateTo: date_to };
}

/**
 * GET /api/v1/tenant-reports/produk
 * Detail penjualan per produk dalam rentang tanggal
 */
router.get('/produk', ...tenantAuth, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { dateFrom, dateTo } = parseDateParams(req);

    const [tenantResult, salesResult] = await Promise.all([
      query('SELECT tenant_name FROM tenants WHERE tenant_id = $1', [tenantId]),
      query(
        `SELECT
           p.product_name,
           p.category,
           p.price,
           SUM(ti.quantity)::INTEGER   AS qty_sold,
           SUM(ti.subtotal)            AS total
         FROM transaction_items ti
         JOIN products p    ON p.product_id    = ti.product_id
         JOIN transactions t ON t.transaction_id = ti.transaction_id
         WHERE ti.tenant_id = $1
           AND t.status = 'PAID'
           AND DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $2 AND $3
         GROUP BY p.product_id, p.product_name, p.category, p.price
         ORDER BY p.product_name ASC`,
        [tenantId, dateFrom, dateTo]
      ),
    ]);

    res.json({
      success: true,
      data: {
        tenantName: tenantResult.rows[0]?.tenant_name ?? '',
        items: salesResult.rows.map((r) => ({
          productName: r.product_name,
          category:    r.category,
          qtySold:     r.qty_sold,
          price:       Number(r.price),
          total:       Number(r.total),
        })),
      },
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/tenant-reports/harian
 * Penjualan harian (per tanggal) dalam rentang tanggal
 */
router.get('/harian', ...tenantAuth, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { dateFrom, dateTo } = parseDateParams(req);

    const result = await query(
      `SELECT
         DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta')::TEXT  AS date,
         COUNT(DISTINCT t.transaction_id)::INTEGER           AS total_transaksi,
         SUM(ti.subtotal)                                    AS revenue
       FROM transaction_items ti
       JOIN transactions t ON t.transaction_id = ti.transaction_id
       WHERE ti.tenant_id = $1
         AND t.status = 'PAID'
         AND DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $2 AND $3
       GROUP BY DATE(t.paid_at AT TIME ZONE 'Asia/Jakarta')
       ORDER BY date ASC`,
      [tenantId, dateFrom, dateTo]
    );

    res.json({
      success: true,
      data: result.rows.map((r) => ({
        date:           r.date,
        totalTransaksi: r.total_transaksi,
        revenue:        Number(r.revenue),
      })),
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/tenant-reports/stok
 * Live stock status for the authenticated tenant's products.
 * Tenant isolation enforced at DB query level via JWT tenantId — never exposed as a URL param.
 */
router.get('/stok', ...tenantAuth, async (req, res, next) => {
  try {
    const tenantId       = req.user.tenantId;
    const includeInactive = req.query.include_inactive === 'true';
    const search          = req.query.search?.trim() ?? '';

    const params = [tenantId];
    const conditions = ['p.tenant_id = $1'];

    if (!includeInactive) conditions.push('p.is_active = TRUE');

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(p.product_name ILIKE $${params.length} OR p.product_id ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`,
      );
    }

    const [tenantResult, productsResult] = await Promise.all([
      query('SELECT tenant_name FROM tenants WHERE tenant_id = $1', [tenantId]),
      query(
        `SELECT
           p.product_id,
           p.product_name,
           p.category,
           p.price,
           p.stock_quantity,
           p.stock_status,
           p.image_url,
           p.is_active,
           p.updated_at
         FROM products p
         WHERE ${conditions.join(' AND ')}
         ORDER BY p.product_name ASC`,
        params,
      ),
    ]);

    res.json({
      success: true,
      data: {
        tenantName: tenantResult.rows[0]?.tenant_name ?? '',
        items: productsResult.rows.map((r) => ({
          productId:     r.product_id,
          productName:   r.product_name,
          category:      r.category,
          price:         Number(r.price),
          stockQuantity: r.stock_quantity,
          stockStatus:   r.stock_status,
          imageUrl:      r.image_url ?? null,
          isActive:      r.is_active,
          updatedAt:     r.updated_at,
        })),
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
