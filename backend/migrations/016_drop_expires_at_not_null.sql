-- Migration 016 — CR-041: Drop NOT NULL constraint on transactions.expires_at
-- HELPER_APPROVE orders (PENDING_APPROVAL status) have no timer until helper approves,
-- so expires_at must be nullable. The expiry sweep adds AND expires_at IS NOT NULL
-- to avoid touching PENDING_APPROVAL rows.

ALTER TABLE transactions
  ALTER COLUMN expires_at DROP NOT NULL;
