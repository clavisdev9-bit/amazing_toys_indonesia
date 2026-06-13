-- ============================================================
-- Migration 022 — Group Checkout (Multi-Booth Invoice)
-- Customer dapat merge beberapa TRX dari booth berbeda
-- menjadi 1 invoice untuk 1 pembayaran di kasir.
-- ============================================================

-- 1. Tabel transaction_groups
--    Menyimpan header group: total, status bayar, dan metadata kasir.
CREATE TABLE IF NOT EXISTS transaction_groups (
  group_id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code      VARCHAR(40)   NOT NULL UNIQUE,   -- e.g. GRP-20260613-0001
  cashier_id      UUID          REFERENCES users(user_id),
  customer_id     UUID          REFERENCES customers(customer_id),
  customer_phone  VARCHAR(20),
  customer_name   VARCHAR(120),

  -- Totals (sum dari semua TRX dalam group)
  subtotal_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Payment
  payment_method  VARCHAR(30),
  paid_at         TIMESTAMPTZ,
  payment_status  VARCHAR(20)   NOT NULL DEFAULT 'UNPAID',  -- UNPAID | PAID

  -- Audit
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. Tambah kolom group_id ke transactions
--    NULL = transaksi standalone (jalur lama, tidak berubah)
--    UUID = transaksi bagian dari group checkout
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES transaction_groups(group_id);

-- 3. Index untuk lookup cepat
CREATE INDEX IF NOT EXISTS idx_transactions_group_id
  ON transactions (group_id)
  WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_groups_customer
  ON transaction_groups (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_groups_phone
  ON transaction_groups (customer_phone)
  WHERE customer_phone IS NOT NULL;

-- 4. Sequence untuk group_code (GRP-YYYYMMDD-NNNN)
CREATE SEQUENCE IF NOT EXISTS transaction_groups_seq START 1;
