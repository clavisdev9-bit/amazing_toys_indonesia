# Dokumentasi Amazing Toys SOS

## Perbedaan `http://localhost/` vs `http://localhost:5173/`

Keduanya menampilkan aplikasi React yang sama, tetapi lewat jalur berbeda.

---

### `http://localhost:5173/` — Mode Development

| Aspek | Detail |
|---|---|
| Dijalankan oleh | Vite dev server (`npm run dev` di folder `frontend/`) |
| Hot Reload | **Ya** — perubahan kode langsung terlihat di browser tanpa refresh manual |
| API proxy | Vite meneruskan `/api`, `/uploads`, `/ws` → `localhost:3001` (backend Node.js) |
| Butuh Docker? | **Tidak** — backend berjalan langsung di mesin, bukan container |
| Kecepatan startup | Sangat cepat, cocok untuk coding aktif |

**Cara menjalankan:**
```bash
# Dari folder frontend/
npm run dev
```

---

### `http://localhost/` (port 80) — Mode Production (Docker)

| Aspek | Detail |
|---|---|
| Dijalankan oleh | Nginx di dalam Docker container (`docker-compose up`) |
| Hot Reload | **Tidak** — kode di-build dulu (`npm run build`), lalu di-serve secara static |
| API proxy | Nginx meneruskan `/api`, `/uploads`, `/ws` → container `backend:3001` |
| Butuh Docker? | **Ya** — semua service berjalan dalam container |
| Kecepatan startup | Lebih lambat, ini yang dipakai di production |

**Cara menjalankan:**
```bash
# Dari root project
docker-compose up --build
```

---

### Kapan Memilih Masing-Masing

**Gunakan `:5173` saat:**
- Sedang aktif mengembangkan atau debug kode
- Ingin melihat perubahan kode langsung (hot reload)
- Tidak perlu integration service Odoo aktif

**Gunakan port `80` (Docker) saat:**
- Ingin menguji hasil build final
- Ingin menguji semua service terintegrasi (termasuk integration service Odoo)
- Ingin simulasi environment production atau demo ke stakeholder

---

## Arsitektur Services & Port

| Service | Teknologi | Port (host) | Port (internal) | Keterangan |
|---|---|---|---|---|
| Frontend | React + Vite / Nginx | 5175 (dev) / 8080 (prod) | 80 | UI kiosk dan kasir |
| Backend | Node.js / Express | 3002 (dev) | 3001 | REST API + WebSocket |
| Integration | Node.js | — | 4000 | Sync ke Odoo 18 |
| Database | PostgreSQL | — | 5432 | DB: `amazing_toys_hybrid` |
| WAHA | devlikeapro/waha | 3010 | 3000 | Self-hosted WhatsApp HTTP API |

---

## Alur Integrasi Odoo

1. Customer checkout → transaksi `PENDING` dibuat di DB
2. Kasir scan QR → proses pembayaran → status jadi `PAID`
3. Backend kirim webhook ke integration service (`http://localhost:4000/webhook/order-paid`)
4. Integration service ambil data transaksi, resolve ID produk Odoo, buat `sale.order` di Odoo lalu confirm
5. Retry otomatis jika gagal: backoff 60s → 300s → dead-letter queue

---

## CR-029 — Sistem Voucher Diskon End-to-End

**Tanggal:** 2026-06-04

Fitur diskon berbasis kode voucher yang terintegrasi dari UI Admin → SOS Backend → Odoo 18.

---

### File Baru

| File | Deskripsi |
|---|---|
| `backend/migrations/010_voucher_tables.sql` | Tabel `vouchers`, `voucher_usages`, extend kolom `voucher_code` & `discount_amount` ke `transactions` |
| `backend/src/modules/vouchers/vouchers.service.js` | Logic validasi, pemakaian, dan CRUD admin voucher |
| `backend/src/modules/vouchers/vouchers.routes.js` | Endpoint REST untuk customer, cashier, dan admin |
| `frontend/src/api/vouchers.js` | API client untuk semua endpoint voucher |
| `frontend/src/components/cart/VoucherInput.jsx` | Komponen input kode voucher di halaman keranjang |
| `frontend/src/pages/admin/tabs/VoucherTab.jsx` | Tab manajemen voucher di halaman `/admin` |

---

### File Dimodifikasi

| File | Perubahan |
|---|---|
| `backend/src/modules/orders/orders.service.js` | `createOrder` & `createOrderByCashier` menerima `voucherCode`; PPN dihitung ulang dari `(subtotal − diskon)` |
| `backend/src/modules/orders/orders.router.js` | Body `POST /orders` menerima field opsional `voucher_code` |
| `backend/src/app.js` | Register route `/api/v1/vouchers` dan `/api/v1/admin/vouchers` |
| `integration/src/services/order.push.js` | Kirim `discount` per `sale.order.line` dan `x_voucher_code` ke Odoo |
| `integration/src/clients/odoo.client.js` | Deteksi `hasVoucherCodeField` di startup refs |
| `frontend/src/context/CartContext.jsx` | State `appliedVoucher`, `discountAmount`; fungsi `applyVoucher`, `removeVoucher` |
| `frontend/src/api/orders.js` | `createOrder(items, voucherCode)` |
| `frontend/src/pages/customer/CartPage.jsx` | `VoucherInput` + ringkasan Subtotal / Diskon / PPN / Total |
| `frontend/src/pages/admin/AdminPage.jsx` | Tab baru `🏷️ Voucher` |
| `frontend/src/components/cashier/ThermalReceipt.jsx` | Baris diskon sebelum TOTAL |
| `frontend/src/pages/customer/ReceiptPickupPage.jsx` | Baris diskon sebelum TOTAL |
| `backend/src/modules/print/print.service.js` | Baris diskon di ESC/POS output |

---

### API Endpoints Baru

| Method | Endpoint | Auth | Fungsi |
|---|---|---|---|
| `POST` | `/api/v1/vouchers/validate` | CUSTOMER / CASHIER / LEADER | Validasi kode voucher terhadap cart |
| `POST` | `/api/v1/vouchers/apply` | ADMIN | Record pemakaian voucher (internal) |
| `GET` | `/api/v1/admin/vouchers` | ADMIN | List semua voucher |
| `GET` | `/api/v1/admin/vouchers/:code` | ADMIN | Detail satu voucher |
| `POST` | `/api/v1/admin/vouchers` | ADMIN | Buat voucher baru |
| `PATCH` | `/api/v1/admin/vouchers/:code` | ADMIN | Update voucher |
| `DELETE` | `/api/v1/admin/vouchers/:code` | ADMIN | Nonaktifkan voucher (soft delete) |

---

### Tabel Database Baru

**`vouchers`** — master data kode diskon:

| Kolom | Tipe | Keterangan |
|---|---|---|
| `code` | VARCHAR(50) UNIQUE | Kode unik, selalu UPPERCASE |
| `discount_type` | VARCHAR(10) | `PERCENT` atau `FIXED` |
| `discount_value` | NUMERIC(12,2) | Persen (0–100) atau nominal IDR |
| `min_purchase` | NUMERIC(14,2) | Minimum belanja pre-tax. Default: 0 |
| `max_discount` | NUMERIC(14,2) | Cap nominal diskon untuk tipe PERCENT (NULL = tidak ada cap) |
| `usage_limit` | INTEGER | Batas total pemakaian (NULL = unlimited) |
| `usage_count` | INTEGER | Counter pemakaian aktual |
| `valid_from` / `valid_until` | TIMESTAMPTZ | Masa berlaku |
| `is_active` | BOOLEAN | FALSE = soft deleted |
| `tenant_id` | VARCHAR(10) | Batasi ke satu tenant (NULL = semua tenant) |

**`voucher_usages`** — histori pemakaian per transaksi:

| Kolom | Tipe | Keterangan |
|---|---|---|
| `voucher_code` | VARCHAR(50) → `vouchers(code)` | FK |
| `transaction_id` | VARCHAR(30) | Format TXN-YYYYMMDD-NNNNN |
| `customer_id` | UUID → `customers(customer_id)` | NULL untuk Walk-in |
| `discount_amount` | NUMERIC(14,2) | Nominal diskon yang diberikan |
| `UNIQUE (voucher_code, transaction_id)` | | Idempotency guard |

**Extend `transactions`** (dua kolom baru):

| Kolom | Tipe | Keterangan |
|---|---|---|
| `voucher_code` | VARCHAR(50) → `vouchers(code)` | NULL jika tidak pakai voucher |
| `discount_amount` | NUMERIC(14,2) DEFAULT 0 | Nominal diskon pre-tax |

---

### Rumus Kalkulasi Harga dengan Diskon

```
subtotal_amount   = SUM(unit_price × qty)          -- sebelum pajak & diskon
discount_amount   = hasil validasi voucher           -- pre-tax
taxable_amount    = subtotal_amount − discount_amount
tax_amount        = ROUND(taxable_amount × tax_rate / 100)
total_amount      = taxable_amount + tax_amount
```

PPN selalu dihitung **setelah** diskon diterapkan, bukan dari subtotal asli.

---

### Tampilan di Admin (`/admin` → tab Voucher)

- **4 summary cards**: Total Voucher, Aktif, Total Pemakaian, Expired/Nonaktif
- **Filter tabs**: Semua / Aktif / Nonaktif+Expired
- **Tabel voucher**: kode, tipe+nilai, masa berlaku, progress bar pemakaian, status badge, aksi
- **Modal Buat**: form lengkap dengan toggle PERCENT/FIXED, field kondisional (max_discount hanya untuk PERCENT), datetime picker, dropdown tenant
- **Modal Edit**: form yang sama, kode tidak bisa diubah
- **Modal Nonaktifkan**: konfirmasi soft delete
- **Kotak Info**: penjelasan cara kerja untuk operator

---

### Tampilan di Customer (`/keranjang`)

Setelah daftar item, muncul bagian **"Voucher Diskon"**:
- Input kode + tombol "Pakai"
- Validasi real-time dengan pesan error spesifik per kode error
- Chip hijau jika valid: "Voucher KODE — hemat Rp X" + tombol ×
- Ringkasan harga: Subtotal / Diskon / PPN / **Total**

---

### Tampilan di Receipt

Baris diskon otomatis muncul di semua jalur rendering jika `discount_amount > 0`:

| Jalur | File |
|---|---|
| Print modal kasir (layar) | `ThermalReceipt.jsx` |
| Digital receipt customer | `ReceiptPickupPage.jsx` |
| ESC/POS thermal printer | `print.service.js` |

Format: `Diskon (KODE)  − Rp X.XXX` sebelum baris TOTAL.

---

### Odoo Setup (wajib sebelum production)

Dua langkah manual di Odoo sebelum field diskon terkirim ke Odoo SO:

1. **Aktifkan Discounts**: Settings → Sales → Pricing → centang "Discounts"
2. **Buat field `x_voucher_code`** (Char 50) di `sale.order` via Odoo Shell:
   ```python
   env['ir.model.fields'].create({
     'model_id': env['ir.model'].search([('model','=','sale.order')]).id,
     'name': 'x_voucher_code',
     'field_description': 'SOS Voucher Code',
     'ttype': 'char', 'size': 50,
   })
   env.cr.commit()
   ```

Panduan lengkap: `docs/voucher-implementation-prompts.md` → Prompt E.


Dokumentasi Perubahan — Environment Differentiation & Bug Fix
Tanggal: 2026-06-06

Scope: Pemisahan identitas project amazing_toys_odoo_online - Hybrid dari project original + bug fix login HELPER

Latar Belakang
Kedua project (C:\Dev\amazing_toys_odoo_online dan C:\Dev\amazing_toys_odoo_online - Hybrid) sebelumnya identik dalam hal container name, port, database name, dan package name. Hal ini menyebabkan:

Konflik Docker saat keduanya dijalankan bersamaan
Developer tidak bisa membedakan file mana yang sedang dikerjakan
helper01 tidak bisa login karena Vite dev server di port 5175 mengarah ke backend project original (port 3001) yang tidak mengenal user HELPER
File yang Diubah
1. .env — Identitas project + port baru

+ # PROJECT : Amazing Toys SOS — HYBRID (Model C)
+ # Containers : hybrid_postgres · hybrid_backend · hybrid_integration · hybrid_frontend
+ # DB         : amazing_toys_hybrid
+ # Docker URL : http://localhost:8080
+ # Vite dev   : http://localhost:5175  (proxy → backend port 3002)
+ COMPOSE_PROJECT_NAME=hybrid
+ FRONTEND_PORT=8080
+ BACKEND_DEV_PORT=3002
+ CORS_ORIGIN=http://localhost:8080
2. docker-compose.yml — Container & DB rename
Sebelum	Sesudah
container_name: sos_postgres	container_name: hybrid_postgres
container_name: sos_backend	container_name: hybrid_backend
container_name: sos_integration	container_name: hybrid_integration
container_name: sos_frontend	container_name: hybrid_frontend
POSTGRES_DB: amazing_toys_sos	POSTGRES_DB: amazing_toys_hybrid
DB_NAME: amazing_toys_sos	DB_NAME: amazing_toys_hybrid
FRONTEND_PORT: 80	FRONTEND_PORT: 8080
Volume: postgres_data	Volume: hybrid_postgres_data
Network: sos-net	Network: hybrid-net
(backend tidak expose port ke host)	ports: "${BACKEND_DEV_PORT:-3002}:3001"
Juga ditambahkan migration init scripts yang sebelumnya hilang:


+ 009_stock_sync_log.sql        → 13_stock_sync_log.sql
+ 009_payment_voucher_xref.sql  → 14_payment_voucher_xref.sql
+ 010_voucher_tables.sql        → 15_voucher_tables.sql
+ 011_cr035_hybrid_model_c.sql  → 16_cr035_hybrid_model_c.sql
+ 012_cr035_seed_helper.sql     → 17_cr035_seed_helper.sql
3. frontend/vite.config.js — Port Vite dev server

- port: 5173,
+ port: 5175,
  proxy:
-   '/api': { target: 'http://localhost:3001' }
+   '/api': { target: 'http://localhost:3002' }
4. frontend/index.html — Browser tab title

- <title>Amazing Toys SOS</title>
+ <title>Amazing Toys SOS · Hybrid</title>
5. frontend/src/components/layout/StaffShell.jsx — Badge visual HYBRID
Menambahkan badge kuning HYBRID di sidebar semua halaman staff, sehingga developer langsung tahu mereka sedang di environment Hybrid.

6. frontend/src/pages/staff/LoginStaffPage.jsx — Bug fix login HELPER

- const roleHome = { CASHIER: '/cashier', TENANT: '/tenant', LEADER: '/leader', ADMIN: '/leader' };
+ const roleHome = { CASHIER: '/cashier', TENANT: '/tenant', LEADER: '/leader', ADMIN: '/admin', HELPER: '/helper' };

- <p>Kasir · Tenant · Leader</p>
+ <p>Kasir · Tenant · Leader · Helper</p>
Bug: HELPER tidak ada di roleHome, menyebabkan redirect ke / setelah login berhasil. Efek visual: error "Username atau password salah" pada project original karena developer salah menggunakan backend yang berbeda.

7. frontend/src/components/guards/RequireRole.jsx

+ HELPER: '/helper',
8. backend/package.json & frontend/package.json

- "name": "amazing-toys-sos-backend"
+ "name": "amazing-toys-sos-hybrid-backend"
- "version": "1.0.0"
+ "version": "2.0.0"
- "description": "Self-Order System Backend API"
+ "description": "Hybrid Booth Approval System Backend API"
Dev script safety guard juga diperbarui dari sos_backend → hybrid_backend.

9. backend/data/system-config.json

+ "app_env": "hybrid",
+ "order_mode": "HELPER_INPUT",
File Baru (CR-035 — sudah ada di sesi sebelumnya, baru terdaftar)
File	Keterangan
backend/migrations/011_cr035_hybrid_model_c.sql	DDL additive: enum baru, kolom baru, product flags
backend/migrations/012_cr035_seed_helper.sql	Seed helper01 — dipisah dari 011 karena PostgreSQL tidak izinkan penggunaan enum baru di session yang sama
backend/src/modules/orders/status.machine.js	Central state machine semua transisi status
backend/src/modules/helper/helper.service.js	Business logic HELPER
backend/src/modules/helper/helper.router.js	REST endpoint /api/v1/helper/*
frontend/src/api/helper.js	API client HELPER
frontend/src/pages/helper/HelperPage.jsx	UI 3-tab: Buat Order · Riwayat · Serah Terima
Cara Menjalankan
Docker (production-like)

cd "C:\Dev\amazing_toys_odoo_online - Hybrid"
docker compose up -d          # http://localhost:8080
Vite Dev (hot reload)

cd frontend && npm run dev    # http://localhost:5175
# API proxy → http://localhost:3002 (hybrid_backend)
Login staff
URL: http://localhost:8080/staff/masuk atau http://localhost:5175/staff/masuk

User	Password	Role	Redirect
helper01	helper123	HELPER	/helper
kasir01	password123	CASHIER	/cashier
admin	admin	ADMIN	/admin
apakah ada role tenant
Bash Check TENANT users in hybrid DB
IN
docker exec -i hybrid_postgres psql -U postgres -d amazing_toys_hybrid -c "SELECT username, role, tenant_id, is_active FROM users WHERE role='TENANT';"

OUT
  username   |  role  | tenant_id | is_active 
-------------+--------+-----------+-----------
 tenant_t001 | TENANT | T001      | t
(1 row)
Ada. Login:

Username	Password	Role	Tenant
tenant_t001	password123	TENANT	T001
URL: http://localhost:8080/staff/masuk → redirect ke /tenant setelah login.

---

## CR-035 — Hybrid Model C: HELPER + Central Cashier

**Tanggal:** 2026-06-05

Model operasional baru di mana HELPER di booth membuat pesanan atas nama customer, lalu customer membayar di Kasir Pusat.

### Alur Order

```
HELPER buat order → RESERVED
  → Customer bayar ke Kasir Pusat → PENDING → PAID
```

### Role Baru: HELPER

| Field | Nilai |
|---|---|
| Login | `http://localhost:8080/staff/masuk` |
| Default user | `helper01` / `helper123` |
| Halaman utama | `/helper` |

### Endpoint Baru

| Method | Endpoint | Auth | Fungsi |
|---|---|---|---|
| `GET` | `/api/v1/helper/products` | HELPER | Daftar produk aktif di booth |
| `POST` | `/api/v1/helper/orders` | HELPER | Buat order RESERVED |
| `GET` | `/api/v1/helper/orders` | HELPER | Riwayat order dibuat oleh helper ini |
| `GET` | `/api/v1/cashier/queue` | CASHIER/LEADER | Antrian order RESERVED + PENDING |

### Mode Operasi (`order_mode`)

Dikonfigurasi di `backend/data/system-config.json`:

| Nilai | Perilaku |
|---|---|
| `SELF_ORDER` | Customer buat order sendiri via kiosk (mode lama) |
| `HELPER_INPUT` | HELPER buat order di booth; kasir tidak bisa buat order baru |

---

## CR-036 — Three-Layer QR Delivery & WA API / WAHA

**Tanggal:** 2026-06-07

Tiga lapisan pengiriman QR order ke customer:
- **Layer 1** — WhatsApp/SMS via WA gateway (fire-and-forget)
- **Layer 2** — WebSocket push ke halaman order customer
- **Layer 3** — QR code di layar Helper setelah order dibuat

### WA API Tab di Admin

Halaman `/admin` → tab **📲 WA API** — konfigurasi provider WhatsApp gateway.

**Provider yang didukung:**

| Provider | Keterangan |
|---|---|
| `disabled` | Layer 1 dilewati; order tetap berjalan normal |
| `waha` | Self-hosted WhatsApp HTTP API (WAHA) — `devlikeapro/waha` |
| `wablas` | API Key dari dashboard Wablas |
| `zenziva` | Format apiKey: `userkey:passkey` |
| `twilio` | Format apiKey: `accountSid:authToken` |

### Setup WAHA (Self-hosted)

WAHA berjalan sebagai Docker service `sos_waha` (container: `hybrid_waha`) di port `3010`.

**Akses:**

| URL | Keterangan |
|---|---|
| `http://localhost:3010` | Swagger UI — docs & test API |
| `http://localhost:3010/api/...` | REST API endpoint |

**Autentikasi:** Tidak ada username/password. WAHA menggunakan **API Key** via header `X-Api-Key`.

```env
# .env — kosongkan jika tidak ingin autentikasi
WAHA_API_KEY=rahasia-api-key-kamu
```

Jika `WAHA_API_KEY` tidak diset → WAHA berjalan tanpa autentikasi.

**Konfigurasi di Admin Panel:**

1. Pilih provider `WAHA (Self-hosted)`
2. Isi **Session Name** (default: `default`)
3. Isi **WAHA Base URL**: `http://localhost:3010` (dev) atau `http://hybrid_waha:3000` (internal Docker)
4. Isi **X-Api-Key** jika diset (opsional)
5. Klik **Mulai Session** → scan QR dengan WhatsApp

**Status session WAHA:**

| Status | Keterangan |
|---|---|
| `WORKING` | Terhubung, siap kirim pesan |
| `SCAN_QR_CODE` | Menunggu scan QR — QR auto-refresh tiap 15 detik |
| `STARTING` | Sedang memulai |
| `STOPPED` | Session dihentikan |
| `FAILED` | Gagal terhubung |

### chatId Format (WAHA)

```
0812xxxxxxxx → 62812xxxxxxxx@c.us
```

Strip non-digit, ganti awalan `0` → `62`, tambahkan `@c.us`.

### Endpoint Proxy WAHA (via Backend)

Browser tidak bisa langsung akses `http://hybrid_waha:3000` (URL internal Docker). Semua call WAHA diproxy via backend:

| Method | Endpoint Backend | Fungsi |
|---|---|---|
| `GET` | `/api/v1/admin/wa-gateway/waha/status` | Cek status session |
| `POST` | `/api/v1/admin/wa-gateway/waha/start` | Mulai / upsert session |
| `GET` | `/api/v1/admin/wa-gateway/waha/qr` | Ambil QR sebagai base64 JSON |

### Migration Baru

| File | Keterangan |
|---|---|
| `backend/migrations/013_cr036_qr_delivery.sql` | Kolom `public_token`, `wa_delivery_status` di `transactions`; seed WA config keys |
| `backend/migrations/014_cr036_waha_session.sql` | Seed `wa_waha_session = "default"` di `system_settings` |

---

## BUG-023 — Halaman POS Langsung (/cashier/pos) Hilang

**Tanggal:** 2026-06-07  
**Related CR:** CR-023

### Symptom

Route `/cashier/pos` menampilkan 404. Nav item "🛒 POS Langsung" tidak ada di sidebar kasir.

### Root Cause

`CashierPOSPage.jsx` hilang dari filesystem (akibat git reset / file deletion). Backend dan API layer tetap intact — hanya layer frontend yang hilang.

### Fix

| File | Perubahan |
|---|---|
| `frontend/src/pages/cashier/CashierPOSPage.jsx` | Dibuat ulang — 2-panel POS |
| `frontend/src/App.jsx` | Import + nav item + route `/cashier/pos` ditambahkan kembali |
| `frontend/src/pages/cashier/CashierDashboardPage.jsx` | Banner shortcut biru ke POS Langsung |

### Cara Pakai POS Langsung

1. Login sebagai `kasir01` → `http://localhost:8080/staff/masuk`
2. Klik banner **🛒 POS Langsung** di dashboard, atau klik nav item "POS Langsung" di sidebar
3. Browse produk di panel kiri — search + filter kategori
4. Klik produk → masuk ke keranjang (panel kanan)
5. Atur qty dengan tombol `+` / `−`
6. Klik **💳 Bayar** → redirect ke halaman pembayaran normal

**Catatan:** Di mode `HELPER_INPUT`, kasir tidak bisa membuat order baru (backend return 403). POS Langsung hanya aktif di mode `SELF_ORDER`.