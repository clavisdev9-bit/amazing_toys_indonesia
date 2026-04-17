'use strict';

const { query } = require('../../config/database');
const { AppError } = require('../../middlewares/error.middleware');

async function listTenants({ floor, search, activeOnly = true } = {}) {
  const conditions = [];
  const params = [];

  if (activeOnly) conditions.push(`t.is_active = TRUE`);
  if (floor)  { params.push(floor);   conditions.push(`t.floor_label = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`t.tenant_name ILIKE $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT t.tenant_id, t.tenant_name, t.booth_location, t.floor_label,
            t.contact_name, t.contact_phone, t.is_active,
            COUNT(p.product_id) AS product_count
     FROM tenants t
     LEFT JOIN products p ON p.tenant_id = t.tenant_id AND p.is_active = TRUE
     ${where}
     GROUP BY t.tenant_id
     ORDER BY t.floor_label, t.booth_location`,
    params
  );
  return result.rows;
}

async function getTenantById(tenantId) {
  const result = await query(
    `SELECT t.*, COUNT(p.product_id) AS product_count
     FROM tenants t
     LEFT JOIN products p ON p.tenant_id = t.tenant_id AND p.is_active = TRUE
     WHERE t.tenant_id = $1
     GROUP BY t.tenant_id`,
    [tenantId]
  );
  if (!result.rows[0]) throw new AppError('Tenant tidak ditemukan.', 404);
  return result.rows[0];
}

async function getTenantProducts(tenantId) {
  const result = await query(
    `SELECT * FROM products WHERE tenant_id = $1 AND is_active = TRUE ORDER BY product_name`,
    [tenantId]
  );
  return result.rows;
}

async function createTenant(data) {
  const {
    tenant_id, tenant_name, booth_location, floor_label,
    contact_name, contact_phone, contact_email,
    revenue_share_pct, bank_account,
  } = data;

  const result = await query(
    `INSERT INTO tenants (tenant_id, tenant_name, booth_location, floor_label,
       contact_name, contact_phone, contact_email, revenue_share_pct, bank_account)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [tenant_id, tenant_name, booth_location, floor_label || null,
     contact_name, contact_phone, contact_email || null,
     revenue_share_pct || 100.00, bank_account || null]
  );
  return result.rows[0];
}

async function updateTenant(tenantId, data) {
  const allowed = ['tenant_name', 'booth_location', 'floor_label', 'contact_name',
                   'contact_phone', 'contact_email', 'revenue_share_pct', 'bank_account', 'is_active'];
  const fields = [];
  const params = [];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }
  if (fields.length === 0) throw new AppError('No fields to update.');

  params.push(tenantId);
  const result = await query(
    `UPDATE tenants SET ${fields.join(', ')} WHERE tenant_id = $${params.length} RETURNING *`,
    params
  );
  if (!result.rows[0]) throw new AppError('Tenant tidak ditemukan.', 404);
  return result.rows[0];
}

module.exports = { listTenants, getTenantById, getTenantProducts, createTenant, updateTenant };
