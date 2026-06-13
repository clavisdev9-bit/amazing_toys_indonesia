-- ============================================================
-- Migration 023 — CR-061 Fraud Protection: Delete Item Audit
-- Menambahkan kolom amount_charged ke transactions agar nominal
-- yang benar-benar ditagih ke EDC/QRIS/CASH dibekukan saat PAID
-- dan tidak dapat berubah setelah item dihapus.
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS amount_charged NUMERIC(14,2);
