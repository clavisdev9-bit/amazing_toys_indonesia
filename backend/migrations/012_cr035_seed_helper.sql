-- ── CR-035: Seed HELPER user ──────────────────────────────────────────────────
-- Must run in a SEPARATE session from 011_cr035 because PostgreSQL does not
-- allow using new enum values (HELPER) in the same session that added them.
-- Password: helper123  (bcrypt hash rounds=10)
-- Change via Admin panel after first login.

INSERT INTO users (username, password_hash, role, tenant_id, display_name, is_active)
SELECT
  'helper01',
  '$2b$10$jyZuSqMSQNQ7GGVbpotpEe2foIgZXB/u65u9uhHDy3w3QzZHS6Bny',
  'HELPER',
  t.tenant_id,
  'Helper Booth 01',
  TRUE
FROM tenants t
ORDER BY t.tenant_id ASC
LIMIT 1
ON CONFLICT (username) DO NOTHING;
