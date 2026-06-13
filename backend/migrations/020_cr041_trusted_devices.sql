-- CR-041: Trusted devices table (30-day trust window)
CREATE TABLE IF NOT EXISTS trusted_devices (
  id               SERIAL        PRIMARY KEY,
  user_id          UUID          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  device_id        UUID          NOT NULL,
  fingerprint_hash VARCHAR(255),
  device_name      VARCHAR(150),
  browser          VARCHAR(100),
  ip_address       INET,
  last_login       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ   NOT NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_device ON trusted_devices(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_expires_at  ON trusted_devices(expires_at);

COMMENT ON TABLE trusted_devices IS 'CR-041: Device terverifikasi OTP, skip OTP selama expires_at';
