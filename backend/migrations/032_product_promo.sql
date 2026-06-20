-- Migration 032: Product Promotion Engine (Buy X Get Y)
-- Applied: 2026-06-20
-- Spec: Voucher B1G1/B2G1 — same product & cross product, auto-applied per cart item

BEGIN;

-- ── 1. Extend discount_type CHECK pada tabel vouchers ────────────────────────
--    Tambah nilai 'PRODUCT_PROMO' di samping 'PERCENT' dan 'FIXED'

-- Expand column — 'PRODUCT_PROMO' (13 chars) tidak muat di VARCHAR(10)
ALTER TABLE vouchers ALTER COLUMN discount_type TYPE VARCHAR(20);

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_discount_type_check;
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_percent_range;
-- vouchers_discount_value_pos (discount_value > 0) harus direlaksasi karena
-- PRODUCT_PROMO tidak punya nilai diskon nominal (discount_value = 0).
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_discount_value_pos;

ALTER TABLE vouchers
  ADD CONSTRAINT vouchers_discount_type_check
    CHECK (discount_type IN ('PERCENT', 'FIXED', 'PRODUCT_PROMO')),
  ADD CONSTRAINT vouchers_percent_range
    CHECK (
      discount_type <> 'PERCENT'
      OR (discount_value > 0 AND discount_value <= 100)
    ),
  ADD CONSTRAINT vouchers_discount_value_pos
    CHECK (discount_type = 'PRODUCT_PROMO' OR discount_value > 0);

-- ── 2. Tabel voucher_product_rule ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS voucher_product_rule (
  id               SERIAL PRIMARY KEY,
  voucher_id       INTEGER        NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  buy_product_id   VARCHAR(20)    NOT NULL REFERENCES products(product_id),
  free_product_id  VARCHAR(20)    REFERENCES products(product_id),
  -- NULL berarti same product (gratis produk yang sama dengan yang dibeli)
  buy_qty          INTEGER        NOT NULL DEFAULT 1 CHECK (buy_qty > 0),
  free_qty         INTEGER        NOT NULL DEFAULT 1 CHECK (free_qty > 0),
  max_free_qty     INTEGER        CHECK (max_free_qty > 0),
  -- NULL = tidak ada batas maksimum gratis
  priority         INTEGER        NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  voucher_product_rule                    IS 'Aturan promo Buy X Get Y per produk';
COMMENT ON COLUMN voucher_product_rule.free_product_id   IS 'NULL = same product sebagai buy_product_id';
COMMENT ON COLUMN voucher_product_rule.max_free_qty      IS 'Batas maksimum item gratis. NULL = tidak ada batas';
COMMENT ON COLUMN voucher_product_rule.priority          IS 'Urutan penerapan jika ada multiple rules (ASC)';

-- ── 3. Extend tabel transaction_items ────────────────────────────────────────

ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS is_free     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS free_reason VARCHAR(50);

COMMENT ON COLUMN transaction_items.is_free     IS 'TRUE jika item ini adalah item gratis dari promo';
COMMENT ON COLUMN transaction_items.free_reason IS 'Kode voucher promo yang memberikan item gratis ini';

-- ── 4. Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vpr_voucher_id
  ON voucher_product_rule(voucher_id);

CREATE INDEX IF NOT EXISTS idx_vpr_buy_product
  ON voucher_product_rule(buy_product_id);

CREATE INDEX IF NOT EXISTS idx_vpr_free_product
  ON voucher_product_rule(free_product_id);

CREATE INDEX IF NOT EXISTS idx_txn_items_is_free
  ON transaction_items(is_free) WHERE is_free = TRUE;

COMMIT;
