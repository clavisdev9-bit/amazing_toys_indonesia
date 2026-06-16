# System Architecture — Amazing Toys SOS
**Project:** Amazing Toys Self-Order System (SOS)  
**Event:** Amazing Toys Fair 2026  
**Version:** 2.3 — 2026-06-17 (updated: CR-049 s/d CR-054, BUG-050 s/d BUG-051-03)  
**Author:** clavis Development

---

## 1. Ringkasan Sistem

Amazing Toys SOS adalah platform self-order berbasis web untuk event pameran mainan. Sistem mendukung tiga model pemesanan yang dapat dikonfigurasi secara global maupun per booth:

- **SELF_ORDER** (legacy): customer menelusuri produk, membuat pesanan mandiri via smartphone, dan mengambil barang di booth — kasir hanya berperan sebagai konfirmator pembayaran.
- **HELPER_INPUT (Model C)** — CR-035: petugas booth (HELPER) membuat pesanan atas nama customer walk-in, mengunci stok, dan menghasilkan QR yang dikirim via WhatsApp serta ditampilkan di layar untuk dibawa ke kasir.
- **HELPER_APPROVE (Model D)** — CR-040: customer memesan sendiri seperti SELF_ORDER, namun stok **tidak dipotong** dan timer **tidak berjalan** hingga petugas booth secara eksplisit menyetujui pesanan dari antrian approval. Mencegah pemesanan ghost/fraud sekaligus mempertahankan kontrol booth atas stok.

Sistem terintegrasi penuh dengan **Odoo 18 ERP** untuk sinkronisasi produk, stok, customer, dan sales order secara otomatis, termasuk chain akuntansi lengkap (invoice + payment).

---

## 2. Arsitektur High-Level

```
┌─────────────────────────────────────────────────────────────────────┐
│                          INTERNET / LAN                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │  :8080
                    ┌────────▼────────┐
                    │ hybrid_frontend │  Nginx + React SPA (Vite build)
                    │   (Docker)      │
                    └────────┬────────┘
                             │  proxy /api/* → :3001
                    ┌────────▼────────┐         ┌──────────────────┐
                    │ hybrid_backend  │─webhook─▶│hybrid_integration│
                    │   Express.js    │          │  Node.js         │
                    │   :3001         │◀─webhook─│  :4000           │
                    └────────┬────────┘          └────────┬─────────┘
                             │                           │
                    ┌────────▼────────┐                  │  JSON-RPC2
                    │ hybrid_postgres  │◀─────────────────┘
                    │   PostgreSQL 15 │
                    │   :5432         │          ┌──────────────────┐
                    └─────────────────┘          │   Odoo 18 ERP    │
                                                 │ edu-student4     │
                             ◀───── sync ────────│ .odoo.com        │
                    ┌─────────────────┐          └──────────────────┘
                    │  hybrid_waha    │
                    │  WAHA (WA API)  │  WhatsApp QR delivery (CR-036)
                    │  :3010          │
                    └─────────────────┘
```

### Container Overview

| Container | Image | Port Internal | Port Host | Peran |
|---|---|---|---|---|
| `hybrid_postgres` | postgres:15-alpine | 5432 | — | Database utama |
| `hybrid_backend` | Node.js (custom) | 3001 | **3002** | REST API + WebSocket |
| `hybrid_integration` | Node.js (custom) | 4000 | — | Odoo sync middleware |
| `hybrid_frontend` | Nginx (custom) | 80 | **8080** | React SPA + reverse proxy |
| `hybrid_waha` | devlikeapro/waha | 3000 | **3010** | Self-hosted WhatsApp HTTP API |

Semua container terhubung ke jaringan bridge `hybrid-net`. Frontend (port 8080) dan WAHA (port 3010) diekspos ke host; backend hanya diekspos ke host untuk dev (port 3002), tidak ke LAN.

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
| Barcode | `react-barcode@1.6.1` — Code128 barcode untuk pre-order (CR-052) |
| Build output | Single JS bundle (`/assets/index-*.js`) baked into Docker image |
| Served by | Nginx 1.27-alpine |

**Role & Halaman:**

| Role | Halaman Utama |
|---|---|
| **CUSTOMER** | Browse produk (sort by stok), Cart + voucher, Checkout, Order tracking, Receipt pickup, Pickup status |
| **CASHIER** | Lookup TXN + voucher input, POS Langsung + voucher, Payment processing (CASH/QRIS/EDC/TRANSFER), Pre-Order payment queue (CR-053), Recap harian |
| **HELPER** | Buat order (browse + qty + voucher opsional), Antrian Approval (HELPER_APPROVE mode), Approval Pre-Order (CR-051), Riwayat hari ini, Serah terima |
| **TENANT** | Incoming orders, Fulfillment, Laporan harian |
| **LEADER** | Dashboard KPI, Sales report, Return approval |
| **ADMIN** | User management, Konfigurasi sistem, WA Gateway config, Integrasi Odoo |

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
| Image Processing | `sharp` — upload gambar produk diproses otomatis: max 5 MB raw, resize ke max 800×800 px (aspek ratio preserved), output JPEG 80% progressive (CR-039) |
| Rate Limiting | 1.000 req/15 menit per IP |
| Logging | Winston (level: info/debug) |
| Port | 3001 (internal), 3002 (host dev) |

**Modul & Tanggung Jawab:**

| Modul | Endpoint Prefix | Fungsi Utama |
|---|---|---|
| `auth` | `/api/v1/auth` | Login/register staff & customer (phone-based) |
| `products` | `/api/v1/products` | CRUD katalog, barcode lookup, filter stok |
| `orders` | `/api/v1/orders` | Buat transaksi, deduct stok, generate QR |
| `payments` | `/api/v1/payments` | Konfirmasi bayar, lookup TXN, cashier recap |
| `cashier` | `/api/v1/cashier` | Shift management, POS langsung, voucher cashier, pre-order payment queue (CR-053) |
| `helper` | `/api/v1/helper` | HELPER_INPUT + HELPER_APPROVE flow: create/cancel/handover/approval-queue/approve/reject (CR-035, CR-040) |
| `preorder` | `/api/v1/preorder` | Pre-order lifecycle post-PAID: ready-to-ship, ship, arrived, handover (CR-050/051) |
| `wa` | `/api/v1/admin/wa-gateway` | WAHA config & session proxy (CR-036) |
| `tenants` | `/api/v1/tenants` | CRUD booth & vendor, revenue share |
| `tenant-orders` | `/api/v1/tenant-orders` | Fulfillment pesanan per booth |
| `leader` | `/api/v1/leader` | KPI dashboard, sales analytics |
| `notifications` | `/api/v1/notifications` | FCM push + WebSocket broadcast |
| `receipts` | `/api/v1/receipts` | Generate & kirim e-receipt (email) |
| `print` | `/api/v1/print` | ESC/POS thermal printer (TCP socket) |
| `bca-qris` | `/api/v1/bca-qris` | QRIS dinamis BCA (webhook callback) |
| `admin` | `/api/v1/admin` | System config, bulk upload, Odoo settings |
| `wishlist` | `/api/v1/wishlist` | Favorit produk customer |
| `vouchers` | `/api/v1/vouchers` | Validasi & apply kode diskon (customer/cashier) |
| `admin/vouchers` | `/api/v1/admin/vouchers` | CRUD voucher diskon (ADMIN) |
| `scheduler` | (internal) | Cron jobs: product sync & stock sync |

**Endpoint Tambahan:**

| Method | Path | Auth | Fungsi | CR |
|---|---|---|---|---|
| `POST` | `/api/v1/cashier/orders` | CASHIER/LEADER | POS Langsung — buat order langsung dari kasir | CR-023 |
| `POST` | `/api/v1/cashier/orders/:txnId/items` | CASHIER/LEADER | Tambah item ke transaksi PENDING | CR-023 |
| `POST` | `/api/v1/cashier/orders/:txnId/voucher` | CASHIER/LEADER | Apply voucher ke transaksi PENDING | CR-037 |
| `DELETE` | `/api/v1/orders/:txnId/items/:productId` | CUSTOMER | Hapus item dari pesanan PENDING | CR-026 |
| `GET` | `/api/v1/admin/odoo/payment-journals` | ADMIN | Baca mapping metode bayar → Odoo journal_id | CR-015 |
| `PUT` | `/api/v1/admin/odoo/payment-journals` | ADMIN | Simpan mapping metode bayar → Odoo journal_id | CR-015 |
| `GET` | `/api/v1/helper/products` | HELPER | Produk booth dari JWT tenantId | CR-035 |
| `GET` | `/api/v1/helper/orders` | HELPER | Riwayat order booth hari ini | CR-035 |
| `GET` | `/api/v1/helper/orders/:txnId` | HELPER | Detail satu order (scoped ke booth) | CR-035 |
| `POST` | `/api/v1/helper/orders` | HELPER | Buat order RESERVED (HELPER_INPUT) atau PENDING_APPROVAL (HELPER_APPROVE) | CR-035/036/040 |
| `POST` | `/api/v1/helper/orders/:txnId/cancel` | HELPER | Batalkan order, kembalikan stok jika sudah RESERVED | CR-035/040 |
| `POST` | `/api/v1/helper/orders/:txnId/handover` | HELPER | Konfirmasi serah terima → COMPLETED | CR-035 |
| `GET` | `/api/v1/helper/approval-queue` | HELPER | Antrian pesanan PENDING_APPROVAL untuk booth | CR-040 |
| `POST` | `/api/v1/helper/orders/:txnId/approve` | HELPER | Setujui pesanan (semua item) → deduct stok, mulai timer, generate QR | CR-040 |
| `POST` | `/api/v1/helper/orders/:txnId/reject` | HELPER | Tolak pesanan → CANCELLED (tanpa stok restore) | CR-040 |
| `POST` | `/api/v1/helper/orders/:txnId/items/:itemId/approve` | HELPER | Setujui satu item; body `{ approved_quantity }` (null = full qty) — deduct stok item tersebut | CR-040 |
| `POST` | `/api/v1/helper/orders/:txnId/items/:itemId/reject` | HELPER | Tolak satu item; body `{ reason }` (opsional) — item → REJECTED, stok tidak dipotong | CR-040 |
| `POST` | `/api/v1/payments/scan` | CASHIER/LEADER/ADMIN | Scan QR order RESERVED → WAITING_PAYMENT | CR-038 |
| `GET` | `/api/v1/cashier/queue` | CASHIER/LEADER/ADMIN | List semua order menunggu pembayaran (PENDING/RESERVED/WAITING_PAYMENT); PENDING pre-orders lintas tanggal disertakan (CR-053) | CR-038/CR-053 |
| `GET` | `/api/v1/cashier/preorder-queue` | CASHIER/LEADER/ADMIN | List PENDING pre-orders saja (tanpa filter tanggal) untuk tab Pre-Order kasir | CR-053 |
| `GET` | `/api/v1/preorder` | ADMIN/HELPER/LEADER | List transaksi pre-order; query `?status=pending\|paid\|awaiting\|arrived\|handover\|completed\|active\|all` | CR-050 |
| `PATCH` | `/api/v1/preorder/:txnId/ready-to-ship` | ADMIN/LEADER | Konfirmasi siap kirim → PAID → AWAITING_SHIPMENT | CR-051 |
| `PATCH` | `/api/v1/preorder/:txnId/ship` | ADMIN/LEADER | Input nomor resi pengiriman → AWAITING_SHIPMENT → SHIPPED (body: `{courier, tracking_number}`) | CR-050 |
| `PATCH` | `/api/v1/preorder/:txnId/arrived` | ADMIN/LEADER | Konfirmasi barang sampai di Indonesia → SHIPPED/AWAITING_SHIPMENT → ARRIVED | CR-050 |
| `PATCH` | `/api/v1/preorder/:txnId/handover` | HELPER/ADMIN/LEADER | Serahkan ke customer → ARRIVED → PREORDER_HANDOVER → COMPLETED | CR-050 |
| `GET` | `/api/v1/admin/wa-gateway/waha/status` | ADMIN | Cek status sesi WAHA | CR-036 |
| `POST` | `/api/v1/admin/wa-gateway/waha/start` | ADMIN | Mulai/restart sesi WAHA | CR-036 |
| `GET` | `/api/v1/admin/wa-gateway/waha/qr` | ADMIN | Ambil QR pairing WAHA | CR-036 |

**Public Endpoint (no auth):**

```
GET /api/v1/config/public
```
Mengembalikan: `event_name`, `venue`, `event_date_start/end`, `logo_url`, `contact_email`, `maintenance_mode`, `ppn_rate`, `max_items_per_order`, **`order_mode`** — dikonsumsi frontend tanpa token. `order_mode` dipakai oleh CartPage dan HelperPage untuk menentukan alur pemesanan.

---

### 3.3 Database — PostgreSQL 15

**Database:** `amazing_toys_hybrid`

**Skema Utama:**

```
customers          → pengunjung terdaftar (UUID PK)
tenants            → booth vendor (VARCHAR PK, format: T001...) + order_mode
products           → katalog produk per tenant + is_display_only, is_on_hold, max_per_customer, bundle_group
users              → staff (CASHIER/TENANT/LEADER/ADMIN/HELPER)
transactions       → order header (PK: TXN-YYYYMMDD-NNNNN) + Model C kolom + CR-036 delivery kolom
transaction_items  → line item per transaksi
integration_xref   → peta ID SOS ↔ ID Odoo (entity_type, sos_id, odoo_id) + voucher accounting
stock_sync_log     → audit trail sinkronisasi stok
return_requests    → retur barang (approved oleh LEADER)
cashier_sessions   → recap shift kasir
notifications      → history push notification ke tenant
audit_log          → log immutable semua aksi sistem
system_settings    → konfigurasi (JSON blob, key-value) + WA Gateway config
vouchers           → master kode diskon event (CR-029)
voucher_usages     → histori pemakaian voucher per transaksi (CR-029)
```

**Tipe Enumerasi:**

| Enum | Nilai |
|---|---|
| `txn_status_enum` | **PENDING_APPROVAL**, PENDING, RESERVED, WAITING_PAYMENT, PAID, CANCELLED, EXPIRED, HANDED_OVER, COMPLETED, **AWAITING_SHIPMENT**, **SHIPPED**, **ARRIVED**, **PREORDER_HANDOVER** (migration 029, CR-050) |
| `payment_method_enum` | CASH, QRIS, EDC, TRANSFER |
| `user_role_enum` | CASHIER, TENANT, LEADER, ADMIN, HELPER |
| `stock_status_enum` | AVAILABLE, LOW_STOCK, OUT_OF_STOCK |
| `return_status_enum` | PENDING, APPROVED, REJECTED |

**Format Transaction ID:**
```
TXN-{YYYYMMDD}-{NNNNN}
Contoh: TXN-20260608-00012
```
Sequence direset setiap hari; daily counter diinisialisasi dari jumlah transaksi hari itu.

**View:**
- `v_transaction_summary` — TXN + customer + cashier + item count
- `v_tenant_sales` — revenue breakdown per tenant

**Trigger:**
- `fn_update_stock_status()` — otomatis set `stock_status` berdasarkan threshold: ≤0 → OUT_OF_STOCK, ≤5 → LOW_STOCK, >5 → AVAILABLE

**Kolom Tambahan di `transactions` (lengkap):**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `subtotal_amount` | NUMERIC(12,2) | Total sebelum pajak |
| `tax_rate` | NUMERIC(5,2) | % PPN saat transaksi dibuat (default: 12.00) |
| `tax_amount` | NUMERIC(12,2) | Nilai PPN (dihitung dari subtotal − discount_amount) |
| `total_amount` | NUMERIC(14,2) | Total inklusif pajak |
| `voucher_code` | VARCHAR(50) | FK → vouchers(code), NULL jika tidak pakai voucher (CR-029) |
| `discount_amount` | NUMERIC(14,2) | Nominal diskon pre-tax dalam IDR (default: 0) (CR-029) |
| `customer_phone` | VARCHAR(20) | No. HP walk-in (Model C — tidak perlu customer terdaftar) (CR-035) |
| `created_by_role` | VARCHAR(20) | Role aktor yang membuat order ('HELPER' / 'CUSTOMER') (CR-035) |
| `created_by_user` | UUID | FK → users, helper yang membuat order (CR-035) |
| `reserved_at` | TIMESTAMPTZ | Waktu order di-RESERVED (CR-035) |
| `handover_at` | TIMESTAMPTZ | Waktu serah terima PAID → HANDED_OVER (CR-035) |
| `handover_by` | UUID | FK → users, HELPER yang melakukan handover (CR-035) |
| `public_token` | VARCHAR(64) | Token publik unik untuk link QR delivery (CR-036) |
| `public_token_exp` | TIMESTAMPTZ | Expiry token publik (default TTL: 120 menit) (CR-036) |
| `wa_sent_at` | TIMESTAMPTZ | Waktu WA berhasil terkirim (CR-036) |
| `wa_delivery_status` | VARCHAR(20) | PENDING / SENT / DELIVERED / FAILED / SKIPPED (CR-036) |
| `approved_at` | TIMESTAMPTZ | Waktu helper menyetujui pesanan (CR-040) |
| `approved_by` | UUID | FK → users, helper yang approve (CR-040) |
| `timer_locked_until` | TIMESTAMPTZ | Waktu expires_at ditetapkan saat approval (CR-040) |
| `approval_note` | TEXT | Catatan helper saat approve (opsional) (CR-040) |
| `order_type` | VARCHAR(20) | `REGULAR` (default) / `PREORDER` — tipe pesanan (migration 029, CR-050) |
| `shipping_name` | VARCHAR(100) | Nama penerima pengiriman pre-order (CR-050) |
| `shipping_phone` | VARCHAR(20) | Nomor HP penerima (CR-050) |
| `shipping_address` | TEXT | Alamat pengiriman (CR-050) |
| `shipping_city` | VARCHAR(100) | Kota pengiriman (CR-050) |
| `shipping_province` | VARCHAR(100) | Provinsi pengiriman (CR-050) |
| `courier` | VARCHAR(50) | Nama ekspedisi (diisi saat SHIPPED) (CR-050) |
| `tracking_number` | VARCHAR(100) | Nomor resi pengiriman (CR-050) |
| `shipped_at` | TIMESTAMPTZ | Waktu status → SHIPPED (CR-050) |
| `arrived_at` | TIMESTAMPTZ | Waktu status → ARRIVED (CR-050) |
| `handed_over_at` | TIMESTAMPTZ | Waktu status → PREORDER_HANDOVER (CR-050) |

**Index:**
- `idx_transactions_order_type ON transactions (order_type, status) WHERE order_type = 'PREORDER'` — partial index untuk query list pre-order (migration 029)

**Kolom Tambahan di `products` (CR-035 / CR-050):**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `is_display_only` | BOOLEAN | Produk display — tidak bisa diorder |
| `is_on_hold` | BOOLEAN | Produk ditahan sementara oleh admin booth |
| `max_per_customer` | INTEGER | Batas qty per order per customer (NULL = unlimited) |
| `bundle_group` | VARCHAR(50) | Grup bundle — semua item bundle wajib diorder bersama |
| `is_preorder` | BOOLEAN | Produk pre-order — tidak tersedia stok langsung (migration 029, CR-050) |
| `preorder_note` | TEXT | Catatan produk pre-order (CR-050) |

**Kolom Tambahan di `transaction_items` (CR-040):**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `approval_status` | VARCHAR(20) | `PENDING` / `APPROVED` / `REJECTED` — default `PENDING`, diupdate saat helper approve/reject |
| `approved_quantity` | INTEGER | NULL = full qty disetujui; nilai < `quantity` = partial approval (helper isi qty saat setujui) (migration 017) |
| `rejection_reason` | TEXT | Alasan penolakan opsional saat `approval_status = 'REJECTED'` (migration 017) |

**Kolom Tambahan di `tenants` (CR-035/040):**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `order_mode` | VARCHAR(20) | NULL = ikut global, `HELPER_INPUT` / `SELF_ORDER` / `HELPER_APPROVE` = override per booth |

**Kolom Tambahan di `integration_xref` (CR-015, migration 009):**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `odoo_invoice_id` | INTEGER | Odoo account.move ID |
| `odoo_payment_id` | INTEGER | Odoo account.payment ID |
| `voucher_status` | VARCHAR(20) | PENDING → CONFIRMED → INVOICED → PAID → FAILED |
| `voucher_synced_at` | TIMESTAMPTZ | Timestamp sync payment voucher terakhir |

**Migration History:**

| File | Keterangan |
|---|---|
| `001_job_run_log.sql` | Tabel job run log |
| `002_odoo_company.sql` | Odoo company config |
| `003_customers_birth_date.sql` | Kolom tanggal lahir customer |
| `004_mock_catalogue_products.sql` | Sample produk catalogue |
| `005_add_tax_columns.sql` | Kolom tax di transactions |
| `005_bca_qris_transactions.sql` | Tabel BCA QRIS |
| `006_add_odoo_categ_name.sql` | Kolom odoo category name |
| `007_sample_stock_and_categories.sql` | Sample data |
| `008_wishlists.sql` | Tabel wishlists |
| `009_stock_sync_log.sql` | Tabel stock sync log |
| `009_payment_voucher_xref.sql` | Kolom voucher accounting di integration_xref (CR-015) |
| `010_voucher_tables.sql` | Tabel vouchers + voucher_usages; extend transactions (CR-029) |
| `011_cr035_hybrid_model_c.sql` | HELPER role, status baru, kolom Model C di transactions/products/tenants (CR-035) |
| `012_cr035_seed_helper.sql` | Seed user helper01 (CR-035) |
| `013_cr036_qr_delivery.sql` | Kolom QR delivery di transactions + system_settings WA (CR-036) |
| `014_cr036_waha_session.sql` | Seed `wa_waha_session` di system_settings (CR-036) |
| `015_cr040_helper_approve.sql` | Tambah `PENDING_APPROVAL` ke enum, 4 kolom approval di transactions, `approval_status` di transaction_items, partial index (CR-040) |
| `016_drop_expires_at_not_null.sql` | Drop NOT NULL constraint pada `transactions.expires_at` — PENDING_APPROVAL tidak punya timer sampai helper setujui (CR-041) |
| `017_per_item_approval.sql` | Tambah `approved_quantity` INTEGER dan `rejection_reason` TEXT ke `transaction_items` — mendukung per-item partial approval (CR-040) |
| `018_cr041_alter_users_otp.sql` | Alter tabel users untuk mendukung OTP staff (CR-041) |
| `019_cr041_login_otps.sql` | Tabel `login_otps` untuk OTP staff authentication (CR-041) |
| `020_cr041_trusted_devices.sql` | Tabel `trusted_devices` — device fingerprint skip OTP (CR-041) |
| `021_cr041_refresh_tokens.sql` | Tabel `refresh_tokens` untuk JWT refresh flow (CR-041) |
| `022_group_checkout.sql` | Tabel `checkout_groups` dan kolom `group_id` di transactions — group invoice kasir (CR-04X) |
| `023_cr061_fraud_protection.sql` | Tabel fraud protection — rate limit & blacklist (CR-04X) |
| `024_customer_otp_devices.sql` | Tabel `customer_otp_devices` — trusted devices customer (CR-041) |
| `025_txn_expiry_notif.sql` | Kolom `expiry_notif_sent_at` di transactions — tracking notifikasi hampir kadaluarsa (scheduler) |
| `026_fix_delete_requests_product_id.sql` | Fix tipe kolom `product_id` di `delete_requests` (BUG fix) |
| `027_cr042_customer_login_attempts.sql` | Tabel `customer_login_attempts` — lockout proteksi brute force login customer (CR-042/security) |
| `028_cr041_pending_registrations.sql` | Tabel `pending_registrations` — OTP register customer (CR-041) |
| `029_cr05x_preorder.sql` | Enum values AWAITING_SHIPMENT/SHIPPED/ARRIVED/PREORDER_HANDOVER; kolom `order_type` + shipping + tracking di transactions; kolom `is_preorder`/`preorder_note` di products; partial index (CR-050) |

---

### 3.4 Status Machine Transaksi (CR-035)

Centralisasi aturan transisi status dan validasi actor role (`backend/src/modules/orders/status.machine.js`):

```
PENDING_APPROVAL  → PENDING | CANCELLED                         (CR-040: helper approve/reject)
PENDING           → WAITING_PAYMENT | CANCELLED | EXPIRED | PAID (legacy + cashier scan)
RESERVED          → WAITING_PAYMENT | CANCELLED | EXPIRED
WAITING_PAYMENT   → PAID | CANCELLED | EXPIRED
PAID              → HANDED_OVER                                  (REGULAR order)
PAID              → AWAITING_SHIPMENT                            (PREORDER — auto-triggered, CR-050)
HANDED_OVER       → COMPLETED
AWAITING_SHIPMENT → ARRIVED                                      (CR-050: admin konfirmasi sampai)
SHIPPED           → ARRIVED                                      (CR-050: legacy path, backward-compat)
ARRIVED           → PREORDER_HANDOVER                            (CR-050: helper serahkan ke customer)
PREORDER_HANDOVER → COMPLETED                                    (CR-050)
```

**Pre-Order status flow lengkap:**
```
[Customer checkout PREORDER] → PENDING_APPROVAL → PENDING → PAID
                                                              │
                                                    AWAITING_SHIPMENT (auto)
                                                              │
                                                           ARRIVED
                                                              │
                                                    PREORDER_HANDOVER
                                                              │
                                                          COMPLETED
```

**Pembatasan per role:**

| Transisi | Role yang diizinkan |
|---|---|
| → PENDING_APPROVAL | (otomatis saat CUSTOMER checkout di mode HELPER_APPROVE) |
| → PENDING (dari PENDING_APPROVAL) | HELPER |
| → RESERVED | HELPER |
| → WAITING_PAYMENT | CASHIER / LEADER / ADMIN |
| → PAID | CASHIER / LEADER / ADMIN |
| → HANDED_OVER / COMPLETED | HELPER / TENANT / LEADER / ADMIN |
| → AWAITING_SHIPMENT | SYSTEM (auto setelah PAID pre-order) |
| → ARRIVED | ADMIN / LEADER |
| → PREORDER_HANDOVER | HELPER / ADMIN / LEADER |

**Catatan penting — lock PostgreSQL:**
Fungsi `approveOrder` menggunakan `FOR UPDATE OF t` (bukan `FOR UPDATE`) untuk menghindari error `cannot be applied to nullable side of outer join` ketika query join dengan `LEFT JOIN customers`. Selalu gunakan `FOR UPDATE OF <alias>` saat query mengandung outer join. (BUG-016)

---

### 3.5 Integration Service — Odoo Sync Middleware

| Atribut | Detail |
|---|---|
| Runtime | Node.js 20 |
| Port | 4000 |
| Protokol ke Odoo | JSON-RPC 2.0 via HTTPS |
| Protokol dari Backend | HTTP Webhook (HMAC-SHA256 signed) |
| Database | Shared `amazing_toys_hybrid` PostgreSQL |
| Retry | Exponential backoff queue (`retry.queue.js`) |
| Circuit Breaker | Threshold 5 gagal → open state, reset 2 menit |

---

### 3.6 WAHA — Self-Hosted WhatsApp HTTP API (CR-036)

| Atribut | Detail |
|---|---|
| Image | `devlikeapro/waha` |
| Container | `hybrid_waha` |
| Port Host | 3010 |
| Protokol | HTTP REST dari backend → WAHA → WhatsApp |
| Session | Konfigurasi via Admin → WA Gateway → session name |
| Pairing | QR pairing via Admin Panel (`GET /admin/wa-gateway/waha/qr`) |

**Providers WA yang didukung (CR-036):**

| Provider | Konfigurasi |
|---|---|
| `DISABLED` | Default — tidak ada WA delivery |
| `WABLAS` | API Key + API URL (Wablas provider) |
| `ZENZIVA` | API Key + API URL (Zenziva provider) |
| `TWILIO` | API Key + API URL (Twilio WhatsApp) |
| *(WAHA self-hosted)* | Proxy via backend endpoint `/admin/wa-gateway/waha/*` |

**System Settings untuk WA (seeded oleh migration 013/014):**

| Key | Default | Keterangan |
|---|---|---|
| `wa_gateway_provider` | `DISABLED` | Provider aktif |
| `wa_gateway_api_key` | `""` | API key gateway |
| `wa_gateway_api_url` | `""` | URL gateway / WAHA base URL |
| `wa_waha_session` | `default` | Nama sesi WAHA |
| `wa_message_template` | *(template default)* | Template pesan WA dengan placeholder |
| `public_token_ttl_minutes` | `120` | TTL token link QR delivery (menit) |
| `order_base_url` | `http://localhost:8080` | Base URL link QR yang dikirim ke customer |

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
1. Fetch `product.product` where `active=True`, `sale_ok=True`, `type` in `['product', 'consu', 'service']`
2. Cek `integration_xref`: ada → UPDATE (nama, harga saja — TIDAK overwrite stok), tidak ada → INSERT + tambah xref
3. Produk di Odoo `active=False` → set SOS `is_active=false`
4. Produk baru yang dibuat dari SOS → type `service` (tidak butuh delivery route)

### 4.4 Sinkronisasi Stok (Pull — Odoo → SOS)

**Trigger:** Scheduler, interval default 30 menit (configurable via Admin)

**Odoo Model:** `stock.quant`

**Logika Eligibilitas** (DDD layer — `stock-sync` module):
- Hanya produk dengan `type = 'product'` (storable)
- Hanya produk yang ada di `integration_xref` dengan status `ACTIVE`
- Skip jika qty tidak berubah (no-op → logged sebagai SKIPPED)
- Semua perubahan dicatat ke `stock_sync_log` dengan delta qty dan reason

### 4.5 Sinkronisasi Customer (Push — SOS → Odoo)

**Trigger:** Webhook `customer-registered` dari backend (saat customer baru register)

**Logika Deduplikasi (3 tahap):** by `ref` → by `phone` → by `email`

### 4.6 Push Sales Order (Push — SOS → Odoo)

**Trigger:** Webhook `order-paid` dari backend

**Voucher di SO (CR-029/CR-030):**
- **PERCENT** voucher: persentase sama untuk semua baris eligible
- **FIXED** voucher: distribusi proporsional berdasarkan subtotal baris eligible
- Baris dari tenant yang di luar scope voucher → `discount = 0%`
- Header `x_voucher_code` ditulis jika field tersedia di Odoo

### 4.7 Push Payment Voucher — Akuntansi Otomatis (CR-015)

**4 langkah chain setelah SO confirmed:**

| Step | Odoo Call | Hasil |
|---|---|---|
| [A] Verify SO | `sale.order.search_read` | Pastikan `state = sale`; NOT FOUND → `FAILED` (terminal) |
| [B] Create invoice | `sale.order.action_create_invoices` | `account.move` type `out_invoice` |
| [C] Post invoice | `account.move.action_post` | `state: draft → posted` |
| [D] Register payment | `account.payment.create` + `action_post` + `js_assign_outstanding_line` | `payment_state: paid` |

**Checkpoint states:** `PENDING → CONFIRMED → INVOICED → PAID`

**Journal Mapping (konfigurasi via `/admin` → Integrasi → Odoo Payment Journals):**
```json
{ "CASH": 14, "QRIS": 15, "EDC": 16, "TRANSFER": 17 }
```

**Hasil akhir di Odoo per TXN PAID:**
```
sale.order (origin: TXN-YYYYMMDD-NNNNN)
  └── state: sale (confirmed + locked)
      └── account.move (INV/YYYY/NNNNN)
            └── state: posted, payment_state: paid
                └── account.payment (journal: sesuai payment_method)
```

---

## 5. Alur Lengkap Transaksi

### 5.1 Model SELF_ORDER (Customer Kiosk)

```
Customer                Backend              Integration           Odoo 18
   │                       │                      │                   │
   │── Browse products ────▶│ GET /products         │                   │
   │◀── Catalog ───────────│                      │                   │
   │── Checkout + voucher ─▶│ POST /orders          │                   │
   │                       │ • Validate voucher    │                   │
   │                       │ • Deduct stock        │                   │
   │                       │ • Buat TXN PENDING    │                   │
   │◀── QR Code ───────────│                      │                   │
   │   [Kasir scans QR]    │                      │                   │
   │                       │ POST /payments/process│                   │
   │                       │ • TXN → PAID          │                   │
   │                       │─── webhook ──────────▶│── create SO ─────▶│
   │◀── WebSocket: PAID ───│                      │◀─ SO id ──────────│
```

### 5.2 Model HELPER_INPUT (Model C — CR-035/036/038)

```
Helper                 Backend              Customer (WA)       Kasir
   │                       │                      │               │
   │── Input order ────────▶│ POST /helper/orders   │               │
   │                       │ • Lock stok (FOR UPDATE OF t)         │
   │                       │ • Status = RESERVED   │               │
   │                       │ • Generate QR         │               │
   │                       │ • Generate public_token│               │
   │                       │─── WA Layer 1 ───────▶│               │
   │◀── QR di layar (L3) ──│  kirim link QR        │               │
   │                       │                      │               │
   │                       │                [customer bawa QR ke kasir]
   │                       │                      │               │
   │                       │                      │  Scan QR ─────▶│
   │                       │ POST /payments/scan   │               │
   │                       │ • RESERVED →          │               │
   │                       │   WAITING_PAYMENT     │               │
   │                       │ POST /payments/process│               │
   │                       │ • TXN → PAID          │               │
   │                       │ WS ORDER_PAID ───────▶│(HELPER+TENANT)│
   │── Serah terima ───────▶│ POST /helper/orders/:id/handover      │
   │                       │ • PAID → HANDED_OVER → COMPLETED      │
```

### 5.3 Model HELPER_APPROVE (Model D — CR-040)

```
Customer               Backend              Helper              Kasir
   │                       │                   │                  │
   │── Checkout ───────────▶│ POST /orders       │                  │
   │                       │ • NO stok deduct  │                  │
   │                       │ • Status = PENDING_APPROVAL           │
   │                       │─── WS: PENDING_APPROVAL_CREATED ─────▶│
   │◀── Navigate: /pesanan/:id                  │                  │
   │                       │                   │                  │
   │  [Menunggu approval]  │ GET /helper/       │                  │
   │                       │   approval-queue ─▶│                  │
   │                       │                   │ Review + Setujui │
   │                       │◀── POST /helper/orders/:id/approve    │
   │                       │ • Deduct stok     │                  │
   │                       │ • Generate QR     │                  │
   │                       │ • Mulai timer     │                  │
   │                       │ • Status = PENDING│                  │
   │◀── WS: ORDER_APPROVED ─│                  │                  │
   │                       │                   │                  │
   │  [Bawa QR ke kasir]   │                   │                  │
   │                       │ POST /payments/scan│                  │
   │                       │ PENDING → WAITING_PAYMENT             │
   │                       │ POST /payments/process                │
   │                       │ • TXN → PAID      │                  │
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
| HELPER scoping | `tenantId` selalu dari JWT — tidak pernah dari request client |
| FOR UPDATE lock | Hanya lock produk milik booth helper (`tenant_id = $2`) |
| Public token | 64-char random hex, partial index, TTL-bounded |

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

**Formula kalkulasi saat order dibuat:**
```
taxable_amount = subtotal_amount − discount_amount
tax_amount     = round(taxable_amount × tax_rate / 100)
total_amount   = taxable_amount + tax_amount
```

**Tampilan harga customer (tax-inclusive di semua halaman):**

| Halaman | Status |
|---|---|
| `/katalog` — kartu produk (`ProductCard.jsx`) | ✓ CR-022 |
| `/katalog` — bottom sheet detail (`ProductBottomSheet.jsx`) | ✓ CR-022 |
| `/keranjang` (`CartPage.jsx`) | ✓ CR-022 |
| `/product/:id` (`MockProductDetailPage.jsx`) | ✓ CR-024 |
| `/product_cart/:id` (`ProductCartPage.jsx`) | ✓ CR-024 |
| `/pesanan/:id` (`OrderTrackingPage.jsx`) | ✓ CR-023a |
| `/pesanan/:id/receipt` (`ReceiptPickupPage.jsx`) | ✓ BUG-047 |
| `/pesanan/:id/pickup` (`PickupStatusPage.jsx`) | ✓ BUG-047 |
| Kasir pembayaran (`PaymentPage.jsx`) | ✓ BUG-045 |
| Kasir print modal (`ThermalReceipt.jsx`) | ✓ BUG-045 |

---

## 8. Sistem Voucher Diskon (CR-029/CR-030/CR-037)

### 8.1 Tabel Voucher

```sql
vouchers (
  code VARCHAR(50) UNIQUE,
  discount_type VARCHAR(10),    -- 'PERCENT' | 'FIXED'
  discount_value NUMERIC,       -- persen atau nominal IDR
  min_purchase NUMERIC,
  max_discount NUMERIC,         -- cap nominal untuk PERCENT
  usage_limit INTEGER,          -- NULL = unlimited
  usage_count INTEGER,
  valid_from / valid_until TIMESTAMPTZ,
  is_active BOOLEAN,
  tenant_id VARCHAR(10)         -- NULL = berlaku semua tenant
)
voucher_usages (
  voucher_code → vouchers(code),
  transaction_id VARCHAR(30),
  customer_id UUID,
  discount_amount NUMERIC,
  UNIQUE (voucher_code, transaction_id)  -- idempotency guard
)
```

### 8.2 Tenant Scoping Voucher (CR-030)

- Voucher dengan `tenant_id` set: diskon hanya dihitung dari subtotal item tenant tersebut
- Baris SO Odoo dari tenant lain → `discount = 0%`
- Frontend pass `items` (dengan `tenant_id`) ke `POST /vouchers/validate`

### 8.3 Voucher Flow per Role

| Role | Entry point | Metode |
|---|---|---|
| CUSTOMER | `/keranjang` → `VoucherInput` | Validate + send `voucherCode` di checkout |
| CASHIER | `/cashier` dashboard lookup form | Pre-voucher diteruskan via nav state ke PaymentPage |
| CASHIER | `/cashier/pos` (POS Langsung) | `VoucherInput` di cart panel → `createCashierOrder(items, phone, code)` |
| CASHIER | `/cashier/bayar/:txnId` | `POST /cashier/orders/:txnId/voucher` (apply ke PENDING txn) |

**One voucher per transaction** — tidak bisa ganti/remove setelah apply (cashier hubungi supervisor jika perlu).

---

## 9. QR Delivery — Three-Layer System (CR-036)

Saat Helper membuat order RESERVED, QR order dikirimkan ke customer melalui tiga layer:

| Layer | Mekanisme | Kondisi |
|---|---|---|
| Layer 1 — WhatsApp | WA Gateway (WABLAS/ZENZIVA/TWILIO/WAHA) kirim link `{order_base_url}/t/{public_token}` ke nomor HP customer | Nomor HP tersedia + provider aktif |
| Layer 2 — WebSocket | Broadcast `ORDER_RESERVED` event ke dashboard/leader | Selalu |
| Layer 3 — QR di layar | `qrPayload` + `publicToken` dikembalikan di response API untuk ditampilkan di layar Helper | Selalu (fallback) |

**Public Token:**
- 64-char random hex, kolom `UNIQUE` di `transactions.public_token`
- TTL: `public_token_ttl_minutes` (default 120 menit) dari system_settings
- Index partial untuk lookup cepat
- Link format: `{order_base_url}/t/{public_token}`

**wa_delivery_status values:** `PENDING` → `SENT` / `DELIVERED` / `FAILED` / `SKIPPED`

**Kegagalan Layer 1 tidak memblokir pembuatan order** (fire-and-forget).

---

## 10. Receipt Rendering — Tiga Path

| Path | File | Surface | Trigger |
|---|---|---|---|
| On-screen preview (kasir) | `ThermalReceipt.jsx` | Print Confirmation Modal `/cashier` | Kasir klik Print |
| Digital receipt (customer/staff) | `ReceiptPickupPage.jsx` | `/pesanan/:id/receipt` | Customer buka link |
| Thermal printer ESC/POS | `print.service.js` | TCP socket ke printer | Kasir klik "Print Langsung" |

Semua tiga jalur menampilkan:
- Harga item tax-inclusive
- Baris diskon voucher `Diskon (KODE) − Rp X` jika `discount_amount > 0`
- Hanya `TOTAL` (tanpa baris PPN terpisah)
- `contact_email` dari admin config (footer)

---

## 11. Real-Time — WebSocket

- Server: `ws` library, co-hosted di port 3001
- Autentikasi: token JWT dikirim saat handshake
- Channels:
  - `customer:{customerId}` — update status order milik customer
  - `tenant:{tenantId}` — notifikasi pesanan baru masuk; **HELPER berbagi channel yang sama dengan TENANT** (CR-038) sehingga satu broadcast menjangkau keduanya
  - `broadcast` — pengumuman sistem

**Events WebSocket (per channel):**

| Event | Channel | Dikirim Saat | CR |
|---|---|---|---|
| `ORDER_RESERVED` | broadcast | Helper buat order RESERVED | CR-035 |
| `PRODUCT_UPDATED` | broadcast | Admin update produk | CR-007 |
| `PRODUCT_AVAILABLE` | broadcast | Admin lepas `is_on_hold` → false pada produk | CR-038 |
| `ORDER_PAID` | tenant:{id} | Kasir konfirmasi pembayaran | CR-038 |
| `PENDING_APPROVAL_CREATED` | tenant:{id} | Customer checkout di mode HELPER_APPROVE | CR-040 |
| `APPROVAL_QUEUE_UPDATE` | tenant:{id} | Helper approve atau reject pesanan | CR-040 |
| `ORDER_APPROVED` | customer:{id} | Helper setujui pesanan PENDING_APPROVAL | CR-040 |
| `ORDER_REJECTED` | customer:{id} | Helper tolak pesanan PENDING_APPROVAL | CR-040 |

---

## 12. Konfigurasi Admin (System Settings)

Diakses via `/admin` — tab-tab tersedia:

| Tab | Fungsi |
|---|---|
| Master Data | CRUD produk, bulk upload CSV, sync Odoo, set kategori, kolom stok dengan warna kontekstual (CR-045), tombol QR Barcode per produk (CR-043) |
| Konfigurasi | Event info, branding, printer, pajak, batas transaksi, **Mode Penjualan** (HELPER_INPUT / HELPER_APPROVE / SELF_ORDER) |
| Booth | CRUD tenant + order_mode per booth (CR-035/040) |
| Users | CRUD staff accounts + reset password |
| Voucher | CRUD voucher diskon (CR-029) |
| Integrasi | Odoo connection, sync manual, payment journals, sync log |
| WA Gateway | Provider, API key, WAHA session config + QR pairing (CR-036) |
| Audit Log | Immutable log semua aksi sistem |

**Setting penting:**

| Setting | Key | Keterangan |
|---|---|---|
| Batas Waktu Checkout | `txn_timeout_checkout` | Durasi PENDING sebelum EXPIRED (menit); cascades ke `_getCheckoutTimeoutMinutes()` (CR-027) |
| Maks item/order | `max_items_per_order` | Batas total qty semua line item; divalidasi backend & frontend (CR-028) |
| Mode Penjualan | `order_mode` | `HELPER_INPUT` (default) / `HELPER_APPROVE` / `SELF_ORDER` — dikonsumsi via `GET /config/public` (CR-038/040) |
| WA Provider | `wa_gateway_provider` | DISABLED / WABLAS / ZENZIVA / TWILIO (CR-036) |
| WA TTL | `public_token_ttl_minutes` | Berapa menit link QR berlaku (CR-036) |
| Order Base URL | `order_base_url` | URL prefix untuk link QR customer (CR-036) |

---

## 13. Workflow per Aktor

### 13.1 CUSTOMER — Pengunjung Event

```
[ Buka App / Scan QR Event ]
      │
      ▼
  Login by Phone / Register
      │
      ▼
  /katalog — Browse + Filter + Wishlist
      │
      ▼
  /keranjang — Review + Input Voucher (opsional)
      │
      ▼
  POST /orders (validate stok + apply voucher atomik)
      │
      ▼
  /checkout/sukses — QR Code + timer
      │
      │  [Kasir scan + bayar]
      │  WebSocket: ORDER_PAID
      ▼
  /pesanan/:id — Status tracking (harga tax-inclusive)
      │   [Jika PREORDER: stepper status pre-order + barcode Code128 (CR-052)]
      │   [Barcode menampilkan transaction_id untuk verifikasi helper]
      ▼
  /pesanan/:id/receipt — Digital receipt
```

**Titik keputusan:**
- Stok habis saat checkout → error, item diremove dari cart
- TXN PENDING > timeout → auto-EXPIRED, stok dikembalikan
- Customer bisa cancel TXN PENDING atau PENDING_APPROVAL (`DELETE /orders/:txnId`)
- Customer bisa hapus 1 item dari PENDING via qty=0 (`DELETE /orders/:txnId/items/:productId`) — item terakhir → auto-CANCELLED (CR-026)
- Total qty dibatasi oleh `max_items_per_order` (CR-028)
- Mode HELPER_APPROVE: setelah checkout → redirect ke `/pesanan/:id` (bukan `/checkout/sukses`); customer menunggu notifikasi WS `ORDER_APPROVED` / `ORDER_REJECTED` (CR-040)

---

### 13.2 CASHIER — Kasir

```
[ /cashier — Dashboard ]
      │
      │  Tabs: Queue | Pre-Order | Processed | Kadaluarsa | Group Invoice
      │
      ├─ Tab "Queue": PENDING/RESERVED/WAITING_PAYMENT hari ini + PENDING pre-orders lintas tanggal
      ├─ Tab "Pre-Order" (CR-053): list PENDING pre-orders (status belum bayar), lintas tanggal
      │   └── Klik row → /cashier/bayar/:txnId
      ├─ Tab "Processed": TXN PAID hari ini
      ├─ Tab "Kadaluarsa": TXN EXPIRED hari ini
      └─ Tab "Group Invoice": group checkout hari ini
      │
      │  Input TXN ID + voucher (opsional — CR-037) → Cari
      ▼
  GET /payments/lookup/:txnId
      │
      │  [Status PENDING / RESERVED / WAITING_PAYMENT]
      ▼
  Jika voucher diisi → auto-apply POST /cashier/orders/:txnId/voucher
      │
      ▼
  /cashier/bayar/:txnId (PaymentPage)
  ├── Kolom kiri: detail txn + ringkasan harga (incl. diskon voucher) + badge PRE-ORDER jika applicable
  │   + VoucherInput card (jika PENDING + belum ada voucher)
  ├── Kolom kanan: product browser (tambah item ke PENDING) (CR-023)
  ├── Klik "Process Payment" → Modal konfirmasi "Apakah Anda yakin?" (CR-054)
  └── Konfirmasi → POST /payments/process → PAID
        │
        ▼
  Sukses: Print thermal / kirim email

── POS LANGSUNG (CR-023 + CR-037) ─────────────────────────────────────

  /cashier/pos — browse produk + cart
  ├── VoucherInput di cart footer (jika cart tidak kosong)
  ├── Preview diskon real-time
  └── Klik Bayar → POST /cashier/orders(items, phone, voucherCode)
        → Redirect ke PaymentPage (dengan konfirmasi modal CR-054)
```

---

### 13.3 HELPER — Petugas Booth (CR-035/036/038/040)

```
[ /helper — 4 Tab (selalu tampil) ]

Tab "Buat Order" — MODE: HELPER_INPUT:
  ├── Browse produk booth (search + filter)
  ├── Qty controls (+/−)
  ├── Input nomor HP customer (opsional)
  ├── Cart summary
  └── Klik "Approve & Generate QR"
        │
        ▼
  POST /helper/orders
  • Lock stok (FOR UPDATE OF t, hanya produk booth ini)
  • Validasi: display_only, on_hold, max_per_customer, bundle_group
  • Status = RESERVED
  • Generate QR + public_token
  • Layer 1: WA delivery (jika HP tersedia + provider aktif)
  • Layer 2: WS broadcast ORDER_RESERVED ke broadcast channel
  • Layer 3: QR tampil di layar (selalu)
        │
  [Customer bawa QR ke kasir]
  Kasir POST /payments/scan → WAITING_PAYMENT
  Kasir POST /payments/process → PAID
  WS ORDER_PAID dikirim ke tenant:{id} (diterima HELPER + TENANT)

Tab "Antrian Approval" — MODE: HELPER_APPROVE:
  ├── Daftar pesanan PENDING_APPROVAL dari GET /helper/approval-queue
  ├── Auto-refresh setiap 20 detik (silent, tanpa blink — CR-046)
  ├── WebSocket APPROVAL_QUEUE_UPDATE + PENDING_APPROVAL_CREATED → refresh instan
  ├── Setiap kartu: info customer, daftar item per-baris, total harga
  │
  ├── Per-ITEM (CR-040 / migration 017):
  │   ├── Tombol "✓" per item → modal konfirmasi + input qty (partial approval)
  │   │     → POST /helper/orders/:txnId/items/:itemId/approve { approved_quantity }
  │   │     → deduct stok qty yang disetujui saja
  │   └── Tombol "✕" per item → modal alasan (opsional)
  │         → POST /helper/orders/:txnId/items/:itemId/reject { reason }
  │         → item.approval_status = REJECTED, stok tidak dipotong
  │
  └── Bulk (semua item sekaligus):
      ├── Tombol "✓ Setujui Semua":
      │     → POST /helper/orders/:txnId/approve
      │     → deduct stok semua item, generate QR, mulai timer
      │     → WS ORDER_APPROVED ke customer, APPROVAL_QUEUE_UPDATE ke tenant
      └── Tombol "Tolak Semua" (dengan alasan opsional):
            → POST /helper/orders/:txnId/reject → CANCELLED
            → WS ORDER_REJECTED ke customer, APPROVAL_QUEUE_UPDATE ke tenant

Tab "Approval Pre-Order" — (CR-051):
  ├── Daftar pre-order PENDING_APPROVAL yang menunggu persetujuan helper
  ├── Informasi shipping customer (nama, alamat, kota, provinsi, HP)
  └── Helper approve → stok dikonfirmasi, transisi ke PENDING
        → Customer bisa bayar di kasir

Tab "Riwayat Hari Ini":
  └── GET /helper/orders — semua order booth hari ini (semua status)

Tab "Serah Terima":
  ├── Daftar order PAID yang menunggu
  └── Klik konfirmasi → POST /helper/orders/:txnId/handover
        → HANDED_OVER → COMPLETED
```

---

### 13.4 TENANT — Vendor Booth

```
[ /tenant — Pesanan Masuk (real-time WS) ]
      │
  GET /tenant-orders (PAID orders milik booth)
      │
  Customer ambil → POST /tenant-orders/handover
  { transactionId, productId }
  → pickup_status: READY → DONE
  → WS ke customer: PICKUP_DONE
```

---

### 13.5 LEADER — Supervisor

```
[ /leader — Dashboard KPI ]
  ├── GET /leader/dashboard (revenue, TXN count, top seller)
  ├── /leader/penjualan — sales report per tenant/produk/metode
  ├── /leader/retur — return approval
  └── Akses semua fungsi CASHIER
```

---

### 13.6 ADMIN — Administrator Sistem

```
[ /admin — Admin Panel ]
  ├── Master Data: CRUD produk, bulk CSV, sync Odoo
  ├── Konfigurasi: event, branding, pajak, batas transaksi
  ├── Booth: CRUD tenant, order_mode per booth
  ├── Users: CRUD staff + HELPER accounts
  ├── Voucher: CRUD kode diskon + filter tenant/status
  ├── WA Gateway: provider, API key, WAHA QR pairing (CR-036)
  ├── Integrasi: Odoo config, sync manual, payment journals, sync log, resync
  └── Audit Log: semua aksi sistem (date/actor/type filter)

[ /admin/preorder — Pre-Order Management (CR-050/051) ]
  Tabs:
  ├── "Menunggu Pembayaran" (BUG-051-03): PENDING_APPROVAL + PENDING pre-orders
  │   └── Tampil info: "Menunggu persetujuan helper" / "Menunggu pembayaran customer"
  ├── "Sudah Dibayar": PAID pre-orders → tombol "Konfirmasi Siap Kirim"
  │   └── PATCH /preorder/:txnId/ready-to-ship → AWAITING_SHIPMENT
  ├── "Menunggu Kirim": AWAITING_SHIPMENT pre-orders → tombol "Input Resi"
  │   └── PATCH /preorder/:txnId/ship { courier, tracking_number } → ARRIVED
  ├── "Barang Sudah Sampai": ARRIVED pre-orders → tombol "Konfirmasi Serah Terima"
  │   └── PATCH /preorder/:txnId/handover → PREORDER_HANDOVER → COMPLETED
  └── "Selesai": PREORDER_HANDOVER + COMPLETED pre-orders
```

---

### 13.7 Integration Service — Scheduled & Webhook

```
Scheduled Jobs:
  ├── Product Sync (Odoo → SOS)   PRODUCT_SYNC_INTERVAL_MIN
  ├── Stock Sync (Odoo → SOS)     STOCK_SYNC_INTERVAL_MIN
  └── Expiry Sweep (PENDING/RESERVED → EXPIRED) SWEEP_INTERVAL_MIN

Webhook Handlers (event-driven):
  ├── customer-registered → push res.partner ke Odoo
  ├── order-paid          → pushOrder (SO) → pushPaymentVoucher (chain akuntansi)
  └── order-cancelled     → cancel draft sale.order di Odoo

Polling Loop (POLLING_INTERVAL_SEC — sequential, CB-safe):
  ├── Phase 1: ORDER_PUSH fallback (TXN PAID tanpa odoo_id)
  └── Phase 2: VoucherPoll fallback (odoo_id ada, voucher_status ≠ PAID)

Retry Queue (setiap 30 detik):
  Backoff: immediate → +60s → +300s → dead-letter
  Dead-letter PAYMENT_VOUCHER → voucher_status = FAILED
```

---

### 13.8 Ringkasan Interaksi Antar Aktor

```
                     AMAZING TOYS SOS — ACTOR INTERACTION MAP

┌────────────┐  browse/order/voucher   ┌───────────────┐  webhook  ┌──────────────────┐
│  CUSTOMER  │ ──────────────────────▶ │               │ ─────────▶│                  │
│            │ ◀── WS: PAID ────────── │   BACKEND     │           │  INTEGRATION     │
│            │ ◀── WS: PICKUP ──────── │   :3001       │ ◀─health─ │  SERVICE :4000   │
└────────────┘                         │               │           └────────┬─────────┘
                                       │               │                    │ JSON-RPC
┌────────────┐  scan+pay+voucher       │               │                    ▼
│   CASHIER  │ ──────────────────────▶ │               │           ┌──────────────────┐
│            │ ◀── receipt ─────────── │               │           │   ODOO 18 ERP    │
└────────────┘                         │               │           │ edu-student4     │
                                       │               │           │ sale.order       │
┌────────────┐  create RESERVED order  │               │           │ account.move     │
│   HELPER   │ ──────────────────────▶ │               │           │ res.partner      │
│            │ ◀── QR (Layer 3) ────── │               │           │ product.product  │
└────────────┘                         │               │           └──────────────────┘
                                       │               │
┌────────────┐  view orders            │               │           ┌──────────────────┐
│   TENANT   │ ──────────────────────▶ │               │           │  WAHA (WA API)   │
│            │ ◀── WS: NEW_ORDER────── │               │           │  :3010           │
└────────────┘                         │               │           └──────────┬───────┘
                                       │               │                       │ WA msg
┌────────────┐  dashboard/retur        │               │              Customer HP
│   LEADER   │ ──────────────────────▶ │               │
└────────────┘                         │               │
                                       │               │
┌────────────┐  config/sync/WA         │               │
│   ADMIN    │ ──────────────────────▶ │               │
└────────────┘                         │               │
                           ┌───────────┘               └────────────┐
                           │     PostgreSQL :5432                    │
                           │     amazing_toys_hybrid                 │
                           └────────────────────────────────────────┘
```

---

## 14. Deployment Checklist

```
□ Isi .env (DB_PASSWORD, JWT_SECRET, ODOO_*, SMTP_*, WEBHOOK_SECRET, WAHA_API_KEY)
□ Jalankan: docker compose up -d
□ Verifikasi health: curl http://localhost:8080/api/v1/health
□ Buka /admin → Konfigurasi → isi event_name, venue, tanggal, email kontak
□ /admin → Konfigurasi → Pajak: set PPN rate + Odoo tax_id
□ /admin → Integrasi → Odoo: isi kredensial + uji koneksi
□ /admin → Integrasi → jalankan Product Sync pertama kali
□ /admin → Integrasi → Payment Journals: isi mapping CASH/QRIS/EDC/TRANSFER → journal_id
□ /admin → WA Gateway: pilih provider, isi API key + URL
□    (Jika pakai WAHA) buka http://localhost:3010, pairing WA di /admin → WA Gateway → Scan QR
□ /admin → Users → buat akun CASHIER, TENANT, LEADER, HELPER
□ /admin → Booth → daftarkan tenant + booth + order_mode (HELPER_INPUT / SELF_ORDER)
□ /admin → Konfigurasi → Mode Penjualan: pilih HELPER_INPUT / HELPER_APPROVE / SELF_ORDER
□ Uji end-to-end SELF_ORDER: Customer order → Kasir bayar → Tenant terima notif
□ Uji end-to-end HELPER_INPUT: Helper buat order → WA terkirim → Kasir scan QR → Bayar → Helper handover
□ Uji end-to-end HELPER_APPROVE: Customer checkout → PENDING_APPROVAL → Helper approve di tab "Antrian Approval" → Kasir scan QR → Bayar

Odoo Setup (wajib sebelum production):
□ Settings → Sales → Pricing → centang "Discounts" (untuk fitur voucher)
□ Buat field x_voucher_code (Char 50) di sale.order (via Odoo Shell)
□ Catat journal_id Kas/QRIS/EDC/Transfer di Accounting → Configuration → Journals
```

---

## 15. Changelog Arsitektur

| Versi | Tanggal | Perubahan |
|---|---|---|
| **2.3** | 2026-06-17 | CR-049–CR-054, BUG-050–BUG-051-03. Pre-order system lengkap (migration 029), cashier pre-order tab, barcode pre-order, konfirmasi modal pembayaran |
| **2.2** | 2026-06-11 | CR-041–CR-048, BUG-040–BUG-047. Per-item approval (migration 017), auto-refresh queue, sort stok di katalog, hide stock pcs di halaman produk, STANDARD.md |
| **2.1** | 2026-06-08 | CR-015–CR-040, BUG-016–BUG-017. HELPER_APPROVE (Model D), per-order approval queue, partial order flow, WA delivery system |
| **2.0** | 2026-05-30 | HELPER_INPUT (Model C), WAHA integration, BCA QRIS, ESC/POS printer, voucher system |
| **1.0** | 2026-05-27 | Initial — SELF_ORDER mode, Odoo 18 sync, JWT auth, WebSocket |

### Ringkasan CR-041 s/d CR-048

| CR | Tanggal | Deskripsi |
|---|---|---|
| CR-041 | 2026-06-08 | Checkout stock gate + HELPER_APPROVE hardening: `TxnExpireJob`, `expires_at` nullable (migration 016) |
| CR-042 | 2026-06-09 | HELPER_APPROVE mode: `ProductCard` behavior + QR Scanner di `/katalog` disesuaikan |
| CR-043 | 2026-06-09 | Admin Master Data: kolom "Stok" diganti tombol QR Barcode per produk |
| CR-044 | 2026-06-09 | Hide language switcher di header saat berada di `/katalog` |
| CR-045 | 2026-06-11 | Admin Master Data: tambah kolom "Stok" dengan warna kontekstual (merah/kuning/hijau) |
| CR-046 | 2026-06-11 | Approval queue auto-refresh tanpa blink: `silent fetch`, `mergeQueue`, `React.memo` |
| CR-047 | 2026-06-11 | `/katalog` diurutkan by stok: Tersedia → Stok Terbatas → Habis |
| CR-048 | 2026-06-11 | Hide chip "X pcs / Stock" di `/product/:id` dan `/product_cart/:id` — hanya badge status yang tampil |

### Ringkasan CR-050 s/d CR-054

| CR/BUG | Tanggal | Deskripsi |
|---|---|---|
| CR-050 | 2026-06-15 | Pre-order system: `order_type` column, status AWAITING_SHIPMENT/ARRIVED/PREORDER_HANDOVER, modul `preorder`, halaman admin `/admin/preorder`, pre-order stepper di `/pesanan/:id` |
| BUG-051-01 | 2026-06-15 | Fix pre-order list page: status filter mapping `pending` → `['PENDING_APPROVAL', 'PENDING']` |
| BUG-051-02 | 2026-06-15 | Fix `confirmReadyToShip`: `PAID → AWAITING_SHIPMENT` (bukan `PAID → SHIPPED`) |
| CR-051 | 2026-06-15 | Helper approval pre-order: tab "Approval Pre-Order" di `/helper`, auto-fill shipping info |
| BUG-051-03 | 2026-06-16 | Admin `/admin/preorder`: tambah tab "Menunggu Pembayaran" untuk PENDING_APPROVAL + PENDING pre-orders yang belum terlihat |
| CR-052 | 2026-06-16 | Barcode Code128 (`react-barcode@1.6.1`) di `/pesanan/:id` untuk pre-order — memudahkan helper identifikasi barang |
| CR-053 | 2026-06-16 | Cashier: tambah tab "Pre-Order" khusus PENDING pre-orders; fix `getPaymentQueue` — pre-orders lintas tanggal dimasukkan ke tab Queue |
| CR-054 | 2026-06-16 | Cashier payment: modal konfirmasi "Apakah Anda yakin?" sebelum proses pembayaran di `/cashier/bayar/:txnId` |

---

## 16. Standarisasi Kode

File `STANDARD.md` di root project mendokumentasikan standar coding yang wajib diikuti:

| Standar | Topik |
|---|---|
| STD-001 | Tampilan qty item di halaman customer: `approved_quantity ?? quantity`, `item.subtotal`, filter REJECTED |
| STD-002 | INSERT idempotent + UPDATE kondisional (`rowCount > 0` guard) |
| STD-003 | `FOR UPDATE` pada PostgreSQL JOIN — pisahkan query, jangan lock dua tabel sekaligus |
| STD-004 | Explicit type cast pada PostgreSQL parameter (`$1::integer`) |
| STD-005 | Silent background refresh di React: `fetchData(silent)`, smart merge, `React.memo` |
| STD-006 | Voucher usage limit: `usage_limit` adalah satu-satunya pembatas global |
| STD-007 | Informasi stok ke customer: hanya badge status, bukan angka eksak |
| STD-030 | SELECT eksplisit di list query — wajib disinkronkan saat migrasi kolom baru |
| STD-031 | Pre-Order: routing mode dan stock deduction invariants — `order_type=PREORDER` tidak deduct stok saat checkout, deduct saat approved |
| STD-032 | Pre-Order Approval: `order_type` detection dan helper UI invariants |
| STD-033 | Pre-Order Stepper: step key = status saat step AKTIF (bukan status tujuan) |
| STD-034 | Pre-Order Admin Page: setiap status harus memiliki tab dan transisi yang terdefinisi — tidak boleh ada status orphan |
