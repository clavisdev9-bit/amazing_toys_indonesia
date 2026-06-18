-- Migration 031: Tambah kolom odoo_booth_id ke tenants
-- Stores the Odoo x_studio_booth record ID so integration_xref
-- can be populated automatically when admin sets the mapping.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS odoo_booth_id INTEGER DEFAULT NULL;

COMMENT ON COLUMN tenants.odoo_booth_id IS
  'Odoo record ID untuk field x_studio_booth — diisi admin, digunakan integration sebagai xref tenant→Odoo';
