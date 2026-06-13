-- CR-041: Refresh tokens per device (30-day TTL)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL        PRIMARY KEY,
  user_id     UUID          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  device_id   UUID          NOT NULL,
  token_hash  VARCHAR(255)  NOT NULL,
  expires_at  TIMESTAMPTZ   NOT NULL,
  revoked     BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_device ON refresh_tokens(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token       ON refresh_tokens(token_hash);

COMMENT ON TABLE refresh_tokens IS 'CR-041: Refresh token terikat device, TTL 30 hari';
