-- Migration 029 — CR-05X: Pre-Order Flow
-- Tambah kolom pre-order ke products dan transactions.
-- Idempotent: semua perubahan menggunakan ADD COLUMN IF NOT EXISTS / ADD VALUE IF NOT EXISTS.
-- Schema guard di app.js juga wajib mengikuti (STD-010).

-- ── txn_status_enum — tambah nilai pre-order ──────────────────────────────────
-- ADD VALUE IF NOT EXISTS aman untuk re-run (PostgreSQL ≥ 9.1).
ALTER TYPE txn_status_enum ADD VALUE IF NOT EXISTS 'AWAITING_SHIPMENT';
ALTER TYPE txn_status_enum ADD VALUE IF NOT EXISTS 'SHIPPED';
ALTER TYPE txn_status_enum ADD VALUE IF NOT EXISTS 'ARRIVED';
ALTER TYPE txn_status_enum ADD VALUE IF NOT EXISTS 'PREORDER_HANDOVER';

-- ── actor_role_enum — tambah ADMIN untuk audit log pre-order ──────────────────
-- ADMIN melakukan updateShipment / confirmArrived; enum audit_log harus mencakup role ini.
ALTER TYPE actor_role_enum ADD VALUE IF NOT EXISTS 'ADMIN';

-- ── products ──────────────────────────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_preorder   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preorder_note TEXT;

-- ── transactions ──────────────────────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS order_type        VARCHAR(20) DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS shipping_name     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_phone    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS shipping_address  TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_province VARCHAR(100),
  ADD COLUMN IF NOT EXISTS courier           VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tracking_number   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipped_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handed_over_at    TIMESTAMPTZ;

-- Index untuk query preorder list (Admin/Helper)
CREATE INDEX IF NOT EXISTS idx_transactions_order_type
  ON transactions (order_type, status)
  WHERE order_type = 'PREORDER';
