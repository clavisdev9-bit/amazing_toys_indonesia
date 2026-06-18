'use strict';

/**
 * bulkUpload.controller.js
 *
 * POST /api/v1/admin/products/bulk-upload
 * Body: { products: ProductRow[] }
 *
 * Field mapping (from Excel):
 *   product_id      — opsional, auto-generate jika kosong
 *   barcode         — WAJIB
 *   product_name    — WAJIB
 *   category        — WAJIB
 *   price           — WAJIB (angka >= 0)
 *   tenant          — WAJIB (Nama Booth / Tenant — di-resolve ke tenant_id)
 *   stock_quantity  — opsional (default 0)
 *   odoo_categ_name — opsional
 *   description     — opsional
 *
 * Behavior: PARTIAL UPLOAD
 *   - Baris valid   → diinsert ke DB
 *   - Baris invalid → dikembalikan di response.failed (dengan alasan)
 *   - Tidak pernah abort total karena sebagian baris bermasalah
 */

const { withTransaction, query } = require('../../config/database');

const REQUIRED_FIELDS = ['barcode', 'product_name', 'category', 'price', 'tenant'];

function validateRow(row, rowNumber, tenantMap, barcodesInBatch) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || String(row[field]).trim() === '') {
      errors.push(`${field} wajib diisi`);
    }
  }

  if (row.price !== undefined && String(row.price).trim() !== '') {
    const p = parseFloat(row.price);
    if (isNaN(p) || p < 0) errors.push('price harus berupa angka >= 0');
  }

  // Resolve tenant name → tenant_id
  const tenantKey = String(row.tenant || '').trim().toLowerCase();
  const tenantId  = tenantMap.get(tenantKey);
  if (row.tenant && tenantKey && !tenantId) {
    errors.push(`Tenant "${row.tenant}" tidak ditemukan atau tidak aktif`);
  }

  // Duplicate barcode within batch (flag as invalid)
  const bc = String(row.barcode || '').trim();
  if (bc && barcodesInBatch.filter(b => b === bc).length > 1) {
    errors.push(`Barcode "${bc}" duplikat dalam file`);
  }

  return { errors, tenantId: tenantId || null };
}

function resolveBoolean(val, defaultVal = true) {
  if (typeof val === 'boolean') return val;
  if (val === undefined || val === null || val === '') return defaultVal;
  const s = String(val).trim().toLowerCase();
  return !['false', '0', 'no'].includes(s);
}

/**
 * POST /api/v1/admin/products/bulk-upload
 */
async function bulkUploadProducts(req, res, next) {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'products harus berupa array tidak kosong.',
      });
    }

    if (products.length > 1000) {
      return res.status(400).json({
        success: false,
        message: `Maksimal 1.000 produk per upload. File ini berisi ${products.length} baris.`,
      });
    }

    // ── Build tenant lookup map (name → tenant_id, case-insensitive) ──────────
    const tenantRes = await query(
      'SELECT tenant_id, tenant_name, booth_location FROM tenants WHERE is_active = TRUE'
    );
    const tenantMap = new Map();
    for (const t of tenantRes.rows) {
      tenantMap.set(t.tenant_name.trim().toLowerCase(),    t.tenant_id);
      tenantMap.set(t.booth_location.trim().toLowerCase(), t.tenant_id);
    }

    // ── Validate each row individually ────────────────────────────────────────
    const barcodesInBatch = products.map(p => String(p.barcode || '').trim());

    // Also check barcodes already in DB
    const uniqueBarcodes = [...new Set(barcodesInBatch.filter(Boolean))];
    let existingBarcodes = new Set();
    if (uniqueBarcodes.length > 0) {
      const placeholders = uniqueBarcodes.map((_, i) => `$${i + 1}`).join(', ');
      const dbRes = await query(
        `SELECT barcode FROM products WHERE barcode IN (${placeholders})`,
        uniqueBarcodes
      );
      existingBarcodes = new Set(dbRes.rows.map(r => r.barcode));
    }

    const validRows   = [];
    const failedRows  = [];

    for (let i = 0; i < products.length; i++) {
      const row    = products[i];
      const rowNum = i + 1;

      const { errors, tenantId } = validateRow(row, rowNum, tenantMap, barcodesInBatch);

      // Extra check: barcode already exists in DB
      const bc = String(row.barcode || '').trim();
      if (bc && existingBarcodes.has(bc)) {
        errors.push(`Barcode "${bc}" sudah ada di database`);
      }

      if (errors.length > 0) {
        failedRows.push({ row_number: rowNum, data: row, errors });
      } else {
        validRows.push({ ...row, _rowNum: rowNum, _tenantId: tenantId });
      }
    }

    // ── Insert valid rows in one transaction ──────────────────────────────────
    let inserted = 0;
    const insertErrors = [];

    if (validRows.length > 0) {
      await withTransaction(async (client) => {
        for (let i = 0; i < validRows.length; i++) {
          const p = validRows[i];

          const productId = (p.product_id || '').trim()
            || `PB${String(p._rowNum).padStart(4, '0')}-${p._tenantId}`;

          try {
            await client.query(
              `INSERT INTO products
                 (product_id, product_name, category, price, tenant_id,
                  barcode, stock_quantity, description, odoo_categ_name, is_active,
                  is_on_hold, is_display_only, is_preorder)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
              [
                productId,
                String(p.product_name).trim(),
                String(p.category).trim(),
                parseFloat(p.price),
                p._tenantId,
                String(p.barcode).trim(),
                parseInt(p.stock_quantity) || 0,
                p.description?.trim()     || null,
                p.odoo_categ_name?.trim() || null,
                resolveBoolean(p.is_active, true),
                false,
                false,
                false,
              ]
            );
            inserted++;
          } catch (rowErr) {
            // Row-level DB error (e.g. duplicate product_id) — don't abort entire batch
            let msg = rowErr.message;
            if (rowErr.code === '23505') {
              const m = (rowErr.detail || '').match(/\(([^)]+)\)=\(([^)]+)\)/);
              msg = `Duplikat ${m?.[1] || 'kolom'}: "${m?.[2] || ''}" sudah ada`;
            }
            insertErrors.push({ row_number: p._rowNum, data: p, errors: [msg] });
          }
        }
      });
    }

    const allFailed = [...failedRows, ...insertErrors];

    res.json({
      success:  true,
      inserted,
      failed:   allFailed.length,
      details: {
        failed: allFailed,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { bulkUploadProducts };
