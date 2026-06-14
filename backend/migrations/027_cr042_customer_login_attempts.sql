-- ============================================================
-- Migration 027 — CR-042 Rate Limit + Lockout Login Customer
-- Tabel untuk tracking percobaan login gagal per nomor HP
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_login_attempts (
  id            SERIAL PRIMARY KEY,
  phone_number  VARCHAR(20) NOT NULL,
  attempt_count INTEGER     NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  last_attempt  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notif_sent    BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_login_attempts_phone
  ON customer_login_attempts (phone_number);
