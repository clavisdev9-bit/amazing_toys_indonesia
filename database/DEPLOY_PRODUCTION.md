# Panduan Deploy Production — Amazing Toys Fair 2026

## Urutan yang Benar

### Tahap 1 — Persiapan (sebelum reset)

1. **Backup database dev/staging** (jangan sampai data dev ikut ke prod tanpa backup)
   ```bash
   docker exec hybrid_postgres pg_dump -U postgres amazing_toys_hybrid > backup_dev_$(date +%Y%m%d).sql
   ```

2. **Pastikan data master sudah final di database:**
   - Tenants: semua booth sudah terdaftar dengan data real
   - Users: kasir, leader, tenant portal sudah ada dengan password yang benar
   - Vouchers: kode voucher sudah disiapkan (jika ada)

3. **Catat password-password penting** (simpan di tempat aman):
   - Admin: password hash di `schema.sql` (default: `admin`) → **wajib ganti sebelum event**
   - Integration admin: `integration_admin_2026` → cek di `.env`

---

### Tahap 2 — Jalankan Reset Production

```bash
# Masuk ke container postgres
docker exec -it hybrid_postgres psql -U postgres -d amazing_toys_hybrid

# Atau langsung dari file
docker exec -i hybrid_postgres psql -U postgres -d amazing_toys_hybrid < database/reset_transactions.sql
```

**Yang akan dihapus:**
- Semua transaksi & item transaksi
- Semua customers (pengunjung testing)
- Semua produk
- Semua log (audit, sync, integration)
- Semua sesi aktif (token, OTP, device)

**Yang tetap ada:**
- `users` — kasir, leader, tenant, admin
- `tenants` — data booth
- `vouchers` — kode voucher (usage_count di-reset ke 0)

---

### Tahap 3 — Input Data Produk Real

Setelah reset, input produk nyata melalui salah satu cara:

**Opsi A — Via UI Admin**
Login sebagai Leader/Admin → Master Data → tambah produk satu per satu atau bulk import.

**Opsi B — Via SQL**
Buat file `database/seed_production.sql` dengan INSERT produk real:
```sql
INSERT INTO products (product_id, product_name, category, price, tenant_id, barcode, stock_quantity)
VALUES
  ('P001-T001', 'Nama Produk', 'Kategori', 150000.00, 'T001', 'BARCODE123', 10),
  ...;
```

---

### Tahap 4 — Verifikasi Sebelum Event Dibuka

- [ ] Login sebagai admin berhasil
- [ ] Ganti password default `admin` → password kuat
- [ ] Semua tenant bisa login ke portal mereka
- [ ] Produk tampil di kiosk customer
- [ ] QR payment bisa di-generate
- [ ] WebSocket notifikasi ke tenant berfungsi
- [ ] Cashier bisa scan & konfirmasi pembayaran
- [ ] `system-config.json` sudah diset ke `order_mode` yang benar

---

### Cara Menjalankan di Production Server

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild & restart containers
docker compose down
docker compose up -d --build

# 3. Jalankan reset (HANYA SEKALI sebelum event)
docker exec -i hybrid_postgres psql -U postgres -d amazing_toys_hybrid \
  < database/reset_transactions.sql

# 4. Cek output verifikasi — semua transaksi/customers/products harus 0
```

---

> **PENTING:** Script `reset_transactions.sql` **tidak bisa diundo**. 
> Selalu backup sebelum menjalankan.
