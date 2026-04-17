'use strict';

const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcrypt');
const { query } = require('../../config/database');
const { AppError } = require('../../middlewares/error.middleware');

// ── Helpers ───────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, '../../../data');

function readJsonFile(filename, defaults) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return defaults;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return defaults; }
}

function writeJsonFile(filename, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

// ── Users ─────────────────────────────────────────────────────────────────────

async function listUsers({ role }) {
  const conditions = [`u.role != 'ADMIN'`];
  const params = [];

  if (role) {
    params.push(role);
    conditions.push(`u.role = $${params.length}`);
  }

  const sql = `
    SELECT u.user_id, u.username, u.role, u.display_name, u.is_active,
           u.tenant_id, t.tenant_name, u.last_login_at, u.created_at
    FROM users u
    LEFT JOIN tenants t ON t.tenant_id = u.tenant_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY u.role, u.display_name
  `;
  const result = await query(sql, params);
  return result.rows;
}

async function createUser({ username, password, role, display_name, tenant_id }) {
  if (!username || !password || !role || !display_name) {
    throw new AppError('username, password, role, dan display_name wajib diisi.', 422);
  }
  if (!['CASHIER', 'TENANT', 'LEADER'].includes(role)) {
    throw new AppError('Role tidak valid. Gunakan CASHIER, TENANT, atau LEADER.', 422);
  }
  if (role === 'TENANT' && !tenant_id) {
    throw new AppError('tenant_id wajib diisi untuk role TENANT.', 422);
  }

  const exists = await query('SELECT user_id FROM users WHERE username = $1', [username]);
  if (exists.rows.length > 0) throw new AppError('Username sudah digunakan.', 409);

  const password_hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (username, password_hash, role, display_name, tenant_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING user_id, username, role, display_name, tenant_id, is_active, created_at`,
    [username, password_hash, role, display_name, tenant_id || null]
  );
  return result.rows[0];
}

async function updateUser(userId, { display_name, is_active, tenant_id }) {
  const fields = [];
  const params = [];

  if (display_name !== undefined) { params.push(display_name);         fields.push(`display_name = $${params.length}`); }
  if (is_active    !== undefined) { params.push(is_active);            fields.push(`is_active = $${params.length}`); }
  if (tenant_id    !== undefined) { params.push(tenant_id || null);    fields.push(`tenant_id = $${params.length}`); }

  if (fields.length === 0) throw new AppError('Tidak ada field yang diubah.', 422);

  params.push(userId);
  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${params.length}
     RETURNING user_id, username, role, display_name, tenant_id, is_active`,
    params
  );
  if (result.rows.length === 0) throw new AppError('User tidak ditemukan.', 404);
  return result.rows[0];
}

async function resetPassword(userId, { new_password }) {
  if (!new_password || new_password.length < 6) {
    throw new AppError('Password minimal 6 karakter.', 422);
  }
  const password_hash = await bcrypt.hash(new_password, 10);
  const result = await query(
    `UPDATE users SET password_hash = $1 WHERE user_id = $2 AND role != 'ADMIN'
     RETURNING user_id, username`,
    [password_hash, userId]
  );
  if (result.rows.length === 0) throw new AppError('User tidak ditemukan.', 404);
  return { message: 'Password berhasil direset.', username: result.rows[0].username };
}

async function deleteUser(userId) {
  const result = await query(
    `UPDATE users SET is_active = FALSE WHERE user_id = $1 AND role != 'ADMIN'
     RETURNING user_id, username`,
    [userId]
  );
  if (result.rows.length === 0) throw new AppError('User tidak ditemukan.', 404);
  return { message: `User ${result.rows[0].username} dinonaktifkan.` };
}

// ── Master Data — Products ────────────────────────────────────────────────────

async function adminListProducts({ tenantId, search, includeInactive = true, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (!includeInactive) conditions.push(`p.is_active = TRUE`);
  if (tenantId) { params.push(tenantId); conditions.push(`p.tenant_id = $${params.length}`); }
  if (search)   {
    params.push(`%${search}%`);
    conditions.push(`(p.product_name ILIKE $${params.length} OR p.product_id ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const sql = `
    SELECT p.product_id, p.product_name, p.category, p.price,
           p.stock_quantity, p.stock_status, p.image_url, p.description,
           p.barcode, p.is_active, p.created_at, p.updated_at,
           t.tenant_id, t.tenant_name, t.booth_location
    FROM products p
    JOIN tenants t ON t.tenant_id = p.tenant_id
    ${where}
    ORDER BY p.is_active DESC, p.product_name ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const countSql = `SELECT COUNT(*) FROM products p ${where}`;
  const [data, count] = await Promise.all([
    query(sql, params),
    query(countSql, params.slice(0, -2)),
  ]);
  return { items: data.rows, total: parseInt(count.rows[0].count, 10), page, limit };
}

async function adminCreateProduct({ product_id, product_name, category, price, tenant_id, barcode, stock_quantity, image_url, description }) {
  if (!product_id || !product_name || !category || !price || !tenant_id || !barcode) {
    throw new AppError('product_id, product_name, category, price, tenant_id, barcode wajib diisi.', 422);
  }

  const idExists = await query('SELECT product_id FROM products WHERE product_id = $1', [product_id]);
  if (idExists.rows.length > 0) throw new AppError('Product ID sudah digunakan.', 409);

  const bcExists = await query('SELECT product_id FROM products WHERE barcode = $1', [barcode]);
  if (bcExists.rows.length > 0) throw new AppError('Barcode sudah digunakan produk lain.', 409);

  const result = await query(
    `INSERT INTO products (product_id, product_name, category, price, tenant_id, barcode, stock_quantity, image_url, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [product_id, product_name, category, parseFloat(price), tenant_id, barcode,
     parseInt(stock_quantity) || 0, image_url || null, description || null]
  );
  return result.rows[0];
}

async function adminUpdateProduct(productId, data) {
  const allowed = ['product_name', 'category', 'price', 'stock_quantity', 'image_url', 'description', 'is_active', 'barcode'];
  const fields = [];
  const params = [];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }
  if (fields.length === 0) throw new AppError('Tidak ada field yang diubah.', 422);

  params.push(productId);
  const result = await query(
    `UPDATE products SET ${fields.join(', ')}, updated_at = NOW() WHERE product_id = $${params.length} RETURNING *`,
    params
  );
  if (!result.rows[0]) throw new AppError('Produk tidak ditemukan.', 404);
  return result.rows[0];
}

async function adminDeleteProduct(productId) {
  const result = await query(
    `UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE product_id = $1
     RETURNING product_id, product_name`,
    [productId]
  );
  if (!result.rows[0]) throw new AppError('Produk tidak ditemukan.', 404);
  return { message: `Produk ${result.rows[0].product_name} dinonaktifkan.` };
}

async function saveProductImage(base64Data) {
  if (!base64Data) throw new AppError('Data gambar wajib diisi.', 422);

  const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches) throw new AppError('Format gambar tidak valid (gunakan data URL base64).', 422);

  const mimeType = matches[1];
  const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  const ext = extMap[mimeType] || 'jpg';

  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length > 2 * 1024 * 1024) throw new AppError('Ukuran gambar maksimal 2MB.', 422);

  const uploadsDir = path.join(__dirname, '../../../public/uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);

  return `/uploads/${filename}`;
}

// ── Tenants (Booth Master Data) ──────────────────────────────────────────────

async function adminListTenants({ search, includeInactive = true } = {}) {
  const conditions = [];
  const params = [];

  if (!includeInactive) conditions.push('is_active = TRUE');
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(tenant_name ILIKE $${params.length} OR booth_location ILIKE $${params.length} OR contact_name ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`SELECT * FROM tenants ${where} ORDER BY tenant_id ASC`, params);
  return result.rows;
}

async function adminCreateTenant({ tenant_name, booth_location, floor_label, contact_name, contact_phone, contact_email }) {
  if (!tenant_name || !booth_location || !contact_name || !contact_phone) {
    throw new AppError('tenant_name, booth_location, contact_name, contact_phone wajib diisi.', 422);
  }

  // Auto-generate next tenant_id (T001, T002, … T009, T010, …)
  const maxRes = await query(`SELECT tenant_id FROM tenants ORDER BY tenant_id DESC LIMIT 1`);
  let nextNum = 1;
  if (maxRes.rows.length > 0) {
    nextNum = parseInt(maxRes.rows[0].tenant_id.slice(1), 10) + 1;
  }
  const tenant_id = `T${String(nextNum).padStart(3, '0')}`;

  const result = await query(
    `INSERT INTO tenants (tenant_id, tenant_name, booth_location, floor_label, contact_name, contact_phone, contact_email)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [tenant_id, tenant_name, booth_location, floor_label || null, contact_name, contact_phone, contact_email || null]
  );
  return result.rows[0];
}

async function adminUpdateTenant(tenantId, data) {
  const allowed = ['tenant_name', 'booth_location', 'floor_label', 'contact_name', 'contact_phone', 'contact_email', 'is_active'];
  const fields = [];
  const params = [];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }
  if (fields.length === 0) throw new AppError('Tidak ada field yang diubah.', 422);

  params.push(tenantId);
  const result = await query(
    `UPDATE tenants SET ${fields.join(', ')} WHERE tenant_id = $${params.length} RETURNING *`,
    params
  );
  if (!result.rows[0]) throw new AppError('Tenant tidak ditemukan.', 404);
  return result.rows[0];
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

async function getAuditLogs({ entityType, actorRole, search, dateFrom, dateTo, page = 1, limit = 50 }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (entityType) { params.push(entityType);       conditions.push(`a.entity_type = $${params.length}`); }
  if (actorRole)  { params.push(actorRole);         conditions.push(`a.actor_role = $${params.length}`); }
  if (search)     { params.push(`%${search}%`);     conditions.push(`(a.action ILIKE $${params.length} OR a.entity_id ILIKE $${params.length} OR a.actor_id ILIKE $${params.length})`); }
  if (dateFrom)   { params.push(dateFrom);          conditions.push(`a.created_at >= $${params.length}`); }
  if (dateTo)     { params.push(dateTo + 'T23:59:59Z'); conditions.push(`a.created_at <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const sql = `
    SELECT a.log_id, a.action, a.actor_id, a.actor_role, a.entity_type, a.entity_id,
           a.old_value, a.new_value, a.ip_address, a.created_at,
           u.display_name AS actor_name, u.username AS actor_username
    FROM audit_log a
    LEFT JOIN users u ON u.user_id::text = a.actor_id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const countSql = `SELECT COUNT(*) FROM audit_log a ${where}`;
  const [data, count] = await Promise.all([
    query(sql, params),
    query(countSql, params.slice(0, -2)),
  ]);
  return { items: data.rows, total: parseInt(count.rows[0].count, 10), page, limit };
}

// ── System Configuration ──────────────────────────────────────────────────────

const DEFAULT_SYSTEM_CONFIG = {
  event_name: 'Amazing Toys Fair 2026',
  venue: 'Jakarta Convention Center',
  event_date_start: '2026-04-01',
  event_date_end: '2026-04-07',
  pending_timeout_minutes: 30,
  max_items_per_order: 20,
  maintenance_mode: false,
  contact_email: 'admin@amazingtoys.local',
  logo_url: '',
  primary_color: '#2563eb',
  map_embed_url: '',   // Google Maps embed src URL
  map_image_url: '',   // fallback uploaded image URL
};

async function getSystemConfig() {
  return readJsonFile('system-config.json', DEFAULT_SYSTEM_CONFIG);
}

async function saveSystemConfig(data) {
  const current = await getSystemConfig();
  const updated = { ...current, ...data };
  writeJsonFile('system-config.json', updated);
  return updated;
}

// ── Integration Configuration ─────────────────────────────────────────────────

const DEFAULT_INTEGRATION_CONFIG = {
  payment_gateway: '',
  api_key: '',
  secret_key: '',
  webhook_url: '',
  is_active: false,
  pos_url: '',
  pos_api_key: '',
  notes: '',
};

function maskSecret(config) {
  return { ...config, secret_key: config.secret_key ? '••••••••' : '' };
}

async function getIntegrationConfig() {
  const config = readJsonFile('integration-config.json', DEFAULT_INTEGRATION_CONFIG);
  return maskSecret(config);
}

async function saveIntegrationConfig(data) {
  const current = readJsonFile('integration-config.json', DEFAULT_INTEGRATION_CONFIG);
  if (data.secret_key === '••••••••') data.secret_key = current.secret_key;
  const updated = { ...current, ...data };
  writeJsonFile('integration-config.json', updated);
  return maskSecret(updated);
}

module.exports = {
  // Users
  listUsers, createUser, updateUser, resetPassword, deleteUser,
  // Products
  adminListProducts, adminCreateProduct, adminUpdateProduct, adminDeleteProduct, saveProductImage,
  // Tenants (booth master data)
  adminListTenants, adminCreateTenant, adminUpdateTenant,
  // Audit log
  getAuditLogs,
  // Config
  getSystemConfig, saveSystemConfig,
  // Integration
  getIntegrationConfig, saveIntegrationConfig,
};
