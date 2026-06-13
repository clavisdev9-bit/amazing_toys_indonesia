-- CR-041: OTP login table (one-time use, 5-min TTL, bcrypt-hashed)
CREATE TABLE IF NOT EXISTS login_otps (
  id            SERIAL        PRIMARY KEY,
  user_id       UUID          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  otp_hash      VARCHAR(255)  NOT NULL,
  expires_at    TIMESTAMPTZ   NOT NULL,
  used_at       TIMESTAMPTZ,
  attempt_count SMALLINT      NOT NULL DEFAULT 0,
  ip_address    INET,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_otps_user_id    ON login_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_login_otps_expires_at ON login_otps(expires_at);

COMMENT ON TABLE login_otps IS 'CR-041: OTP satu kali pakai untuk verifikasi login device baru';
