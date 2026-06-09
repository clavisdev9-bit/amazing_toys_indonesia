-- ============================================================
-- Migration 015 — CR-040: Mode HELPER_APPROVE (Model D)
-- Customer self-orders → PENDING_APPROVAL → Helper approves
-- → stock deducted + timer starts only after approval
-- ============================================================

-- 1. Extend txn_status_enum with new PENDING_APPROVAL value
ALTER TYPE txn_status_enum ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';

-- 2. Add approval columns to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by        UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS timer_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_note      TEXT;

-- 3. Add per-item approval_status to transaction_items
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

-- 4. Index for efficient approval queue queries
CREATE INDEX IF NOT EXISTS idx_transactions_pending_approval
  ON transactions (created_at)
  WHERE status = 'PENDING_APPROVAL';
