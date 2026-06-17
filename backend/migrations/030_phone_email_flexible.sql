-- ============================================================
-- Migration 030 — Phone OR Email Auth (CR-Bazar International)
-- Membuat phone_number opsional; customer bisa daftar/login
-- menggunakan nomor HP (OTP WA) ATAU email (OTP Email).
-- Minimal salah satu wajib ada per customer.
-- ============================================================

-- 1. customers: jadikan phone_number nullable + CHECK constraint
ALTER TABLE customers
  ALTER COLUMN phone_number DROP NOT NULL;

ALTER TABLE customers
  ADD CONSTRAINT chk_customers_contact
  CHECK (phone_number IS NOT NULL OR email IS NOT NULL);

-- Unique index pada email (partial — hanya bila email tidak null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email
  ON customers (email) WHERE email IS NOT NULL;

-- 2. pending_registrations: tambah kolom identifier sebagai conflict key
--    identifier = phone_number atau email tergantung mode registrasi
ALTER TABLE pending_registrations
  ADD COLUMN IF NOT EXISTS identifier      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS identifier_type VARCHAR(10) DEFAULT 'phone';

-- Backfill: row lama pakai phone_number sebagai identifier
UPDATE pending_registrations
  SET identifier = phone_number, identifier_type = 'phone'
  WHERE identifier IS NULL AND phone_number IS NOT NULL;

-- Setelah backfill, jadikan NOT NULL
ALTER TABLE pending_registrations
  ALTER COLUMN identifier SET NOT NULL;

-- Jadikan phone_number nullable (registrasi email-only tidak punya phone)
ALTER TABLE pending_registrations
  ALTER COLUMN phone_number DROP NOT NULL;

-- DROP index lama (conflict key akan pindah ke identifier)
DROP INDEX IF EXISTS idx_pending_registrations_phone;

-- Index baru berdasarkan identifier
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_registrations_identifier
  ON pending_registrations (identifier);

-- 3. customer_login_attempts: tambah identifier, migrasi data, index baru
ALTER TABLE customer_login_attempts
  ADD COLUMN IF NOT EXISTS identifier VARCHAR(255);

-- Backfill dari phone_number yang sudah ada
UPDATE customer_login_attempts
  SET identifier = phone_number
  WHERE identifier IS NULL;

ALTER TABLE customer_login_attempts
  ALTER COLUMN identifier SET NOT NULL;

-- Drop index lama, buat yang baru
DROP INDEX IF EXISTS idx_customer_login_attempts_phone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_login_attempts_identifier
  ON customer_login_attempts (identifier);
