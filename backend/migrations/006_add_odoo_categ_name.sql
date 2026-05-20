-- Add human-readable Odoo category name alongside the numeric odoo_categ_id.
-- Populated on save by the backend; backfilled automatically when admin fetches
-- Odoo categories (GET /admin/odoo/categories).
ALTER TABLE products ADD COLUMN IF NOT EXISTS odoo_categ_name VARCHAR(200);
