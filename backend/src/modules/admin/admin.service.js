'use strict';

const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcrypt');
const { query } = require('../../config/database');
const { AppError } = require('../../middlewares/error.middleware');
const logger = require('../../config/logger');

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
           p.barcode, p.odoo_categ_id, p.is_active, p.created_at, p.updated_at,
           t.tenant_id, t.tenant_name, t.booth_location
    FROM products p
    LEFT JOIN tenants t ON t.tenant_id = p.tenant_id
    ${where}
    ORDER BY p.is_active DESC, p.product_name ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const countSql = `SELECT COUNT(*) FROM products p ${where}`;
  const [data, count] = await Promise.all([
    query(sql, params),
    query(countSql, params.slice(0, -2)),
  ]);
  const total      = parseInt(count.rows[0].count, 10);
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    items: data.rows,
    pagination: { total, page, page_size: limit, total_pages: totalPages },
  };
}

async function adminCreateProduct({ product_id, product_name, category, price, tenant_id, barcode, stock_quantity, image_url, description, categ_id }) {
  if (!product_id || !product_name || !category || !price || !tenant_id || !barcode) {
    throw new AppError('product_id, product_name, category, price, tenant_id, barcode wajib diisi.', 422);
  }

  const idExists = await query('SELECT product_id FROM products WHERE product_id = $1', [product_id]);
  if (idExists.rows.length > 0) throw new AppError('Product ID sudah digunakan.', 409);

  const bcExists = await query('SELECT product_id FROM products WHERE barcode = $1', [barcode]);
  if (bcExists.rows.length > 0) throw new AppError('Barcode sudah digunakan produk lain.', 409);

  const result = await query(
    `INSERT INTO products (product_id, product_name, category, price, tenant_id, barcode, stock_quantity, image_url, description, odoo_categ_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [product_id, product_name, category, parseFloat(price), tenant_id, barcode,
     parseInt(stock_quantity) || 0, image_url || null, description || null, categ_id || null]
  );
  // Auto-sync new product to Odoo (fire-and-forget — does not block response)
  _autoSyncProduct(result.rows[0].product_id);
  return result.rows[0];
}

async function adminUpdateProduct(productId, data) {
  const allowed = ['product_name', 'category', 'price', 'stock_quantity', 'image_url', 'description', 'is_active', 'barcode', 'odoo_categ_id'];
  if (data.categ_id !== undefined) data = { ...data, odoo_categ_id: data.categ_id || null };
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
  // Auto-sync updated product to Odoo (fire-and-forget — does not block response)
  _autoSyncProduct(productId);
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
  map_embed_url: '',
  map_image_url: '',
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
  odoo_is_active: false,
  odoo_base_url: '',
  odoo_db: '',
  odoo_login: '',
  odoo_password: '',
  odoo_walkin_partner_id: '',
  odoo_webhook_secret: '',
  odoo_low_stock_threshold: 10,
  odoo_product_sync_interval_min: 30,
  odoo_stock_sync_interval_min: 30,
  odoo_sweep_interval_min: 5,
  odoo_polling_interval_sec: 60,
  odoo_retry_max_attempts: 3,
  odoo_circuit_breaker_threshold: 5,
  odoo_circuit_breaker_reset_min: 2,
  odoo_tenant_product_mapping: '{}',
  odoo_default_tenant_id: 'T001',
};

const MASKED = '••••••••';
const MASKED_FIELDS = ['secret_key', 'odoo_password', 'odoo_webhook_secret'];

function maskSecret(config) {
  const out = { ...config };
  for (const f of MASKED_FIELDS) {
    out[f] = config[f] ? MASKED : '';
  }
  return out;
}

async function getIntegrationConfig() {
  const result = await query(
    "SELECT value FROM system_settings WHERE key = 'integration_config'"
  );
  const config = result.rows.length > 0
    ? { ...DEFAULT_INTEGRATION_CONFIG, ...JSON.parse(result.rows[0].value) }
    : { ...DEFAULT_INTEGRATION_CONFIG };
  return maskSecret(config);
}

async function saveIntegrationConfig(data) {
  const current = await getIntegrationConfigRaw();
  for (const f of MASKED_FIELDS) {
    if (data[f] === MASKED) data[f] = current[f];
  }
  const updated = { ...current, ...data };
  await query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ('integration_config', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(updated)]
  );
  return maskSecret(updated);
}

async function getIntegrationConfigRaw() {
  const result = await query(
    "SELECT value FROM system_settings WHERE key = 'integration_config'"
  );
  return result.rows.length > 0
    ? { ...DEFAULT_INTEGRATION_CONFIG, ...JSON.parse(result.rows[0].value) }
    : { ...DEFAULT_INTEGRATION_CONFIG };
}

// ── Odoo Product Sync — private helpers ──────────────────────────────────────

/**
 * Authenticate with Odoo and return a ready-to-use odooRpc function.
 */
async function _connectOdoo() {
  const cfg      = await getIntegrationConfigRaw();
  const baseUrl  = cfg.odoo_base_url  || process.env.ODOO_URL;
  const db       = cfg.odoo_db        || process.env.ODOO_DB;
  const login    = cfg.odoo_login     || process.env.ODOO_LOGIN;
  const password = cfg.odoo_password  || process.env.ODOO_PASSWORD;

  if (!baseUrl || !db || !login || !password)
    throw new AppError('Odoo credentials not configured. Set via Admin → Integrasi → Integration with Odoo.', 500);

  const authRaw  = await fetch(`${baseUrl}/web/session/authenticate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params: { db, login, password } }),
    signal:  AbortSignal.timeout(15000),
  });
  const authBody = await authRaw.json();
  const uid      = authBody?.result?.uid;
  if (!uid) throw new AppError('Odoo authentication failed — check credentials.', 500);

  const sessionCookie = authRaw.headers.get('set-cookie')
    ?.split(',').map(c => c.trim())
    .find(c => c.startsWith('session_id='))
    ?.split(';')[0];

  let _rpcSeq = 10;
  const odooRpc = async (model, method, args, kwargs = {}) => {
    const raw  = await fetch(`${baseUrl}/web/dataset/call_kw`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
      body:    JSON.stringify({ jsonrpc: '2.0', method: 'call', id: _rpcSeq++,
        params: { model, method, args, kwargs } }),
      signal:  AbortSignal.timeout(30000),
    });
    const body = await raw.json();
    if (body?.error) throw new Error(body.error?.data?.message || 'Odoo RPC error');
    return body.result;
  };

  return { odooRpc, uid };
}

/** Build the Odoo product.template field values from a SOS product row. */
function _buildProductVals(p) {
  return {
    name:           p.product_name,
    list_price:     Number(p.price),
    sale_ok:        true,
    active:         true,
    type:           'consu',
    invoice_policy: 'order',
    is_storable:    true,
    ...(p.barcode       ? { barcode:  p.barcode }       : {}),
    ...(p.odoo_categ_id ? { categ_id: p.odoo_categ_id } : {}),
  };
}

/**
 * Create or update one product in Odoo and upsert its integration_xref entry.
 * Returns { action: 'created'|'updated'|'skipped', odooId }.
 */
async function _pushOneProductToOdoo(p, odooRpc, existingOdooId, force) {
  const odooVals = _buildProductVals(p);
  const odooValsNoBarcode = { ...odooVals };
  delete odooValsNoBarcode.barcode;

  let odooId = existingOdooId;
  let action;

  const isBarcodeError = (err) => /barcode/i.test(err.message) && /already/i.test(err.message);

  if (existingOdooId) {
    if (!force) {
      const cur = await odooRpc('product.template', 'read', [[existingOdooId]],
        { fields: ['name', 'list_price', 'barcode'] });
      const ex  = cur?.[0];
      if (ex && ex.name === p.product_name && Number(ex.list_price) === Number(p.price)
          && (ex.barcode || '') === (p.barcode || '')) {
        return { action: 'skipped', odooId: existingOdooId };
      }
    }
    try {
      await odooRpc('product.template', 'write', [[existingOdooId], odooVals]);
    } catch (err) {
      if (!isBarcodeError(err)) throw err;
      // Barcode claimed by another Odoo record — update everything except barcode
      await odooRpc('product.template', 'write', [[existingOdooId], odooValsNoBarcode]);
    }
    action = 'updated';
  } else {
    odooId = null;
    if (p.barcode) {
      const found = await odooRpc('product.template', 'search_read',
        [[['barcode', '=', p.barcode]]], { fields: ['id'], limit: 1 });
      if (found?.length > 0) {
        const candidateId = found[0].id;
        // Check if this Odoo product is already claimed by a different SOS product
        const clash = await query(
          `SELECT sos_id FROM integration_xref WHERE entity_type='product' AND odoo_id=$1`,
          [candidateId]
        );
        if (!clash.rows.length) {
          odooId = candidateId;
          await odooRpc('product.template', 'write', [[odooId], odooVals]);
          action = 'updated';
        }
        // If already claimed by another sos_id, fall through to create a new Odoo product
      }
    }
    if (!odooId) {
      // Create without barcode if the barcode is already in use in Odoo
      try {
        odooId = await odooRpc('product.template', 'create', [odooVals]);
      } catch (err) {
        if (!isBarcodeError(err)) throw err;
        odooId = await odooRpc('product.template', 'create', [odooValsNoBarcode]);
      }
      action = 'created';
    }
    await query(
      `INSERT INTO integration_xref (entity_type, sos_id, odoo_id, status, sync_metadata)
       VALUES ('product', $1, $2, 'ACTIVE', $3)
       ON CONFLICT (entity_type, sos_id)
       DO UPDATE SET odoo_id=EXCLUDED.odoo_id, sync_metadata=EXCLUDED.sync_metadata, updated_at=NOW()`,
      [p.product_id, odooId, JSON.stringify({ barcode: p.barcode })],
    );
  }
  return { action, odooId };
}

// ── Odoo Product Sync ─────────────────────────────────────────────────────────

let _syncInProgress = false;

function deriveStockStatus(qty, threshold = 10) {
  if (qty <= 0) return 'OUT_OF_STOCK';
  if (qty <= threshold) return 'LOW_STOCK';
  return 'AVAILABLE';
}

function resolveTenantId(catName, mapping, defaultId) {
  if (!catName || !mapping) return defaultId;
  const key = Object.keys(mapping).find(k => catName.toLowerCase().includes(k.toLowerCase()));
  return key ? mapping[key] : defaultId;
}

/**
 * Export all active SOS products to Odoo (SOS → Odoo).
 *
 * Creates or updates product.template records in Odoo for every active SOS
 * product.  Idempotency is tracked via integration_xref (entity_type='product').
 *
 * @param {boolean} [force=false]  When true, write to Odoo even if values appear unchanged.
 */
async function syncOdooProducts(force = false) {
  if (_syncInProgress) {
    const err = new Error('Sync already in progress. Please wait.');
    err.statusCode = 409;
    throw err;
  }
  _syncInProgress = true;

  try {
    const { odooRpc } = await _connectOdoo();

    const sosRows = await query(
      `SELECT p.product_id, p.product_name, p.category, p.price, p.barcode,
              p.stock_quantity, p.odoo_categ_id, p.is_active
       FROM   products p
       WHERE  p.is_active = true
       ORDER  BY p.product_id`,
    );
    const sosProducts = sosRows.rows;

    const xrefRows  = await query(
      "SELECT sos_id, odoo_id FROM integration_xref WHERE entity_type = 'product' AND status = 'ACTIVE'",
    );
    const xrefBySos = Object.fromEntries(xrefRows.rows.map(r => [r.sos_id, Number(r.odoo_id)]));

    const stats  = { total: sosProducts.length, created: 0, updated: 0, skipped: 0, failed: 0 };
    const errors = [];

    for (const p of sosProducts) {
      try {
        const { action } = await _pushOneProductToOdoo(
          p, odooRpc, xrefBySos[p.product_id] || null, force,
        );
        stats[action]++;
      } catch (err) {
        stats.failed++;
        errors.push(`${p.product_id} (${p.product_name}): ${err.message}`);
      }
    }

    return { stats, errors, synced_at: new Date().toISOString() };
  } finally {
    _syncInProgress = false;
  }
}

/**
 * Sync a single product to Odoo (product data + stock quantity).
 * Called automatically after adminCreateProduct / adminUpdateProduct.
 */
async function syncSingleProductToOdoo(productId) {
  const pRows = await query(
    `SELECT product_id, product_name, category, price, barcode,
            stock_quantity, odoo_categ_id, is_active
     FROM products WHERE product_id = $1`,
    [productId],
  );
  const p = pRows.rows[0];
  if (!p) return;

  const { odooRpc } = await _connectOdoo();

  const xrefRow = await query(
    "SELECT odoo_id FROM integration_xref WHERE entity_type='product' AND sos_id=$1 AND status='ACTIVE'",
    [productId],
  );
  const existingOdooId = xrefRow.rows[0] ? Number(xrefRow.rows[0].odoo_id) : null;

  const { action } = await _pushOneProductToOdoo(p, odooRpc, existingOdooId, true);
  logger.info(`[auto-sync] ${productId} product → Odoo: ${action}`);

  // After product is registered in Odoo, push current stock quantity
  const { StockSyncService } = require('../stock-sync/application/services/StockSyncService');
  const svc = new StockSyncService();
  const result = await svc.syncStock({ triggeredBy: 'system:auto', productIds: [productId] });
  logger.info(`[auto-sync] ${productId} stock → Odoo: ${result.summary?.synced ?? 0} synced`);
}

/** Fire-and-forget wrapper — logs errors but never throws. */
function _autoSyncProduct(productId) {
  syncSingleProductToOdoo(productId).catch(err =>
    logger.warn(`[auto-sync] ${productId}: ${err.message}`)
  );
}

/**
 * Fetch product categories from Odoo (product.category search_read).
 */
async function getOdooProductCategories() {
  const { odooRpc } = await _connectOdoo();

  const categories = await odooRpc('product.category', 'search_read', [[]],
    { fields: ['id', 'name', 'complete_name', 'parent_id'], limit: 0 });

  if (!Array.isArray(categories)) throw new AppError('Odoo RPC error saat mengambil kategori.', 502);

  return categories.map(c => ({
    id:           c.id,
    name:         c.name,
    completeName: c.complete_name,
    parentId:     Array.isArray(c.parent_id) ? c.parent_id[0] : null,
  }));
}

/**
 * List transactions by status — used by the integration service expiry sweep.
 */
async function listTransactions({ status, limit = 200 } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (status) {
    params.push(status);
    where += ` AND t.status = $${params.length}`;
  }
  params.push(Math.min(limit, 500));
  const result = await query(
    `SELECT t.transaction_id, t.status, t.customer_id, t.total_amount,
            t.created_at, t.paid_at
     FROM   transactions t
     ${where}
     ORDER  BY t.created_at DESC
     LIMIT  $${params.length}`,
    params,
  );
  return result.rows;
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
  // Transactions (integration sweep)
  listTransactions,
  // Odoo sync & lookups
  syncOdooProducts, syncSingleProductToOdoo, getOdooProductCategories,
};
