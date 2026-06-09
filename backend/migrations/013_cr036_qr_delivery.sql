-- 013_cr036_qr_delivery.sql
-- CR-036: QR Delivery Three-Layer System
-- Additive only — no existing columns / enums dropped or renamed.
-- Prerequisite: 011_cr035_hybrid_model_c.sql (RESERVED status, HELPER role, customer_phone).
--
-- ROLLBACK (manual):
--   ALTER TABLE transactions DROP COLUMN IF EXISTS public_token;
--   ALTER TABLE transactions DROP COLUMN IF EXISTS public_token_exp;
--   ALTER TABLE transactions DROP COLUMN IF EXISTS wa_sent_at;
--   ALTER TABLE transactions DROP COLUMN IF EXISTS wa_delivery_status;
--   DROP INDEX  IF EXISTS idx_transactions_public_token;
--   -- system_settings rows may be left as DISABLED — no functional impact.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- A. Tabel transactions — tambah kolom QR delivery
--    (customer_phone sudah ada dari migration 011)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS public_token       VARCHAR(64)   UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS public_token_exp   TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wa_sent_at         TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wa_delivery_status VARCHAR(20)   DEFAULT 'PENDING';

-- CHECK constraint — idempotent via DROP IF EXISTS
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_wa_delivery_status;
ALTER TABLE transactions
  ADD CONSTRAINT chk_wa_delivery_status
    CHECK (wa_delivery_status IN ('PENDING','SENT','DELIVERED','FAILED','SKIPPED'));

-- Partial index untuk lookup token publik yang cepat
CREATE INDEX IF NOT EXISTS idx_transactions_public_token
  ON transactions(public_token)
  WHERE public_token IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- B. system_settings — seed kunci konfigurasi WA/SMS gateway
--    ON CONFLICT DO NOTHING → aman dijalankan ulang
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_settings'
  ) THEN
    INSERT INTO system_settings (key, value, updated_at) VALUES
      ('wa_gateway_provider',
       '"DISABLED"',
       NOW()),

      ('wa_gateway_api_key',
       '""',
       NOW()),

      ('wa_gateway_api_url',
       '""',
       NOW()),

      ('wa_message_template',
       '"Halo! Pesanan Anda dari *{{booth_name}}* sudah dibuat.\n\nItem: {{item_summary}}\nTotal: {{total_amount}}\n\nTunjukkan QR di link berikut ke kasir:\n{{order_link}}\n\nLink berlaku {{expiry_minutes}} menit. Terima kasih!"',
       NOW()),

      ('public_token_ttl_minutes',
       '120',
       NOW()),

      ('order_base_url',
       '"http://localhost:8080"',
       NOW())

    ON CONFLICT (key) DO NOTHING;
  END IF;
END$$;

COMMIT;
