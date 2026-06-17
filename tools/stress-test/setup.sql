-- ── Setup: buat user test untuk stress test ───────────────────────────────────
-- Jalankan: docker exec -i hybrid_postgres psql -U postgres -d amazing_toys_hybrid < tools/stress-test/setup.sql
-- Password semua user test: test1234
-- Hash bcrypt rounds=10 untuk 'test1234': $2b$10$qLE5AkSJbcXzjhyfMq/FdO3s444FvSdnuFepizL2Ix2yrEvkirxd2

-- Kasir untuk stress test
INSERT INTO users (username, password_hash, role, display_name, is_active)
VALUES
  ('kasir_stress01', '$2b$10$qLE5AkSJbcXzjhyfMq/FdO3s444FvSdnuFepizL2Ix2yrEvkirxd2', 'CASHIER', 'Kasir Stress 01', TRUE),
  ('kasir_stress02', '$2b$10$qLE5AkSJbcXzjhyfMq/FdO3s444FvSdnuFepizL2Ix2yrEvkirxd2', 'CASHIER', 'Kasir Stress 02', TRUE),
  ('kasir_stress03', '$2b$10$qLE5AkSJbcXzjhyfMq/FdO3s444FvSdnuFepizL2Ix2yrEvkirxd2', 'CASHIER', 'Kasir Stress 03', TRUE),
  ('kasir_stress04', '$2b$10$qLE5AkSJbcXzjhyfMq/FdO3s444FvSdnuFepizL2Ix2yrEvkirxd2', 'CASHIER', 'Kasir Stress 04', TRUE),
  ('kasir_stress05', '$2b$10$qLE5AkSJbcXzjhyfMq/FdO3s444FvSdnuFepizL2Ix2yrEvkirxd2', 'CASHIER', 'Kasir Stress 05', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Helper untuk stress test (menggunakan tenant pertama)
INSERT INTO users (username, password_hash, role, tenant_id, display_name, is_active)
SELECT
  'helper_stress01',
  '$2b$10$qLE5AkSJbcXzjhyfMq/FdO3s444FvSdnuFepizL2Ix2yrEvkirxd2',
  'HELPER',
  tenant_id,
  'Helper Stress 01',
  TRUE
FROM tenants ORDER BY tenant_id ASC LIMIT 1
ON CONFLICT (username) DO NOTHING;

-- Pastikan WA gateway DISABLED agar tidak spam WA sungguhan saat test
UPDATE system_settings SET value = '"DISABLED"' WHERE key = 'wa_gateway_provider';

-- Tampilkan user yang dibuat
SELECT username, role, display_name FROM users WHERE username LIKE '%stress%';

-- ── CLEANUP (jalankan setelah stress test selesai) ────────────────────────────
-- DELETE FROM users WHERE username LIKE '%stress%';
-- DELETE FROM transactions WHERE customer_phone LIKE '0899%' AND created_at > NOW() - INTERVAL '1 day';
