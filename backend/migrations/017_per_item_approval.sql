-- Migration 017 — Per-item approval support
-- Allows helper to approve/reject each item individually,
-- with optional quantity adjustment (e.g. partial stock, defective units).

ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS approved_quantity INTEGER,       -- NULL = full qty; <qty = partial approval
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;          -- set when approval_status = 'REJECTED'
