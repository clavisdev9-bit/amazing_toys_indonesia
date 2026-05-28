# System Architecture — Amazing Toys SOS
**Project:** Amazing Toys Self-Order System (SOS)  
**Event:** Amazing Toys Fair 2026  
**Version:** 1.0 — 2026-05-28  
**Author:** clavis Development

---

## 1. Ringkasan Sistem

Amazing Toys SOS adalah platform self-order berbasis web untuk event pameran mainan. Sistem memungkinkan pengunjung menelusuri produk, membuat pesanan mandiri via smartphone, dan mengambil barang di booth tenant — tanpa antre di kasir manual. Kasir hanya berperan sebagai konfirmator pembayaran.

Sistem terintegrasi penuh dengan **Odoo 18 ERP** untuk sinkronisasi produk, stok, customer, dan sales order secara otomatis.

---

## 2. Arsitektur High-Level

```
┌─────────────────────────────────────────────────────────────────────┐
│                          INTERNET / LAN                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │  :80
                    ┌────────▼────────┐
                    │   sos_frontend  │  Nginx + React SPA (Vite build)
                    │   (Docker)      │
                    └────────┬────────┘
                             │  proxy /api/* → :3001
                    ┌────────▼────────┐         ┌──────────────────┐
                    │   sos_backend   │─webhook─▶│ sos_integration  │
                    │   Express.js    │          │  Node.js         │
                    │   :3001         │◀─webhook─│  :4000           │
                    └────────┬────────┘          └────────┬─────────┘
                             │                           │
                    ┌────────▼────────┐                  │  JSON-RPC2
                    │   sos_postgres  │◀─────────────────┘
                    │   PostgreSQL 15 │
                    │   :5432         │          ┌──────────────────┐
                    └─────────────────┘          │   Odoo 18 ERP    │
                                                 │ edu-student4     │
                             ◀───── sync ────────│ .odoo.com        │
                                                 └──────────────────┘
```

### Container Overview

| Container | Image | Port Internal | Port Host | Peran |
|---|---|---|---|---|
| `sos_postgres` | postgres:15-alpine | 5432 | — | Database utama |
| `sos_backend` | Node.js (custom) | 3001 | — | REST API + WebSocket |
| `sos_integration` | Node.js (custom) | 4000 | — | Odoo sync middleware |
| `sos_frontend` | Nginx (custom) | 80 | **80** | React SPA + reverse proxy |

Semua container terhubung ke jaringan bridge `sos-net`. Hanya `sos_frontend` (port 80) yang diekspos ke luar.

---

## 3. Spesifikasi Komponen

### 3.1 Frontend — React SPA

| Atribut | Detail |
|---|---|
| Framework | React 18 + Vite 5 |
| Styling | Tailwind CSS v3 |
| State | React Context (Auth, Cart, Lang, Wishlist) |
| Routing | React Router v6 (role-based guards) |
| HTTP Client | Axios (Bearer JWT interceptor, auto-logout on 401) |
| Real-time | WebSocket native (custom `useWebSocket` hook) |
| QR Code | `qrcode.react` |
| Build output | Single JS bundle (`/assets/index-*.js`) baked into Docker image |
| Served by | Nginx 1.27-alpine |

**Role & Halaman:**

| Role | Halaman Utama |
|---|---|
| **CUSTOMER** | Browse produk, Cart, Checkout, Order tracking, Receipt pickup |
| **CASHIER** | Lookup TXN, Payment processing (CASH/QRIS/EDC/TRANSFER), Recap harian |
| **TENANT** | Incoming orders, Fulfillment, Laporan harian |
| **LEADER** | Dashboard KPI, Sales report, Return approval |
| **ADMIN** | User management, Konfigurasi sistem, Integrasi Odoo |

---

### 3.2 Backend — Express.js REST API

| Atribut | Detail |
|---|---|
| Runtime | Node.js 20 (LTS) |
| Framework | Express.js |
| Auth | JWT (HS256), 8h TTL staff / 24h TTL customer |
| Database Driver | `pg` (node-postgres) dengan connection pool (min: 2, max: 10) |
| Password Hashing | bcrypt (rounds: 10) |
| Real-time | WebSocket (`ws` library, co-hosted dengan HTTP server) |
| Rate Limiting | 1.000 req/15 menit per IP |
| Logging | Winston (level: info/debug) |
| Port | 3001 |

**Modul & Tanggung Jawab:**

| Modul | Endpoint Prefix | Fungsi Utama |
|---|---|---|
| `auth` | `/api/v1/auth` | Login/register staff & customer (phone-based) |
| `products` | `/api/v1/products` | CRUD katalog, barcode lookup, filter stok |
| `orders` | `/api/v1/orders` | Buat transaksi, deduct stok, generate QR |
| `payments` | `/api/v1/payments` | Konfirmasi bayar, lookup TXN, cashier recap |
| `cashier` | `/api/v1/cashier` | Shift management, sesi recap |
| `tenants` | `/api/v1/tenants` | CRUD booth & vendor, revenue share |
| `tenant-orders` | `/api/v1/tenant-orders` | Fulfillment pesanan per booth |
| `leader` | `/api/v1/leader` | KPI dashboard, sales analytics |
| `notifications` | `/api/v1/notifications` | FCM push + WebSocket broadcast |
| `receipts` | `/api/v1/receipts` | Generate & kirim e-receipt (email) |
| `print` | `/api/v1/print` | ESC/POS thermal printer (TCP socket) |
| `bca-qris` | `/api/v1/bca-qris` | QRIS dinamis BCA (webhook callback) |
| `admin` | `/api/v1/admin` | System config, bulk upload, Odoo settings |
| `wishlist` | `/api/v1/wishlist` | Favorit produk customer |
| `scheduler` | (internal) | Cron jobs: product sync & stock sync |

**Public Endpoint (no auth):**

```
GET /api/v1/config/public
```
Mengembalikan: `event_name`, `venue`, `event_date_start/end`, `logo_url`, `contact_email`, `maintenance_mode` — dikonsumsi oleh frontend tanpa token.

---

### 3.3 Database — PostgreSQL 15

**Skema Utama:**

```
customers          → pengunjung terdaftar (UUID PK)
tenants            → booth vendor (VARCHAR PK, format: T001...)
products           → katalog produk per tenant
users              → staff (CASHIER/TENANT/LEADER/ADMIN)
transactions       → order header (PK: TXN-YYYYMMDD-NNNNN)
transaction_items  → line item per transaksi
integration_xref   → peta ID SOS ↔ ID Odoo (entity_type, sos_id, odoo_id)
stock_sync_log     → audit trail sinkronisasi stok
return_requests    → retur barang (approved oleh LEADER)
cashier_sessions   → recap shift kasir
notifications      → history push notification ke tenant
audit_log          → log immutable semua aksi sistem
system_settings    → konfigurasi (JSON blob, key-value)
```

**Tipe Enumerasi:**

| Enum | Nilai |
|---|---|
| `txn_status_enum` | PENDING, PAID, CANCELLED, EXPIRED |
| `payment_method_enum` | CASH, QRIS, EDC, TRANSFER |
| `user_role_enum` | CASHIER, TENANT, LEADER, ADMIN |
| `stock_status_enum` | AVAILABLE, LOW_STOCK, OUT_OF_STOCK |
| `return_status_enum` | PENDING, APPROVED, REJECTED |

**Format Transaction ID:**
```
TXN-{YYYYMMDD}-{NNNNN}
Contoh: TXN-20260528-00009
```
Sequence direset setiap hari; daily counter diinisialisasi dari jumlah transaksi hari itu.

**View:**
- `v_transaction_summary` — TXN + customer + cashier + item count
- `v_tenant_sales` — revenue breakdown per tenant

**Trigger:**
- `fn_update_stock_status()` — otomatis set `stock_status` berdasarkan threshold: ≤0 → OUT_OF_STOCK, ≤5 → LOW_STOCK, >5 → AVAILABLE

**Tax Fields (transactions):**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `subtotal_amount` | NUMERIC(12,2) | Total sebelum pajak |
| `tax_rate` | NUMERIC(5,2) | % PPN saat transaksi dibuat (default: 12.00) |
| `tax_amount` | NUMERIC(12,2) | Nilai PPN |
| `total_amount` | NUMERIC(14,2) | Total inklusif pajak |

---

### 3.4 Integration Service — Odoo Sync Middleware

| Atribut | Detail |
|---|---|
| Runtime | Node.js 20 |
| Port | 4000 |
| Protokol ke Odoo | JSON-RPC 2.0 via HTTPS |
| Protokol dari Backend | HTTP Webhook (HMAC-SHA256 signed) |
| Database | Shared `amazing_toys_sos` PostgreSQL |
| Retry | Exponential backoff queue (`retry.queue.js`) |
| Circuit Breaker | Threshold 5 gagal → open state, reset 2 menit |

---

## 4. Integrasi Odoo 18

### 4.1 Konfigurasi Koneksi

| Parameter | Nilai |
|---|---|
| Base URL | `https://edu-student4.odoo.com` |
| Database | `edu-student4` |
| Login | `aristya.r@outlook.com` |
| Company | PT MYE INDONESIA (company_id: 5) |
| Auth Method | JSON-RPC session (`/web/session/authenticate`) |
| Tax | PPN 11% (Odoo tax_id: 19, name: "11%") |

### 4.2 Alur Sinkronisasi

```
┌──────────────────────────────────────────────────────────────┐
│                    SYNC DIRECTION MAP                        │
│                                                              │
│   Odoo 18                        SOS (PostgreSQL)            │
│                                                              │
│  product.product  ──pull──▶  products                        │
│  product.template ──pull──▶  products (name, category, price)│
│  stock.quant      ──pull──▶  products.stock_quantity         │
│                                                              │
│  res.partner      ◀──push──  customers (on register)         │
│  sale.order       ◀──push──  transactions (on PAID)          │
│  sale.order.line  ◀──push──  transaction_items               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Sinkronisasi Produk (Pull — Odoo → SOS)

**Trigger:** Scheduler, interval default 30 menit (configurable via Admin)

**Odoo Model:** `product.product` + `product.template`

**Fields yang disync:**

| Odoo Field | SOS Field | Keterangan |
|---|---|---|
| `id` | `integration_xref.odoo_id` | Cross-reference ID |
| `name` | `products.product_name` | Nama produk |
| `barcode` | `products.barcode` | Barcode EAN/internal |
| `lst_price` | `products.unit_price` | Harga jual |
| `categ_id.name` | `products.category` | Kategori |
| `image_1920` | `products.image_url` | Foto (base64 → upload) |
| `active` | `products.is_active` | Arsip/aktif |

**Logika:**
1. Fetch `product.product` where `active=True`, `sale_ok=True`, `type` in `['product', 'consu']`
2. Cek `integration_xref`: ada → UPDATE, tidak ada → INSERT + tambah xref
3. Produk di Odoo `active=False` → set SOS `is_active=false`

### 4.4 Sinkronisasi Stok (Pull — Odoo → SOS)

**Trigger:** Scheduler, interval default 30 menit (configurable via Admin)

**Odoo Model:** `stock.quant`

**Logika Eligibilitas** (DDD layer — `stock-sync` module):
- Hanya produk dengan `type = 'product'` (storable)
- Hanya produk yang ada di `integration_xref` dengan status `ACTIVE`
- Skip jika qty tidak berubah (no-op → logged sebagai SKIPPED)
- Semua perubahan dicatat ke `stock_sync_log` dengan delta qty dan reason

**Audit Fields di `stock_sync_log`:**

| Kolom | Keterangan |
|---|---|
| `sync_id` | UUID per sync run |
| `product_id` | SOS product |
| `odoo_product_id` | Odoo ID |
| `old_qty` / `new_qty` | Perubahan stok |
| `eligibility_status` | ELIGIBLE / SKIPPED / ERROR |
| `sync_reason` | Penjelasan hasil (misalnya "no change", "updated") |
| `synced_at` | Timestamp UTC |

### 4.5 Sinkronisasi Customer (Push — SOS → Odoo)

**Trigger:** Webhook `customer-registered` dari backend (saat customer baru register)

**Odoo Model:** `res.partner`

**Logika Deduplikasi (3 tahap):**
1. Cari by `ref` (customer_id SOS)
2. Cari by `phone`
3. Cari by `email`

Jika tidak ditemukan → CREATE. Jika ditemukan → UPDATE.

**Fields yang dikirim:**

| SOS Field | Odoo Field |
|---|---|
| `customer_id` | `ref` |
| `full_name` | `name` |
| `phone_number` | `phone` |
| `email` | `email` |
| — | `customer_rank = 1` |
| — | `property_stock_customer` (customer location) |

### 4.6 Push Sales Order (Push — SOS → Odoo)

**Trigger:** Webhook `order-paid` dari backend (saat kasir konfirmasi bayar)

**Odoo Model:** `sale.order` + `sale.order.line`

**Header SO:**

| SOS Field | Odoo Field | Nilai |
|---|---|---|
| `transaction_id` | `client_order_ref` | TXN-YYYYMMDD-NNNNN |
| customer | `partner_id` | Odoo partner ID (dari xref atau walk-in) |
| `paid_at` | `date_order` | Timestamp bayar |
| — | `company_id` | 5 (PT MYE INDONESIA) |
| — | `state` | draft |

**Line Item SO:**

| SOS Field | Odoo Field | Keterangan |
|---|---|---|
| `product_id` | `product_id` | via `integration_xref` |
| `quantity` | `product_uom_qty` | |
| `unit_price` | `price_unit` | Harga sebelum pajak |
| — | `tax_id` | PPN 11% (Odoo tax_id: 19) |

**Walk-in Customer:** Jika customer tidak memiliki Odoo partner ID, digunakan `odoo_walkin_partner_id` dari config.

**Error Handling:** Fire-and-forget dengan retry queue (exponential backoff). Kegagalan push SO tidak memblokir transaksi.

### 4.7 Push Cancel Order (Push — SOS → Odoo)

**Trigger:** Webhook `order-cancelled` dari backend

**Logika:** Cari SO by `client_order_ref = transaction_id` → set state `cancel`

---

## 5. Alur Lengkap Transaksi

```
Customer                Backend              Integration           Odoo 18
   │                       │                      │                   │
   │── Browse products ────▶│ GET /products         │                   │
   │                       │──────────────────────────── product sync (30min) ──▶│
   │◀── Catalog ───────────│                      │                   │
   │                       │                      │                   │
   │── Add to cart ────────▶│ (CartContext local)  │                   │
   │── Checkout ───────────▶│ POST /orders          │                   │
   │                       │ • Deduct stock        │                   │
   │                       │ • Create TXN PENDING  │                   │
   │◀── QR Code ───────────│                      │                   │
   │                       │                      │                   │
   │   [Kasir scans QR]    │                      │                   │
   │                       │ POST /payments/process│                   │
   │                       │ • TXN → PAID          │                   │
   │                       │ • WebSocket broadcast │                   │
   │                       │─── webhook ──────────▶│                   │
   │                       │                      │── create SO ─────▶│
   │                       │                      │◀─ SO id ──────────│
   │◀── WebSocket: PAID ───│                      │                   │
   │                       │                      │                   │
   [Tenant menerima notif]  │                      │                   │
   │                       │                      │                   │
   │── Pickup tracking ────▶│ GET /pesanan/:id      │                   │
   │◀── Status items ──────│                      │                   │
```

---

## 6. Keamanan

| Layer | Mekanisme |
|---|---|
| Autentikasi | JWT Bearer token (HS256) |
| Otorisasi | Role-based middleware (`authorize(role)`) |
| Webhook Auth | HMAC-SHA256 signature header (`X-Webhook-Signature`) |
| Password | bcrypt (cost factor 10) |
| Rate Limiting | 1.000 req/15 menit per IP |
| CORS | Whitelist origin dari env `CORS_ORIGIN` |
| SQL Injection | Parameterized queries (`pg` prepared statements) |
| Odoo RPC | Session-based auth, company isolation enforced |

---

## 7. Konfigurasi Tax / PPN

Tax dikelola sepenuhnya di sisi SOS, tidak diambil real-time dari Odoo saat transaksi berlangsung.

```
system_settings key: 'tax_config'
  ppn_active:   true/false
  ppn_rate:     11 (%)
  odoo_tax_id:  19  ← Odoo account.tax ID untuk SO line
  odoo_tax_name: "11%"
```

**Tampilan receipt (CR-014):**
- Item price = `unit_price × qty × (1 + tax_rate/100)` — inklusif pajak
- Tidak ada baris PPN terpisah; hanya TOTAL yang ditampilkan
- Berlaku di semua 3 rendering path: `ThermalReceipt.jsx`, `ReceiptPickupPage.jsx`, `print.service.js`

---

## 8. Receipt Rendering — Tiga Path

| Path | File | Surface | Trigger |
|---|---|---|---|
| On-screen preview (kasir) | `ThermalReceipt.jsx` | Print Confirmation Modal `/cashier` | Kasir klik Print |
| Digital receipt (customer/staff) | `ReceiptPickupPage.jsx` | `/pesanan/:id/receipt` | Customer buka link |
| Thermal printer ESC/POS | `print.service.js` | TCP socket ke printer | Kasir klik "Print Langsung" |

**Catatan deployment:** Setiap perubahan frontend memerlukan:
```bash
docker compose build frontend && docker compose up -d frontend
```

---

## 9. Real-Time — WebSocket

- Server: `ws` library, co-hosted di port 3001
- Autentikasi: token JWT dikirim saat handshake
- Channels:
  - `customer:{customerId}` — update status order milik customer
  - `tenant:{tenantId}` — notifikasi pesanan baru masuk
  - `broadcast` — pengumuman sistem (maintenance, dll.)

---

## 10. Diagram Entitas Utama

```
customers 1──────∞ transactions ∞──────1 users (cashier)
                        │
                        │ 1
                        ∞
                 transaction_items
                        │ ∞
                        │
                     products ∞──────1 tenants
                        │
                    integration_xref
                        │
                     Odoo product.product
```

---

## 11. Konfigurasi Admin (System Settings)

Diakses via `/admin` → sub-menu **Konfigurasi:**

| Setting | Field | Keterangan |
|---|---|---|
| Nama event | `event_name` | Tampil di receipt & header |
| Venue | `venue` | Tampil di receipt |
| Tanggal event | `event_date_start`, `event_date_end` | Range tanggal |
| Email Kontak | `contact_email` | Footer receipt |
| Logo | `logo_url` | Upload file |
| Warna utama | `primary_color` | Branding |
| Printer thermal | `printer_ip`, `printer_port` | Per-kasir atau global |
| Timeout PENDING | `pending_timeout_minutes` | Auto-expire order |
| Mode maintenance | `maintenance_mode` | Block akses customer |

---

## 12. Deployment Checklist

```
□ Isi .env (DB_PASSWORD, JWT_SECRET, ODOO_*, SMTP_*, WEBHOOK_SECRET)
□ Jalankan: docker compose up -d
□ Verifikasi health: curl http://localhost/health
□ Buka /admin → Konfigurasi → isi event_name, venue, tanggal, email kontak
□ /admin → Konfigurasi → Pajak: set PPN rate + Odoo tax_id
□ /admin → Integrasi → Odoo: isi kredensial + uji koneksi
□ /admin → Integrasi → jalankan Product Sync pertama kali
□ /admin → Users → buat akun CASHIER, TENANT, LEADER
□ /admin → Booth → daftarkan tenant + booth location
□ Uji end-to-end: Customer order → Kasir bayar → Tenant terima notif
```
