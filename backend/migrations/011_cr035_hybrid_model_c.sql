-- =============================================================================
-- Migration 011: CR-035 — Hybrid Booth Approval Model C
-- Extends enums, transactions, products, users, tenants for HELPER flow.
-- All changes are ADDITIVE (no DROP, no RENAME).
-- Rollback: set order_mode='SELF_ORDER' in system-config.json — no schema rollback needed.
-- =============================================================================

BEGIN;

-- ── 1. Extend txn_status_enum ─────────────────────────────────────────────────
-- RESERVED       : helper approved, stock locked, QR generated
-- WAITING_PAYMENT: cashier scanned, awaiting payment
-- HANDED_OVER    : helper confirmed physical handover
-- COMPLETED      : fully done (post-handover)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'txn_status_enum' AND e.enumlabel = 'RESERVED') THEN
    ALTER TYPE txn_status_enum ADD VALUE 'RESERVED';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'txn_status_enum' AND e.enumlabel = 'WAITING_PAYMENT') THEN
    ALTER TYPE txn_status_enum ADD VALUE 'WAITING_PAYMENT';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'txn_status_enum' AND e.enumlabel = 'HANDED_OVER') THEN
    ALTER TYPE txn_status_enum ADD VALUE 'HANDED_OVER';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'txn_status_enum' AND e.enumlabel = 'COMPLETED') THEN
    ALTER TYPE txn_status_enum ADD VALUE 'COMPLETED';
  END IF;
END$$;

-- ── 2. Extend user_role_enum ──────────────────────────────────────────────────
-- HELPER: booth staff who inputs orders on behalf of customers

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'user_role_enum' AND e.enumlabel = 'HELPER') THEN
    ALTER TYPE user_role_enum ADD VALUE 'HELPER';
  END IF;
END$$;

-- ── 3. Extend actor_role_enum (for audit log) ─────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'actor_role_enum' AND e.enumlabel = 'HELPER') THEN
    ALTER TYPE actor_role_enum ADD VALUE 'HELPER';
  END IF;
END$$;

-- ── 4. transactions — make customer_id nullable + audit columns ───────────────
-- customer_id becomes nullable so HELPER can create walk-in orders without
-- requiring the customer to have a registered account.

ALTER TABLE transactions
  ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS customer_phone    VARCHAR(20)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by_role   VARCHAR(20)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by_user   UUID         REFERENCES users(user_id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reserved_at       TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS handover_at       TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS handover_by       UUID         REFERENCES users(user_id) ON DELETE SET NULL DEFAULT NULL;

COMMENT ON COLUMN transactions.customer_phone   IS 'Walk-in customer phone (when customer_id is NULL)';
COMMENT ON COLUMN transactions.created_by_role  IS 'HELPER | CASHIER | CUSTOMER (legacy)';
COMMENT ON COLUMN transactions.created_by_user  IS 'user_id of HELPER who created this order';
COMMENT ON COLUMN transactions.reserved_at      IS 'Timestamp when stock was locked (RESERVED)';
COMMENT ON COLUMN transactions.handover_at      IS 'Timestamp of physical handover confirmation';
COMMENT ON COLUMN transactions.handover_by      IS 'user_id of HELPER who confirmed handover';

CREATE INDEX IF NOT EXISTS idx_txn_created_by ON transactions (created_by_user);
CREATE INDEX IF NOT EXISTS idx_txn_reserved_at ON transactions (reserved_at DESC) WHERE reserved_at IS NOT NULL;

-- ── 5. products — booth restriction flags ─────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_display_only   BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_on_hold        BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_per_customer  INTEGER      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bundle_group      VARCHAR(40)  DEFAULT NULL;

COMMENT ON COLUMN products.is_display_only  IS 'True = cannot be sold, display use only';
COMMENT ON COLUMN products.is_on_hold       IS 'True = temporarily blocked by artist';
COMMENT ON COLUMN products.max_per_customer IS 'Max qty any one customer can buy (NULL = unlimited)';
COMMENT ON COLUMN products.bundle_group     IS 'Bundle group ID: all products with same group must be sold together';

CREATE INDEX IF NOT EXISTS idx_products_display_hold ON products (is_display_only, is_on_hold) WHERE is_active = TRUE;

-- ── 6. tenants — per-booth order_mode override ───────────────────────────────
-- NULL = inherit global order_mode from system-config.json
-- 'HELPER_INPUT' = force hybrid mode for this booth
-- 'SELF_ORDER'   = allow legacy self-order for this booth

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS order_mode VARCHAR(20) DEFAULT NULL;

COMMENT ON COLUMN tenants.order_mode IS 'NULL = global, HELPER_INPUT or SELF_ORDER override per booth';

-- ── 7. system_settings — order_mode global default ───────────────────────────
-- Only insert if system_settings table exists (it may or may not be present
-- depending on when the DB was initialised vs which migrations ran).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'system_settings') THEN
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('order_mode', '"HELPER_INPUT"', NOW())
    ON CONFLICT (key) DO NOTHING;
  END IF;
END$$;

-- ── 8. Seed: HELPER user is seeded in 012_cr035_seed_helper.sql
-- (separate file required because PostgreSQL forbids using a new enum value
--  in the same session that added it via ALTER TYPE ADD VALUE)

COMMIT;
