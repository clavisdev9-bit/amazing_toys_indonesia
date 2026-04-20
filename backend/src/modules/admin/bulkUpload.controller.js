'use strict';

/**
 * bulkUpload.controller.js
 *
 * POST /api/v1/admin/products/bulk-upload
 * Accepts { products: ProductRow[] }, validates every row server-side,
 * then inserts the entire batch inside a single DB transaction.
 * Any validation failure returns 400 with all errors — no partial inserts.
 */

const { withTransaction } = require('../../config/database');

const REQUIRED_FIELDS = ['product_name', 'category', 'price', 'tenant_id'];
const URL_RE          = /^https?:\/\//i;

function validateRow(row, rowIndex) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || String(row[field]).trim() === '') {
      errors.push({ row: rowIndex, field, message: `${field} wajib diisi` });
    }
  }

  if (row.price !== undefined && String(row.price).trim() !== '') {
    const p = parseFloat(row.price);
    if (isNaN(p) || p < 0) {
      errors.push({ row: rowIndex, field: 'price', message: 'price harus berupa angka >= 0' });
    }
  }

  if (row.image_url && String(row.image_url).trim() !== '') {
    if (!URL_RE.test(String(row.image_url).trim())) {
      errors.push({ row: rowIndex, field: 'image_url', message: 'image_url harus diawali https:// atau http://' });
    }
  }

  return errors;
}

function resolveBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (val === undefined || val === null || val === '') return true;
  const s = String(val).trim().toLowerCase();
  return !['false', '0', 'no'].includes(s);
}

/**
 * POST /api/v1/admin/products/bulk-upload
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
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

    // Server-side validation — collect ALL errors before aborting
    const allErrors = [];
    for (let i = 0; i < products.length; i++) {
      const rowErrors = validateRow(products[i], i + 1);
      allErrors.push(...rowErrors);
    }
    if (allErrors.length > 0) {
      return res.status(400).json({ success: false, errors: allErrors });
    }

    // Duplicate barcode check within the uploaded batch
    const barcodes = products.map(p => (p.barcode || '').trim()).filter(Boolean);
    if (new Set(barcodes).size !== barcodes.length) {
      return res.status(400).json({
        success: false,
        message: 'Terdapat barcode duplikat dalam file upload.',
      });
    }

    // Single transactional bulk INSERT
    await withTransaction(async (client) => {
      for (let i = 0; i < products.length; i++) {
        const p = products[i];

        const productId = (p.product_id || '').trim()
          || `PB${String(i + 1).padStart(4, '0')}-${String(p.tenant_id).trim()}`;

        await client.query(
          `INSERT INTO products
             (product_id, product_name, category, price, tenant_id,
              barcode, stock_quantity, image_url, description, odoo_categ_id, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            productId,
            String(p.product_name).trim(),
            String(p.category).trim(),
            parseFloat(p.price),
            String(p.tenant_id).trim(),
            p.barcode?.trim()  || null,
            parseInt(p.stock_quantity) || 0,
            p.image_url?.trim() || null,
            p.description?.trim() || null,
            (p.odoo_categ_id !== undefined && p.odoo_categ_id !== null && p.odoo_categ_id !== '')
              ? parseInt(p.odoo_categ_id)
              : null,
            resolveBoolean(p.is_active),
          ]
        );
      }
    });

    res.json({ success: true, inserted: products.length });
  } catch (err) {
    // PostgreSQL unique-constraint violation → readable message
    if (err.code === '23505') {
      const match = (err.detail || '').match(/\(([^)]+)\)=\(([^)]+)\)/);
      const field = match?.[1] || 'kolom';
      const value = match?.[2] || '';
      return res.status(409).json({
        success: false,
        message: `Duplikat nilai ${field}: "${value}" sudah ada di database.`,
      });
    }
    // FK violation (e.g. tenant_id not found)
    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        message: `Data referensi tidak ditemukan: ${err.detail || err.message}`,
      });
    }
    next(err);
  }
}

module.exports = { bulkUploadProducts };
