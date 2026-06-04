-- Migration 010: Voucher discount system tables
-- Applied: 2026-06-04
-- Spec: Sistem Voucher Diskon SOS — Prompt A

BEGIN;

-- ── 1. Tabel vouchers ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vouchers (
  id               SERIAL PRIMARY KEY,
  code             VARCHAR(50)    UNIQUE NOT NULL,
  description      VARCHAR(255),
  discount_type    VARCHAR(10)    NOT NULL,
  discount_value   NUMERIC(12,2)  NOT NULL,
  min_purchase     NUMERIC(14,2)  NOT NULL DEFAULT 0,
  max_discount     NUMERIC(14,2),
  usage_limit      INTEGER,
  usage_count      INTEGER        NOT NULL DEFAULT 0,
  valid_from       TIMESTAMPTZ    NOT NULL,
  valid_until      TIMESTAMPTZ    NOT NULL,
  is_active        BOOLEAN        NOT NULL DEFAULT TRUE,
  tenant_id        VARCHAR(10),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_by       VARCHAR(100),
  CONSTRAINT vouchers_discount_type_check   CHECK (discount_type IN ('PERCENT', 'FIXED')),
  CONSTRAINT vouchers_discount_value_pos    CHECK (discount_value > 0),
  CONSTRAINT vouchers_valid_range           CHECK (valid_until > valid_from),
  CONSTRAINT vouchers_percent_range         CHECK (
    discount_type <> 'PERCENT' OR (discount_value > 0 AND discount_value <= 100)
  )
);

COMMENT ON TABLE  vouchers                  IS 'Kode voucher diskon event';
COMMENT ON COLUMN vouchers.discount_type    IS 'PERCENT atau FIXED';
COMMENT ON COLUMN vouchers.discount_value   IS 'Persen (0-100) atau nominal IDR';
COMMENT ON COLUMN vouchers.max_discount     IS 'Cap nominal diskon untuk tipe PERCENT (NULL = tidak ada cap)';
COMMENT ON COLUMN vouchers.usage_limit      IS 'NULL = unlimited';
COMMENT ON COLUMN vouchers.tenant_id        IS 'NULL = berlaku semua tenant';

-- ── 2. Tabel voucher_usages ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS voucher_usages (
  id               SERIAL PRIMARY KEY,
  voucher_code     VARCHAR(50)    NOT NULL REFERENCES vouchers(code),
  transaction_id   VARCHAR(30)    NOT NULL,
  customer_id      UUID           REFERENCES customers(customer_id) ON DELETE SET NULL,
  discount_amount  NUMERIC(14,2)  NOT NULL,
  used_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (voucher_code, transaction_id)
);

COMMENT ON TABLE  voucher_usages                IS 'Histori pemakaian voucher per transaksi';
COMMENT ON COLUMN voucher_usages.transaction_id IS 'Format TXN-YYYYMMDD-NNNNN';
COMMENT ON COLUMN voucher_usages.customer_id    IS 'NULL untuk Walk-in Customer';

-- ── 3. Extend tabel transactions ─────────────────────────────────────────────
-- subtotal_amount, tax_rate, tax_amount, total_amount sudah ada sejak migration 005.
-- Hanya tambah 2 kolom baru.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS voucher_code    VARCHAR(50) REFERENCES vouchers(code),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN transactions.voucher_code    IS 'Kode voucher yang digunakan (NULL jika tidak ada)';
COMMENT ON COLUMN transactions.discount_amount IS 'Nominal diskon pre-tax dalam IDR';

-- ── 4. Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vouchers_active_code
  ON vouchers(code) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_vouchers_valid_period
  ON vouchers(valid_from, valid_until) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_voucher_usages_txn
  ON voucher_usages(transaction_id);

CREATE INDEX IF NOT EXISTS idx_voucher_usages_customer
  ON voucher_usages(customer_id);

CREATE INDEX IF NOT EXISTS idx_transactions_voucher_code
  ON transactions(voucher_code) WHERE voucher_code IS NOT NULL;

COMMIT;
