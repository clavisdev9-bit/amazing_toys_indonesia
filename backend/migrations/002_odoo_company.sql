-- Migration 002: Add odoo_company_id and odoo_company_name to integration_config
-- These fields scope every Odoo RPC call to a specific company in a multi-company instance.
-- The integration_config key stores all Odoo settings as a single JSONB blob.

UPDATE system_settings
SET    value      = (value::jsonb || '{"odoo_company_id": null, "odoo_company_name": ""}'::jsonb)::text,
       updated_at = NOW()
WHERE  key = 'integration_config'
  AND  NOT (value::jsonb ? 'odoo_company_id');
