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

| Service | Teknologi | Port | Keterangan |
|---|---|---|---|
| Frontend | React + Vite / Nginx | 5173 (dev) / 80 (prod) | UI kiosk dan kasir |
| Backend | Node.js / Express | 3001 | REST API + WebSocket |
| Integration | Node.js | 4000 | Sync ke Odoo 18 |
| Database | PostgreSQL | 5432 | DB: `amazing_toys_sos` |

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
