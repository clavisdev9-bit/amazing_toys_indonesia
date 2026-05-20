-- Migration 005: Add PPN 12% tax columns to transactions.
-- subtotal_amount = sum of line subtotals (before tax)
-- tax_rate        = percentage rate applied (12.00 for PPN 12%)
-- tax_amount      = subtotal_amount * tax_rate / 100
-- total_amount is now subtotal_amount + tax_amount (updated semantics for new orders)
-- Existing rows keep their total_amount; subtotal_amount/tax_amount default to 0
-- so old receipts show no tax breakdown rather than fabricated values.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tax_rate        NUMERIC(5,2)  NOT NULL DEFAULT 12.00,
  ADD COLUMN IF NOT EXISTS tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0.00;
