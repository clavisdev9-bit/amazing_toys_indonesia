-- Migration 024: Customer OTP & Trusted Devices
-- Applied: 2026-06-13
-- Deskripsi: Tabel OTP WA untuk customer login dan trusted device tracking.

BEGIN;

-- ── 1. customer_otps ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_otps (
  id            SERIAL PRIMARY KEY,
  customer_id   UUID        NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  otp_hash      TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  attempt_count INTEGER     NOT NULL DEFAULT 0,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_otps_customer_id ON customer_otps (customer_id);

-- ── 2. customer_trusted_devices ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_trusted_devices (
  id           SERIAL PRIMARY KEY,
  customer_id  UUID         NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  device_id    UUID         NOT NULL,
  device_name  VARCHAR(200),
  browser      VARCHAR(200),
  ip_address   INET,
  last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_trusted_devices_lookup
  ON customer_trusted_devices (customer_id, device_id);

COMMIT;
