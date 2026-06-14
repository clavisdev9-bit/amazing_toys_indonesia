-- ============================================================
-- Migration 028 — CR-041 OTP Wajib Registrasi
-- Tabel sementara untuk menyimpan data registrasi pending
-- sebelum OTP WA diverifikasi
-- ============================================================

CREATE TABLE IF NOT EXISTS pending_registrations (
  id            SERIAL PRIMARY KEY,
  phone_number  VARCHAR(20)   NOT NULL,
  full_name     VARCHAR(255)  NOT NULL,
  email         VARCHAR(255),
  gender        VARCHAR(30)   NOT NULL DEFAULT 'PREFER_NOT_TO_SAY',
  birth_date    DATE,
  otp_hash      TEXT          NOT NULL,
  attempt_count INTEGER       NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ   NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_registrations_phone
  ON pending_registrations (phone_number);
