'use strict';

const { query } = require('../../config/database');
const { AppError } = require('../../middlewares/error.middleware');

async function listProducts({ tenantId, category, search, inStockOnly, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const conditions = ['p.is_active = TRUE'];
  const params = [];

  if (tenantId) { params.push(tenantId); conditions.push(`p.tenant_id = $${params.length}`); }
  if (category) { params.push(category); conditions.push(`p.category = $${params.length}`); }
  if (search)   { params.push(`%${search}%`); conditions.push(`(p.product_name ILIKE $${params.length} OR p.description ILIKE $${params.length})`); }
  if (inStockOnly) conditions.push(`p.stock_status != 'OUT_OF_STOCK'`);

  const where = conditions.join(' AND ');
  params.push(limit, offset);

  const sql = `
    SELECT p.product_id, p.product_name, p.category, p.price,
           p.stock_quantity, p.stock_status, p.image_url, p.description,
           p.barcode, p.odoo_categ_id, p.odoo_categ_name,
           p.is_on_hold, p.is_display_only, p.max_per_customer,
           p.is_preorder, p.preorder_note,
           t.tenant_id, t.tenant_name, t.booth_location, t.floor_label
    FROM products p
    JOIN tenants t ON t.tenant_id = p.tenant_id
    WHERE ${where}
    ORDER BY p.product_name ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const countSql = `SELECT COUNT(*) FROM products p WHERE ${where}`;
  const [data, count] = await Promise.all([
    query(sql, params),
    query(countSql, params.slice(0, -2)),
  ]);

  return {
    items: data.rows,
    total: parseInt(count.rows[0].count, 10),
    page,
    limit,
  };
}

async function getProductById(productId) {
  const result = await query(
    `SELECT p.*, t.tenant_name, t.booth_location, t.floor_label
     FROM products p
     JOIN tenants t ON t.tenant_id = p.tenant_id
     WHERE p.product_id = $1 AND p.is_active = TRUE`,
    [productId]
  );
  if (!result.rows[0]) throw new AppError('Produk tidak ditemukan.', 404);
  return result.rows[0];
}

async function getProductByBarcode(barcode) {
  const result = await query(
    `SELECT p.*, t.tenant_name, t.booth_location, t.floor_label
     FROM products p
     JOIN tenants t ON t.tenant_id = p.tenant_id
     WHERE p.barcode = $1 AND p.is_active = TRUE`,
    [barcode]
  );
  if (!result.rows[0]) throw new AppError('Produk tidak ditemukan, silakan cari manual.', 404);
  return result.rows[0];
}

async function createProduct(data) {
  const { product_id, product_name, category, price, tenant_id, barcode, stock_quantity, image_url, description } = data;
  const result = await query(
    `INSERT INTO products (product_id, product_name, category, price, tenant_id, barcode, stock_quantity, image_url, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [product_id, product_name, category, price, tenant_id, barcode, stock_quantity, image_url || null, description || null]
  );
  return result.rows[0];
}

async function updateProduct(productId, data) {
  const fields = [];
  const params = [];
  const allowed = ['product_name', 'category', 'price', 'stock_quantity', 'image_url', 'description', 'is_active'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }
  if (fields.length === 0) throw new AppError('No fields to update.');

  params.push(productId);
  const result = await query(
    `UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE product_id = $${params.length} RETURNING *`,
    params
  );
  if (!result.rows[0]) throw new AppError('Produk tidak ditemukan.', 404);
  return result.rows[0];
}

/**
 * Toggle is_on_hold on a product.
 * Returns { product, wasOnHold } so the caller can decide whether to broadcast WS.
 */
async function toggleProductHold(productId, is_on_hold) {
  // Fetch current value to detect the true→false transition
  const current = await query(
    `SELECT is_on_hold, product_name FROM products WHERE product_id = $1`,
    [productId]
  );
  if (!current.rows[0]) throw new AppError('Produk tidak ditemukan.', 404);

  const wasOnHold = current.rows[0].is_on_hold === true;

  const result = await query(
    `UPDATE products
     SET is_on_hold = $1, updated_at = NOW()
     WHERE product_id = $2
     RETURNING *`,
    [is_on_hold, productId]
  );

  return { product: result.rows[0], wasOnHold };
}

async function listCategories() {
  const result = await query(`
    SELECT name AS category FROM product_categories
    UNION
    SELECT DISTINCT category FROM products WHERE is_active = TRUE
    ORDER BY category
  `);
  return result.rows.map(r => r.category);
}

async function createCategory(name) {
  if (!name?.trim()) throw new AppError('Nama kategori wajib diisi.', 422);
  const result = await query(
    `INSERT INTO product_categories (name) VALUES ($1)
     ON CONFLICT (name) DO NOTHING
     RETURNING category_id, name, created_at`,
    [name.trim()],
  );
  return result.rows[0] ?? null;
}

async function togglePreorder(productId, isPreorder, preorderNote) {
  const result = await query(
    `UPDATE products SET is_preorder = $1, preorder_note = $2, updated_at = NOW()
     WHERE product_id = $3 RETURNING *`,
    [isPreorder, preorderNote || null, productId],
  );
  if (!result.rows[0]) throw new AppError('Produk tidak ditemukan.', 404);
  return result.rows[0];
}

module.exports = { listProducts, getProductById, getProductByBarcode, createProduct, updateProduct, listCategories, createCategory, toggleProductHold, togglePreorder };
