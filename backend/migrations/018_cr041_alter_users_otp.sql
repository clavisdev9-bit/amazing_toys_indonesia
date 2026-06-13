-- CR-041: Add OTP and email fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN users.email       IS 'CR-041: email untuk pengiriman OTP login';
COMMENT ON COLUMN users.otp_enabled IS 'CR-041: false = skip OTP (admin bypass only)';
