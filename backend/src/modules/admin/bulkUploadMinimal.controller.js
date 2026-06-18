'use strict';

/**
 * bulkUploadMinimal.controller.js
 *
 * POST /api/v1/admin/products/bulk-upload-minimal
 * Body: { products: MinimalRow[] }
 *
 * FASE 1 — Buat produk dengan data minimal:
 *   barcode       * WAJIB (primary key lookup di fase berikutnya)
 *   product_name  * WAJIB
 *   category      * WAJIB
 *   price         * WAJIB
 *
 * tenant_id = NULL (diisi di Fase 2 via bulk-update-stock-tenant)
 * stock_quantity = 0 (diisi di Fase 2)
 *
 * Behavior: PARTIAL UPLOAD
 *   - Baris valid   → INSERT
 *   - Baris invalid → dikembalikan di response.failed
 */

const { withTransaction, query } = require('../../config/database');

const REQUIRED = ['barcode', 'product_name', 'category', 'price'];

function validateRow(row, barcodesInBatch) {
  const errors = [];

  for (const f of REQUIRED) {
    if (!row[f] || String(row[f]).trim() === '') {
      errors.push(`${f} wajib diisi`);
    }
  }

  if (row.price && String(row.price).trim() !== '') {
    const p = parseFloat(row.price);
    if (isNaN(p) || p < 0) errors.push('price harus berupa angka >= 0');
  }

  const bc = String(row.barcode || '').trim();
  if (bc && barcodesInBatch.filter(b => b === bc).length > 1) {
    errors.push(`Barcode "${bc}" duplikat dalam file`);
  }

  return errors;
}

async function bulkUploadMinimal(req, res, next) {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: 'products harus berupa array tidak kosong.' });
    }
    if (products.length > 1000) {
      return res.status(400).json({ success: false, message: `Maksimal 1.000 produk per upload.` });
    }

    const barcodesInBatch = products.map(p => String(p.barcode || '').trim());

    // Check barcodes already in DB
    const uniqueBarcodes = [...new Set(barcodesInBatch.filter(Boolean))];
    let existingBarcodes = new Set();
    if (uniqueBarcodes.length > 0) {
      const ph  = uniqueBarcodes.map((_, i) => `$${i + 1}`).join(', ');
      const res = await query(`SELECT barcode FROM products WHERE barcode IN (${ph})`, uniqueBarcodes);
      existingBarcodes = new Set(res.rows.map(r => r.barcode));
    }

    const validRows  = [];
    const failedRows = [];

    for (let i = 0; i < products.length; i++) {
      const row    = products[i];
      const rowNum = i + 1;
      const errors = validateRow(row, barcodesInBatch);

      const bc = String(row.barcode || '').trim();
      if (bc && existingBarcodes.has(bc)) {
        errors.push(`Barcode "${bc}" sudah ada di database`);
      }

      if (errors.length > 0) {
        failedRows.push({ row_number: rowNum, data: row, errors });
      } else {
        validRows.push({ ...row, _rowNum: rowNum });
      }
    }

    let inserted     = 0;
    const insertErrors = [];

    if (validRows.length > 0) {
      await withTransaction(async (client) => {
        for (const p of validRows) {
          const productId = (p.product_id || '').trim()
            || `PB${String(p._rowNum).padStart(4, '0')}-UNASSIGNED`;

          try {
            await client.query(
              `INSERT INTO products
                 (product_id, product_name, category, price, barcode,
                  tenant_id, stock_quantity, is_active, is_on_hold, is_display_only, is_preorder)
               VALUES ($1,$2,$3,$4,$5, NULL, 0, TRUE, FALSE, FALSE, FALSE)`,
              [
                productId,
                String(p.product_name).trim(),
                String(p.category).trim(),
                parseFloat(p.price),
                String(p.barcode).trim(),
              ]
            );
            inserted++;
          } catch (rowErr) {
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

    const allFailed = [...failedRows, ...insertErrors]
      .sort((a, b) => a.row_number - b.row_number);

    res.json({
      success:  true,
      inserted,
      failed:   allFailed.length,
      details:  { failed: allFailed },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { bulkUploadMinimal };
