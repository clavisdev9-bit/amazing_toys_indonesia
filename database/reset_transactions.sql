-- ============================================================
-- RESET PRODUCTION - Amazing Toys SOS
-- Menghapus SEMUA data transaksi, customers, dan produk
-- tanpa mengubah struktur tabel.
--
-- DIPERTAHANKAN: users, tenants, vouchers (usage_count di-reset ke 0)
-- DIHAPUS     : semua transaksi, customers, produk, log, sesi
--
-- PERINGATAN: Operasi ini TIDAK BISA DIBATALKAN. Backup dulu!
-- Jalankan: psql -U postgres -d amazing_toys_hybrid -f reset_transactions.sql
-- ============================================================

BEGIN;

-- Nonaktifkan foreign key checks sementara
SET session_replication_role = 'replica';

-- -------------------------------------------------------
-- 1. Data transaksi inti
-- -------------------------------------------------------
TRUNCATE TABLE transaction_items        RESTART IDENTITY CASCADE;
TRUNCATE TABLE voucher_usages           RESTART IDENTITY CASCADE;
TRUNCATE TABLE return_requests          RESTART IDENTITY CASCADE;
TRUNCATE TABLE notifications            RESTART IDENTITY CASCADE;
TRUNCATE TABLE transactions             RESTART IDENTITY CASCADE;

-- -------------------------------------------------------
-- 2. Log & sinkronisasi
-- -------------------------------------------------------
TRUNCATE TABLE audit_log                RESTART IDENTITY CASCADE;
TRUNCATE TABLE stock_sync_log           RESTART IDENTITY CASCADE;
TRUNCATE TABLE cashier_sessions         RESTART IDENTITY CASCADE;

-- -------------------------------------------------------
-- 3. Integrasi Odoo
-- -------------------------------------------------------
TRUNCATE TABLE integration_xref         RESTART IDENTITY CASCADE;
TRUNCATE TABLE integration_audit        RESTART IDENTITY CASCADE;
TRUNCATE TABLE integration_dead_letter  RESTART IDENTITY CASCADE;

-- -------------------------------------------------------
-- 4. Sesi & keamanan (token, OTP, device)
-- -------------------------------------------------------
TRUNCATE TABLE login_otps               RESTART IDENTITY CASCADE;
TRUNCATE TABLE refresh_tokens           RESTART IDENTITY CASCADE;
TRUNCATE TABLE trusted_devices          RESTART IDENTITY CASCADE;

-- -------------------------------------------------------
-- 5. Hapus semua produk
-- -------------------------------------------------------
TRUNCATE TABLE products                 RESTART IDENTITY CASCADE;

-- -------------------------------------------------------
-- 6. Hapus semua customers (data testing)
-- -------------------------------------------------------
TRUNCATE TABLE customers                RESTART IDENTITY CASCADE;

-- -------------------------------------------------------
-- 7. Reset usage counter voucher ke 0
-- -------------------------------------------------------
UPDATE vouchers SET usage_count = 0;

-- -------------------------------------------------------
-- 8. Reset last_login_at users agar sesi lama tidak valid
-- -------------------------------------------------------
UPDATE users SET last_login_at = NULL;

-- Aktifkan kembali foreign key checks
SET session_replication_role = 'origin';

COMMIT;

-- Verifikasi (semua harus 0 kecuali users & tenants)
SELECT
  'transactions'           AS tabel, COUNT(*) AS sisa FROM transactions          UNION ALL
SELECT 'transaction_items',           COUNT(*) FROM transaction_items             UNION ALL
SELECT 'customers',                   COUNT(*) FROM customers                     UNION ALL
SELECT 'products',                    COUNT(*) FROM products                      UNION ALL
SELECT 'voucher_usages',              COUNT(*) FROM voucher_usages                UNION ALL
SELECT 'return_requests',             COUNT(*) FROM return_requests               UNION ALL
SELECT 'notifications',               COUNT(*) FROM notifications                 UNION ALL
SELECT 'cashier_sessions',            COUNT(*) FROM cashier_sessions              UNION ALL
SELECT 'audit_log',                   COUNT(*) FROM audit_log                     UNION ALL
SELECT 'stock_sync_log',              COUNT(*) FROM stock_sync_log                UNION ALL
SELECT 'integration_xref',            COUNT(*) FROM integration_xref              UNION ALL
SELECT 'integration_audit',           COUNT(*) FROM integration_audit             UNION ALL
SELECT 'integration_dead_letter',     COUNT(*) FROM integration_dead_letter       UNION ALL
SELECT 'login_otps',                  COUNT(*) FROM login_otps                    UNION ALL
SELECT 'refresh_tokens',              COUNT(*) FROM refresh_tokens                UNION ALL
SELECT 'trusted_devices',             COUNT(*) FROM trusted_devices               UNION ALL
SELECT '--- DIPERTAHANKAN ---',       0                                           UNION ALL
SELECT 'users (aktif)',               COUNT(*) FROM users WHERE is_active = TRUE  UNION ALL
SELECT 'tenants (aktif)',             COUNT(*) FROM tenants WHERE is_active = TRUE UNION ALL
SELECT 'vouchers',                    COUNT(*) FROM vouchers
ORDER BY tabel;
