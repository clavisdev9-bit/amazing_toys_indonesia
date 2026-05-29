-- Migration 009: Add Payment Voucher tracking columns to integration_xref
-- Applied: 2026-05-28
-- Spec: Integrasi Payment Voucher SOS → Odoo 18

ALTER TABLE integration_xref
  ADD COLUMN IF NOT EXISTS odoo_invoice_id   INTEGER,
  ADD COLUMN IF NOT EXISTS odoo_payment_id   INTEGER,
  ADD COLUMN IF NOT EXISTS voucher_status    VARCHAR(20) DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS voucher_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN integration_xref.odoo_invoice_id   IS 'Odoo account.move ID (out_invoice)';
COMMENT ON COLUMN integration_xref.odoo_payment_id   IS 'Odoo account.payment ID';
COMMENT ON COLUMN integration_xref.voucher_status    IS 'PENDING | CONFIRMED | INVOICED | PAID | FAILED';
COMMENT ON COLUMN integration_xref.voucher_synced_at IS 'Timestamp terakhir sync voucher ke Odoo';

CREATE INDEX IF NOT EXISTS idx_xref_voucher_status
  ON integration_xref (entity_type, voucher_status)
  WHERE voucher_status IS NOT NULL AND voucher_status <> 'PAID';
