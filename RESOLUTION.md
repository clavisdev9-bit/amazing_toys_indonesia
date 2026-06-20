# Resolution Log

## BUG-093 — Klik "+" pada Produk Promo Memunculkan "Voucher" Otomatis Tanpa Mekanisme Cancel (2026-06-20)

**Page:** `/cashier/pos` (CashierPOSPage)
**Reporter:** Kasir — barcode "2600108", klik tombol "+" pada cart item, muncul 🎁 "Item Gratis Promo" otomatis tanpa bisa di-cancel

### Root Cause

Dua bug terpisah pada implementasi BUG-092:

**1. Promo section muncul otomatis tanpa dismiss mechanism**
Implementasi BUG-092 menambahkan `getActivePromos` yang dipanggil setiap kali `cartKey` berubah (setQty, addToCart). Setiap kali kasir menekan "+" pada produk dengan promo aktif (mis. GET22 / B1G1), section 🎁 muncul otomatis. Tidak ada tombol untuk membatalkan promo per-transaksi jika kasir tidak ingin menerapkannya. Backend `createOrderByCashier` juga selalu menerapkan promo tanpa opsi opt-out.

**2. VoucherInput menampilkan state stale setelah voucher di-reset oleh operasi cart**
`VoucherInput` memiliki state internal `appliedVoucher` sendiri. Ketika parent memanggil `setAppliedVoucher(null)` (dipicu oleh `addToCart`, `setQty`, `removeItem`), VoucherInput tidak tahu — internal state-nya tetap menampilkan banner hijau "Voucher X applied" meskipun discount di parent sudah 0. `VoucherInput` tidak memiliki `key` prop sehingga tidak pernah di-remount untuk clear internal state.

### Fix

**Frontend `CashierPOSPage.jsx`**:
- Tambah state `voucherResetKey` (integer, increment setiap cart operation yang mereset `appliedVoucher`); pass sebagai `key` ke VoucherInput → force remount dan clear internal state
- Tambah state `promoDismissed` (boolean); reset ke `false` saat produk baru ditambahkan atau keranjang dikosongkan
- Tambah tombol ✕ di header section 🎁: `onClick={() => setPromoDismissed(true)}`; kondisi render: `freeItems.length > 0 && !promoDismissed`
- `handleBayar` mengirim `promoDismissed` sebagai `skipProductPromo` ke API

**Frontend `api/cashier.js`**:
- `createCashierOrder` menerima parameter `skipProductPromo` (default `false`); dikirim ke backend jika `true`

**Backend `cashier.router.js`**:
- Baca `skipProductPromo` dari `req.body`, pass ke `createOrderByCashier`

**Backend `orders.service.js`**:
- `createOrderByCashier` menerima `skipProductPromo = false`; jika `true`, skip step 2b (promo calculation) — `promoRules = []`

### Pencegahan

Setiap komponen dengan state internal (seperti VoucherInput) yang dikontrol oleh parent harus memiliki mekanisme sync. Gunakan `key` prop untuk force remount, atau buat komponen fully controlled. Lihat STD-045.

---

## BUG-092 — Voucher Promo Produk Tidak Terimplementasi di Kasir (2026-06-20)

**Page:** `/cashier` (CashierPOSPage)
**Reporter:** Internal — voucher `GET22` (tipe PRODUCT_PROMO / B1G1) tidak memberikan item gratis di kasir

### Root Cause

Dua lapisan tidak terimplementasi:

1. **Backend** — `createOrderByCashier` di `orders.service.js` tidak memanggil `voucherSvc.getActiveProductPromos()` dan tidak menyisipkan item gratis ke `transaction_items`. Hanya `createOrder` (flow customer) yang sudah memiliki logika ini.

2. **Frontend** — `CashierPOSPage.jsx` menggunakan local `cart` state (bukan CartContext) dan tidak memiliki: `getActivePromos` call, `freeItems` kalkulasi, tampilan item gratis di keranjang. Kasir tidak mendapat preview item gratis yang akan diberikan.

### Fix

**Backend (`backend/src/modules/orders/orders.service.js`)**:
- Ditambahkan step 2b setelah validasi stok: panggil `voucherSvc.getActiveProductPromos(productIds)`, lock baris free product `FOR UPDATE`, panggil `voucherSvc.calculateFreeItems()`, cap qty oleh stok tersedia.
- Ditambahkan step 6b setelah insert item reguler: INSERT setiap free item ke `transaction_items` dengan `is_free=TRUE`, `unit_price=0`, `subtotal=0`, `free_reason=voucher_code`, lalu deduct stok.

**Frontend (`frontend/src/pages/cashier/CashierPOSPage.jsx`)**:
- Tambah import `getActivePromos` dari `../../api/vouchers`
- Tambah fungsi `derivePromoFreeItems()` (identik dengan CartContext, untuk preview lokal)
- Tambah state `activePromos`, `cartKey`, `useEffect` yang memanggil `getActivePromos` ketika cart berubah, dan `freeItems` via `useMemo`
- Tambah seksi "🎁 Item Gratis Promo" di cart panel (di atas footer) dan baris summary "Item gratis: N item"

### Pencegahan

Setiap flow order (customer self-order, cashier, helper) harus memiliki implementasi product promo yang sama di backend. Saat menambah fitur ke `createOrder`, review apakah `createOrderByCashier` dan flow lain perlu update yang sama. Standardisasi: STD-044.

---

## BUG-091 — Admin Promo Produk: "Internal Server Error" Saat Klik Buat Promo — VARCHAR Overflow (2026-06-20)

**Page:** `/admin` → menu "Promo Produk" → klik "Buat Promo"
**Reporter:** Admin — internal server error masih terjadi setelah BUG-090 diperbaiki

### Root Cause

Kolom `vouchers.discount_type` didefinisikan sebagai `VARCHAR(10)` (migration 010). Nilai `'PRODUCT_PROMO'` memiliki 13 karakter sehingga melebihi batas kolom → PostgreSQL melempar `value too long for type character varying(10)` → 500 Internal Server Error.

Nilai sebelumnya (`'PERCENT'` = 7 char, `'FIXED'` = 5 char) tidak memiliki masalah ini. Overflow baru muncul saat tipe baru dengan nama lebih panjang ditambahkan.

### Fix

Perluas kolom: `ALTER TABLE vouchers ALTER COLUMN discount_type TYPE VARCHAR(20)`.

Ditambahkan ke:
- `backend/migrations/032_product_promo.sql` — agar konsisten di environment yang menjalankan migration manual
- `backend/src/app.js` schema guard — agar diaplikasikan otomatis saat server restart
- Diaplikasikan langsung ke database saat ini

### Pencegahan

Saat menambahkan tipe baru yang lebih panjang dari tipe yang ada, selalu periksa panjang kolom VARCHAR. Gunakan `VARCHAR(50)` atau lebih untuk kolom tipe/kategori yang berpotensi berkembang.

---

## BUG-090 — Admin Promo Produk: "Internal Server Error" Saat Klik Buat Promo (2026-06-20)

**Page:** `/admin` → menu "Promo Produk" → klik "Buat Promo"
**Reporter:** Admin — internal server error saat submit form promo baru

### Root Cause

Constraint `vouchers_discount_value_pos CHECK (discount_value > 0)` dari migration 010 tidak direlaksasi saat menambahkan tipe `PRODUCT_PROMO`.

`createProductPromoVoucher()` meng-INSERT ke tabel `vouchers` dengan `discount_value = 0` karena PRODUCT_PROMO tidak memiliki nilai diskon nominal (manfaatnya berupa produk gratis, bukan persen/fixed). Nilai 0 melanggar constraint `discount_value > 0` → PostgreSQL throw constraint violation → 500 Internal Server Error.

Migration 032 sudah meng-extend `vouchers_discount_type_check` dan `vouchers_percent_range`, tetapi lupa meng-drop dan merekonstruksi `vouchers_discount_value_pos`.

### Fix

**`backend/migrations/032_product_promo.sql`** dan **`backend/src/app.js`** (schema guard):
- DROP CONSTRAINT IF EXISTS `vouchers_discount_value_pos`
- ADD CONSTRAINT `vouchers_discount_value_pos CHECK (discount_type = 'PRODUCT_PROMO' OR discount_value > 0)`

Constraint baru: PERCENT/FIXED tetap wajib `discount_value > 0`; PRODUCT_PROMO diizinkan `discount_value = 0`.

### Pencegahan

Saat menambahkan tipe baru ke enum/CHECK constraint, review SEMUA constraint yang menyentuh kolom terkait — bukan hanya constraint yang menyebutkan tipe secara eksplisit.

---

## BUG-089 — Admin Promo Produk: Dropdown Masih Kosong Setelah Fix Route (2026-06-20)

**Page:** `/admin` → menu "Promo Produk"
**Reporter:** Admin — "masih bug" setelah BUG-088 diperbaiki

### Root Cause

Schema guard untuk Migration 031 dan 032 tidak ada di `backend/src/app.js`.

`listProductPromoVouchers()` di `vouchers.service.js` menjalankan query JOIN ke tabel `voucher_product_rule`. Tabel ini dibuat oleh Migration 032, tetapi file migrasi (`032_product_promo.sql`) hanya tersedia di folder `migrations/` — tabel tidak otomatis terbuat di environment yang belum menjalankan migrasi tersebut secara manual. Akibatnya query throw PostgreSQL error `relation "voucher_product_rule" does not exist` → 500 Internal Server Error → `Promise.all` di frontend reject → dropdown `products` dan `tenants` tetap `[]`.

Migration 031 (`tenants.odoo_booth_id`) juga belum memiliki guard.

### Fix

**`backend/src/app.js`** — tambah dua schema guard sebelum `initializeScheduledJobs()`:

```js
await runSchemaGuard('Migration 031 — tenants.odoo_booth_id', [
  `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS odoo_booth_id INTEGER DEFAULT NULL`,
]);

await runSchemaGuard('Migration 032 — Product Promo Engine (Buy X Get Y)', [
  `ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_discount_type_check`,
  `ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_percent_range`,
  `ALTER TABLE vouchers ADD CONSTRAINT vouchers_discount_type_check CHECK (discount_type IN ('PERCENT', 'FIXED', 'PRODUCT_PROMO'))`,
  `ALTER TABLE vouchers ADD CONSTRAINT vouchers_percent_range CHECK (discount_type <> 'PERCENT' OR (discount_value > 0 AND discount_value <= 100))`,
  `CREATE TABLE IF NOT EXISTS voucher_product_rule ( ... )`,
  `ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS is_free     BOOLEAN  NOT NULL DEFAULT FALSE`,
  `ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS free_reason VARCHAR(50)`,
  // 4 indexes ...
]);
```

### Pencegahan

Setiap file migration baru **wajib** disertai schema guard idempotent di `app.js` (lihat STD-010). Tanpa guard, environment yang tidak menjalankan migration script secara manual akan gagal saat query menyentuh tabel/kolom baru tersebut.

---

## BUG-088 — Admin Promo Produk: Dropdown "Berlaku untuk Tenant" dan "Produk yang Dibeli" Tidak Muncul (2026-06-20)

**Page:** `/admin` → menu "Promo Produk" → modal "Buat Promo Produk Baru"
**Reporter:** Admin — dropdown tenant dan produk kosong saat membuka modal create promo

### Root Cause

Route ordering bug di `backend/src/modules/vouchers/vouchers.routes.js`.

`adminRouter.get('/product-promos', ...)` didaftarkan **setelah** `adminRouter.get('/:code', ...)`. Karena Express mencocokkan route secara berurutan, request `GET /admin/vouchers/product-promos` ditangkap oleh handler `/:code` dengan `code = 'product-promos'` — route `/product-promos` **tidak pernah dicapai**.

Handler `/:code` memanggil `getVoucherByCode('product-promos')` → tidak ada voucher dengan kode tersebut → throws 404 AppError → `listProductPromos()` di frontend reject.

Di `ProductPromoTab.jsx`, `load()` menggunakan `Promise.all([listProductPromos(), getProducts(), getTenants()])`. Ketika `listProductPromos()` reject, seluruh `Promise.all` reject → catch block dijalankan → `products` dan `tenants` tetap `[]` (nilai awal) → kedua dropdown kosong.

### Fix

**`backend/src/modules/vouchers/vouchers.routes.js`:**
- Pindahkan `GET /product-promos` dan `POST /product-promos` ke **sebelum** `GET /:code`
- Tambah komentar `// MUST be registered BEFORE /:code` sebagai reminder

Urutan route `adminRouter` setelah fix:
```
GET  /                  ← list semua voucher
GET  /product-promos    ← ✅ spesifik, harus sebelum /:code
POST /product-promos    ← ✅ spesifik
GET  /:code             ← generic, setelah semua rute spesifik
POST /                  ← create voucher
PATCH /:code            ← update voucher
DELETE /:code           ← deactivate voucher
```

### Pencegahan

Setiap kali menambahkan route dengan path literal (non-parameter) ke router yang sudah punya route `/:param`, **rute literal harus didaftarkan lebih dulu**. Ini adalah aturan standar Express yang mudah terlewat saat menambahkan route baru ke file yang sudah ada.

---

## BUG-087 — Login Page: Label Email Tampil Sebagai Key (login.email*) dan Placeholder Salah (2026-06-18)

**Page:** `/masuk` — form login email customer
**Reporter:** User — label input email menampilkan `login.email*` alih-alih "Login Email"; placeholder menampilkan `login.emailPh`

### Root Cause

`t()` function di `LangContext` mengembalikan **key** sebagai fallback jika kunci tidak ditemukan di dictionary. Key `login.email` dan `login.emailPh` belum ditambahkan ke `T.ID`, `T.EN`, dan `T.ZH`. Karena `t('login.email')` mengembalikan string `'login.email'` (truthy), fallback `|| 'Email'` tidak pernah dipakai.

### Fix

- `frontend/src/context/LangContext.jsx` — Tambah `'login.email': 'Login Email'` ke semua 3 bahasa (ID, EN, ZH).
- `frontend/src/pages/customer/LoginCustomerPage.jsx` — Hapus prop `placeholder` dari email Input (tidak diperlukan).

---

## BUG-086 — Kasir: Item REJECTED Masih Tampil di Customer Active Transaction (2026-06-18)

**Page:** Role Kasir — PaymentPage, getCustomerActiveTrx lookup
**Reporter:** User — kasir mencari transaksi aktif customer, transaksi dengan partial approval (1 APPROVED + 1 REJECTED) menampilkan 2 item padahal harusnya 1

### Root Cause

`getCustomerActiveTrx()` di `cashier.service.js` melakukan `json_agg` items **tanpa filter** `approval_status`. Sehingga item REJECTED ikut dimasukkan ke array `items`. Lebih buruk lagi, `json_build_object` tidak menyertakan field `approval_status`, sehingga filter frontend `item.approval_status !== 'REJECTED'` tidak efektif (field-nya selalu `undefined`).

```sql
-- Before (buggy): semua item termasuk REJECTED
JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
WHERE t.status IN ('RESERVED', 'WAITING_PAYMENT', 'PENDING')

-- After (fixed): exclude item REJECTED di SQL level
WHERE t.status IN ('RESERVED', 'WAITING_PAYMENT', 'PENDING')
  AND ti.approval_status != 'REJECTED'
```

**File:** `backend/src/modules/cashier/cashier.service.js` — fungsi `getCustomerActiveTrx()`

### Pencegahan

Setiap query yang meng-aggregate items untuk ditampilkan ke user WAJIB filter `approval_status != 'REJECTED'`. Frontend filter tidak cukup jika field tidak tersedia di data.

---

## BUG-085 — Role Helper: Item REJECTED Masih Tampil di Approval Queue (2026-06-18)

**Page:** Role Helper — Antrian Approval (tab "Menunggu" / ApprovalQueueTab)
**Reporter:** User — TXN-20260618-00026: 1 item APPROVED + 1 item REJECTED, tapi 2 item tampil di approval queue card (seharusnya hanya item PENDING yang tampil)

### Root Cause

Dua root cause berbeda, symptom sama (item REJECTED terlihat bersama item yang valid):

1. **BUG-082 (sudah diperbaiki)** — `getBoothOrder()` backend tidak filter REJECTED di handover view.
2. **BUG-085 (bug ini)** — `ItemRow` di `ApprovalQueueTab.jsx` (frontend) menyimpan **local state** `status` yang diupdate ke `'REJECTED'` atau `'APPROVED'` setelah aksi helper, namun komponen **tetap di-render** sampai server refresh berikutnya. Selama jeda network (antara aksi item dan respons `fetchQueue`), item REJECTED masih terlihat di UI bersama item PENDING — menyebabkan helper melihat "2 item" padahal harusnya 1.

Backend `getApprovalQueue()` sudah benar — hanya mengembalikan item `PENDING`. Masalah sepenuhnya di frontend local state.

### Fix

`frontend/src/components/helper/ApprovalQueueTab.jsx` — fungsi `ItemRow`:

```jsx
// Before: item REJECTED/APPROVED masih di-render dengan styling berbeda
// After: item langsung disembunyikan begitu bukan PENDING lagi
if (!isPending) return null;
```

Setelah aksi approve/reject, `ItemRow` langsung return `null` tanpa menunggu server refresh. Server refresh (`fetchQueue(true)`) tetap dipanggil via `onItemUpdated` untuk sinkronisasi state.

### Pencegahan

- Approval queue hanya boleh menampilkan item yang **masih PENDING** — item yang sudah diproses (approved/rejected) tidak perlu terlihat lagi.
- Backend sudah benar (filter PENDING di query). Frontend harus konsisten: jangan render item non-PENDING dari local state.

---

## BUG-084 — Gambar Produk (Bulk Image Upload) Tidak Muncul Setelah Upload (2026-06-18)

**Page:** `/admin?tab=master-data` — bulk image upload via ZIP
**Reporter:** User — gambar berhasil diupload tapi tidak muncul (contoh: P40992-T001 `image_url = /uploads/products/1781768103609-P40992T001.webp`)

### Root Cause

`UPLOADS_DIR` di `bulkImageUpload.controller.js` menggunakan `../../../../public/uploads/products` (4 level up), tapi file tersebut ada di `/app/src/modules/admin/`, sehingga path resolves ke `/public/uploads/products` — **di luar volume Docker yang persisten**.

Volume Docker (`hybrid_uploads_data`) hanya di-mount ke `/app/public/uploads`. File yang disimpan di `/public/uploads/products/` akan hilang setiap kali container di-rebuild.

```js
// Before (salah — resolves ke /public/uploads/products):
const UPLOADS_DIR = path.join(__dirname, '../../../../public/uploads/products');

// After (benar — resolves ke /app/public/uploads/products):
const UPLOADS_DIR = path.join(__dirname, '../../../public/uploads/products');
```

**File:** `backend/src/modules/admin/bulkImageUpload.controller.js`

### Impact

File upload "berhasil" (tidak ada error), URL tersimpan di DB, tapi file fisiknya tidak ada karena disimpan ke path yang tidak di-mount → gambar tidak muncul dan hilang setelah restart.

### Aksi yang Diperlukan

Image yang sudah diupload sebelum fix (termasuk P40992-T001) perlu diupload ulang.

---

## BUG-083 — Admin Master-Data: Buat/Edit Produk Selalu Gagal "Kategori Odoo wajib dipilih" (2026-06-18)

**Page:** `/admin?tab=master-data` — form Buat Produk & Edit Produk
**Reporter:** User — selalu gagal saat simpan produk

### Root Cause

`handleCreate()` dan `handleEdit()` di `MasterDataTab.jsx` memiliki validasi hard:
```js
if (!form.odoo_categ_id) { setFormError('Kategori Odoo wajib dipilih.'); return; }
```

Kategori Odoo diambil dari `getOdooProductCategories()` yang membutuhkan koneksi aktif ke Odoo. Jika Odoo tidak terkoneksi (server down, credentials belum diset), `useOdooProductCategories` hook mengembalikan `categories = []` dan user tidak bisa memilih kategori apapun — sehingga form **selalu gagal** tanpa bisa diselesaikan.

Field `odoo_categ_id` seharusnya opsional (untuk keperluan sinkronisasi Odoo), bukan syarat wajib untuk membuat/mengedit produk.

### Fix

Hapus validasi wajib `odoo_categ_id` dari `handleCreate` dan `handleEdit` di `MasterDataTab.jsx`. Field tetap tersedia di form untuk diisi jika Odoo tersambung.

**File:** `frontend/src/pages/admin/tabs/MasterDataTab.jsx`

### Pencegahan

Field integrasi pihak ketiga (Odoo, WA, dsb.) tidak boleh dijadikan syarat wajib untuk operasi core. Jika integrasi tidak tersedia, operasi utama tetap harus bisa berjalan.

---

## BUG-082 — Role Helper: Item REJECTED Masih Tampil di Handover View (2026-06-18)

**Page:** Role Helper — view handover order (scan TXN / GRP invoice)
**Reporter:** User — TXN-20260618-00017: 1 item APPROVED + 1 item REJECTED, tapi 2 item tampil di handover view (seharusnya hanya 1 item APPROVED)

### Root Cause

`getBoothOrder()` dan `_getGroupOrderForBooth()` di `helper.service.js` mengambil **semua** item milik booth dari transaksi tanpa memfilter `approval_status`. Akibatnya item yang sudah REJECTED tetap tampil di tampilan handover, padahal item tersebut tidak perlu diserahkan ke customer (sudah ditolak oleh helper).

```sql
-- Before (buggy): mengambil semua item termasuk REJECTED
WHERE ti.transaction_id = $1 AND ti.tenant_id = $2

-- After (fixed): exclude item REJECTED
WHERE ti.transaction_id = $1 AND ti.tenant_id = $2 AND ti.approval_status != 'REJECTED'
```

**Files:**
- `backend/src/modules/helper/helper.service.js` — `getBoothOrder()` (single TXN)
- `backend/src/modules/helper/helper.service.js` — `_getGroupOrderForBooth()` (GRP invoice)

**Fix tambahan sebelumnya (masih valid):**
- `getApprovalQueue()` — items sub-query juga ditambah filter `AND ti.approval_status = 'PENDING'` agar approval queue hanya menampilkan item yang belum diproses.

### Pencegahan

Item REJECTED tidak boleh tampil di handover view — customer tidak mendapat barang yang ditolak. Setiap query items untuk helper view wajib menyaring `approval_status != 'REJECTED'` (lihat STD-042).

---

## BUG-080 — OTP Email Customer: Register & Login Tidak Kirim OTP (2026-06-18)

**Page:** `/daftar` (Register) dan `/masuk` (Login Customer) — mode Email
**Reporter:** User — daftar/login via email langsung masuk tanpa OTP

### Root Cause

OTP email untuk customer pernah diimplementasikan (CR history), namun suatu saat `registerCustomer()` dan `loginCustomer()` di `auth.service.js` dimodifikasi menjadi langsung INSERT/issue token tanpa OTP — mengabaikan flow `pending_registrations` dan `customerOtpSvc` yang sudah ada. Frontend (`RegisterPage.jsx`, `LoginCustomerPage.jsx`) juga tidak memiliki step OTP karena response yang diterima langsung berisi token.

Semua infrastruktur OTP tetap utuh:
- `verifyRegisterOtp()` — masih ada di `auth.service.js`
- `verifyCustomerOtp()` — masih ada di `auth.service.js`
- `customerOtpSvc.storeOTP/verifyOTP` — masih berfungsi
- `sendCustomerOTPEmail()` — masih ada di `email.service.js`
- Route `/register/verify-otp` dan `/verify-otp/customer` — masih terdaftar di `auth.router.js`

Hanya titik masuknya yang di-bypass.

### Fix

**`backend/src/modules/auth/auth.service.js`**:

1. `registerCustomer()` — jika `email` tersedia:
   - Generate OTP via `customerOtpSvc.generateOTP()`
   - Hash via `customerOtpSvc.hashOTP()`
   - INSERT ke `pending_registrations` dengan `ON CONFLICT DO UPDATE`
   - Kirim via `sendCustomerOTPEmail()`
   - Return `{ requiresOtp: true, tempToken, maskedEmail }`
   - Jika phone-only (tanpa email) → direct register (tidak berubah)

2. `loginCustomer()` — jika `isEmailMode` (hanya email, tanpa phone):
   - Generate & hash OTP
   - `customerOtpSvc.storeOTP(customer_id, otpHash)`
   - Kirim via `sendCustomerOTPEmail()`
   - Return `{ requiresOtp: true, tempToken, maskedEmail }`
   - Jika phone mode → direct login (tidak berubah)

**`frontend/src/pages/customer/RegisterPage.jsx`**:
- Import `verifyRegisterOtp`
- Tambah state: `otpStep`, `tempToken`, `maskedEmail`, `otpCode`, `otpLoading`
- `handleSubmit`: jika `data.requiresOtp` → masuk OTP step, tampilkan form input kode
- `handleOtpSubmit`: panggil `verifyRegisterOtp({ tempToken, otpCode })` → login → navigate

**`frontend/src/pages/customer/LoginCustomerPage.jsx`**:
- Import `verifyCustomerOtp`
- Tambah state: `otpStep`, `tempToken`, `maskedEmail`, `otpCode`, `otpLoading`
- `handleSubmit`: jika `data.requiresOtp` → masuk OTP step
- `handleOtpSubmit`: panggil `verifyCustomerOtp({ tempToken, otpCode })` → login → navigate

### Perilaku Setelah Fix

| Cara Daftar/Login | OTP? | Channel |
|---|---|---|
| Register via Email | Ya | Email |
| Register via HP (phone-only) | Tidak | — (langsung daftar) |
| Login via Email | Ya | Email |
| Login via HP | Tidak | — (langsung login) |

### Prevention

`registerCustomer()` dan `loginCustomer()` harus selalu melalui OTP ketika email-only mode. Jangan menghilangkan OTP path saat refaktor — infrastruktur OTP customer (service, routes, tabel) adalah security requirement yang terdokumentasi di STD.

---

## BUG-081 — OTP Step Tidak Muncul di Browser Setelah Deploy (2026-06-18)

**Page:** `/daftar` (Register) dan `/masuk` (Login Customer) — mode Email
**Symptom:** Backend sudah mengembalikan `requiresOtp: true` tapi browser tidak menampilkan OTP step

### Root Cause

Dua masalah bersamaan:

**1. Browser cache index.html** — Nginx tidak mempunyai `Cache-Control` untuk `index.html`. Browser menyimpan versi lama `index.html` yang masih merujuk ke JS build lama (sebelum OTP step ditambahkan). Vite menggunakan content-hash pada nama file JS (misal `index-Bocps9SR.js`), sehingga bila `index.html` tidak diperbarui karena cache browser, JS lama dimuat dan OTP step tidak ada dalam bundle.

**2. `identifierType` tidak ada di response** — Backend mengembalikan `{ requiresOtp: true, tempToken, maskedEmail }` tanpa `identifierType`. Router mengecek `data.identifierType === 'email'` untuk menentukan pesan response; tanpa field ini, pesan berbunyi "OTP dikirim ke WhatsApp Anda." padahal OTP dikirim ke email.

**3. Bug `if (email)` di `registerCustomer`** — Register dengan phone+email (phone mode, optional email) seharusnya langsung register tanpa OTP (email bukan primary identifier). Kondisi `if (email)` salah — harus `if (!phone_number && email)` agar konsisten dengan logika `isEmailMode` di `loginCustomer`.

### Fix

**`frontend/nginx.conf`** — Tambah block khusus untuk `index.html` dengan `Cache-Control: no-cache`:
```nginx
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}
```

**`backend/src/modules/auth/auth.service.js`**:
- `registerCustomer()`: ubah `if (email)` → `const isEmailMode = !phone_number && !!email; if (isEmailMode)`
- `registerCustomer()` OTP response: tambah `identifierType: 'email'`
- `loginCustomer()` OTP response: tambah `identifierType: 'email'`
- `registerCustomer()` pending_registrations INSERT: tambah `identifier_type = 'email'`

### Prevention

1. Nginx SPA WAJIB mempunyai `Cache-Control: no-cache` untuk `index.html` (lihat STD-041)
2. Response OTP customer HARUS menyertakan `identifierType` field
3. `isEmailMode` logic di register HARUS sama dengan di login: `!phone_number && !!email`

---

## BUG-079 — "Proses N Baris" Bulk Update Stok+Tenant: Internal Server Error (2026-06-18)

**Page:** Bulk Upload Produk → tombol "Proses N Baris"
**Endpoint:** `POST /api/v1/admin/products/bulk-update-stock-tenant`

### Root Cause

`admin.router.js` menggunakan fungsi `query(...)` di line 75 untuk lookup tabel `tenants`, tapi `query` tidak pernah di-require di file tersebut:

```js
// Sebelum fix — query tidak ada di require list
const express   = require('express');
const ExcelJS   = require('exceljs');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
// ...
// query digunakan di line 75 tapi tidak di-require → ReferenceError
```

Error: `ReferenceError: query is not defined at admin.router.js:75`

Fungsi `query` tersedia di `../../config/database` (sudah dipakai di `admin.service.js` dan `bulkUpload.controller.js`), tapi lupa di-require saat endpoint baru ditambahkan langsung di router.

### Fix

**`backend/src/modules/admin/admin.router.js`** — tambah satu baris require:
```js
const { query } = require('../../config/database');
```

### Prevention

Endpoint yang mengakses DB langsung di router (bukan via service) harus selalu import `query`. Lebih baik pindahkan logika DB ke `admin.service.js` agar import terpusat dan konsisten.

---

## BUG-078 — Tombol "Cetak" di Master Data Tidak Bisa Export Excel (2026-06-18)

**Page:** `/admin?tab=master-data` → tombol "🖨️ Cetak" → halaman `/admin/print-products`
**Reporter:** Admin — klik tombol Cetak, tidak ada opsi convert ke Excel

### Root Cause

`MasterDataPrintPage.jsx` hanya memiliki tombol "🖨️ Cetak / Simpan PDF" (`window.print()`). Tidak ada tombol export Excel sama sekali — fitur ini belum pernah diimplementasikan di halaman print, meskipun `exportToExcel` utility sudah tersedia di `frontend/src/utils/exportExcel.js` dan dipakai di halaman laporan lain (SalesReportPage, RecapPage, dll.).

### Fix

**`frontend/src/pages/admin/MasterDataPrintPage.jsx`:**
1. Import `exportToExcel` dari `../../utils/exportExcel`
2. Tambah fungsi `handleExportExcel()`:
   - Jika `groupByBooth = true` dan ada lebih dari 1 grup: export multi-sheet (1 sheet per booth + 1 sheet "Summary")
   - Jika tidak: export flat 1 sheet "Produk"
   - Kolom: No, Nama Produk, Booth, Kategori, Barcode, Harga, Qty, Nilai Stok, Status, Pre-Order
   - Filename: `MasterData_Produk_YYYY-MM-DD.xlsx`
3. Tambah tombol **"📊 Export Excel"** (hijau) di toolbar, sebelum tombol "🖨️ Cetak / Simpan PDF"
4. Tombol Excel terpengaruh oleh filter aktif (tenant, status aktif) — mengekspor data yang sama yang ditampilkan di layar

### Prevention

Setiap halaman print/laporan yang menampilkan tabel data HARUS menyertakan tombol Export Excel (STD-024 pattern). Gunakan `exportToExcel` dari `frontend/src/utils/exportExcel.js`.

---

## BUG-077 — Produk Tidak Muncul di Kasir POS (2026-06-17)

**Page:** `/cashier/pos` → area product browser
**Reporter:** Admin — daftar produk kosong, tampil "Tidak ada produk ditemukan."

### Root Cause

Backend crash saat startup karena `TxnExpireJob.js` menggunakan path `require` yang salah saat BUG-076 ditambahkan:

```
Error: Cannot find module '../../ws/websocket'
Require stack: TxnExpireJob.js → JobBootstrap.js → admin.router.js → app.js
```

`TxnExpireJob.js` berada di `modules/scheduler/jobs/`, sehingga untuk mencapai `src/ws/websocket.js` dibutuhkan **3 level naik** (`../../../ws/websocket`), bukan 2.

Ketika backend crash, semua API gagal. Frontend POS menangkap error secara diam-diam via `.catch(() => {})`, sehingga produk tidak muncul tanpa pesan error yang informatif.

### Fix

**`backend/src/modules/scheduler/jobs/TxnExpireJob.js`:**
```javascript
// Salah (2 level):
const { broadcastToAll } = require('../../ws/websocket');

// Benar (3 level):
const { broadcastToAll } = require('../../../ws/websocket');
```

### Pelajaran

Selalu verifikasi relative path `require()` dengan menghitung level direktori dari posisi file. Untuk file yang dalam subdirektori dalam (`modules/X/jobs/`), hitungan level mudah keliru. Gunakan `__dirname` + `path.join` atau alias modul jika struktur direktori dalam.

---

## BUG-076 — Queue Kasir Menampilkan Transaksi PENDING yang Sudah EXPIRED (2026-06-17)

**Page:** `/cashier` → tab Queue
**Reporter:** Admin — TXN-20260617-00525 dan TXN-20260617-00526 masih muncul sebagai PENDING padahal sudah EXPIRED di DB

### Root Cause

Dua masalah terpisah:

1. **Backend — `TxnExpireJob.js`** tidak broadcast WebSocket event setelah sweep. Transaksi di-expire di DB tapi tidak ada notifikasi ke frontend.
2. **Frontend — `CashierDashboardPage.jsx`** hanya memuat data sekali saat mount (`useEffect([], [])`), tidak ada mekanisme auto-refresh.

Akibatnya: setelah sweep berjalan (setiap 5 menit), queue tetap menampilkan status lama sampai halaman di-reload manual.

### Fix

**Backend** — `backend/src/modules/scheduler/jobs/TxnExpireJob.js`:
```javascript
const { broadcastToAll } = require('../../ws/websocket');

// di akhir execute(), setelah sweep selesai:
if (total > 0) {
  try {
    broadcastToAll({ event: 'txn:expired', data: { count: total } });
  } catch { /* non-critical */ }
}
```

**Frontend** — `frontend/src/pages/cashier/CashierDashboardPage.jsx`:
- Tambah import `useWebSocket` dan `useRef`
- Subscribe event `txn:expired` → trigger `loadQueue()` + `loadExpired()`
- Auto-poll fallback setiap 60 detik (antisipasi WebSocket putus):
```javascript
// subscribe txn:expired
useEffect(() => {
  return subscribe('txn:expired', () => {
    loadQueue();
    loadExpired();
  });
}, [subscribe, loadQueue, loadExpired]);

// auto-poll 60s fallback dalam mount useEffect
pollRef.current = setInterval(() => {
  loadQueue();
  loadExpired();
}, 60_000);
```

### Pelajaran

Job scheduler yang mengubah data harus selalu broadcast event WebSocket agar frontend dapat bereaksi secara real-time. Tambahkan auto-poll sebagai failsafe jika koneksi WebSocket tidak stabil.

---

## BUG-075 — Form Shipping Pre-Order Tidak Auto-Fill di Helper Order (2026-06-17)

**Page:** `/helper` → tab Order → MembuatOrderPanel → form "Alamat Pengiriman (Pre-Order)"
**Reporter:** Admin — form tidak terisi otomatis setelah lookup customer berhasil

### Root Cause

CR-062 menggunakan `useEffect` dengan dependency `[customerInfo]` untuk auto-fill:

```javascript
useEffect(() => {
  if (customerInfo?.found === true) {
    setShipName(customerInfo.full_name || '');
    ...
  }
}, [customerInfo]);
```

Pendekatan ini rentan: React meng-schedule effect SETELAH render selesai, dan dalam beberapa kondisi (React 18 batching, concurrent mode) effect tidak di-trigger atau terlambat sehingga user tidak melihat perubahan.

### Fix

Hapus `useEffect` dan pindahkan auto-fill langsung ke dalam async callback lookup di `handlePhoneChange` — all state changes di-batch dalam satu React render:

```javascript
const data = res.data.data;
setCustomerInfo({ found: true, ...data });
setShipName(data.full_name || '');
setShipPhone(data.phone_number || '');
setShipAddress('Amazing Toy Show Indonesia');
```

### Pelajaran

Gunakan direct state update dalam async callback daripada `useEffect` untuk efek samping yang bergantung pada hasil async operation. `useEffect` tepat untuk reactive side effects (DOM sync, subscriptions) — bukan untuk "setelah async selesai, lakukan X".

---

## CR-061 — Customer Phone Lookup di Helper Order Panel (2026-06-17)

**Page:** `/helper` → tab Order → MembuatOrderPanel
**Status:** RESOLVED

### Perubahan
- `backend/src/modules/cashier/cashier.router.js` — tambah `'HELPER'` ke `authorize()` di `/customer-lookup`
- `frontend/src/pages/helper/HelperPage.jsx` — debounced lookup + customer info panel (pola CR-060)

---

## CR-060 — Verifikasi Customer di Kasir POS (2026-06-17)

**Page:** `/cashier/pos`
**Status:** RESOLVED

### Perubahan
- `backend/src/modules/cashier/cashier.service.js` — tambah `lookupCustomerByPhone(phone)`
- `backend/src/modules/cashier/cashier.router.js` — tambah `GET /cashier/customer-lookup?phone=`
- `frontend/src/api/cashier.js` — tambah `lookupCustomerByPhone(phone)`
- `frontend/src/pages/cashier/CashierPOSPage.jsx` — debounced lookup + customer info panel

---

## BUG-074 — Registrasi via Email Gagal "Internal server error." saat Verifikasi OTP (2026-06-17)

**Page:** `/daftar`
**Reporter:** Customer daftar via email (mode email), isi juga phone opsional, OTP dikirim. Saat verifikasi OTP → "Internal server error."

### Root Cause (3 bugs berantai)

**Bug 1 — Router `/register` tidak mendukung email-only registration**
Router memvalidasi `phone_number` sebagai required:
```javascript
body('phone_number').trim().notEmpty().matches(...)
```
Tanpa `.optional()`, jika `phone_number` tidak ada di body → "Validation failed." (422). Customer tidak bisa registrasi dengan email saja.

**Bug 2 — `registerCustomer` tidak cek duplikat email saat phone mode**
Kode cek duplikat hanya di `isEmailMode`:
```javascript
if (isEmailMode) { // cek email }
else              { // cek phone saja, tidak cek email! }
```
`isEmailMode = !phone_number && !!email` — jika customer isi KEDUANYA (email mode UI + phone opsional), service anggap phone mode dan SKIP pengecekan duplikat email.

Customer `aristya rahadiyan` (089999999999) sudah punya email `aristya.rahadian07@gmail.com`. Saat Roy II daftar dengan email yang sama + phone baru, step 1 lolos (karena phone baru, email tidak dicek). Step 2 OTP verify → INSERT ke customers → **unique constraint violation** `idx_customers_email` → non-AppError → **"Internal server error."**

**Bug 3 — `pending_registrations.phone_number` masih NOT NULL**
Bahkan setelah migration 030 diterapkan, kolom `phone_number` di `pending_registrations` tetap NOT NULL. Untuk email-only registration, `phone_number = null` → INSERT gagal dengan constraint violation → "Internal server error." di step 1.

### Fix Applied

**1. `backend/src/modules/auth/auth.service.js` — cek duplikat keduanya:**
```javascript
if (phone_number) {
  const exists = await query(`SELECT customer_id FROM customers WHERE phone_number = $1`, [phone_number]);
  if (exists.rows.length > 0)
    throw new AppError('Nomor telepon sudah terdaftar, silakan login.', 409);
}
if (email) {
  const exists = await query(`SELECT customer_id FROM customers WHERE email = $1`, [email]);
  if (exists.rows.length > 0)
    throw new AppError('Email sudah terdaftar, silakan login.', 409);
}
```

**2. `backend/src/modules/auth/auth.router.js` — `phone_number` opsional, custom validator:**
```javascript
body('phone_number').optional().trim().matches(/^(08|\+628)\d{8,11}$/).withMessage(...),
body('email').optional().trim().isEmail().withMessage(...),
body().custom((_, { req }) => {
  if (!req.body.phone_number && !req.body.email)
    throw new Error('Nomor HP atau email wajib diisi.');
  return true;
}),
```

**3. DB — `pending_registrations.phone_number` nullable:**
```sql
ALTER TABLE pending_registrations ALTER COLUMN phone_number DROP NOT NULL;
```

**4. `backend/src/app.js` — tambah ke Migration 030 schema guard:**
```javascript
`ALTER TABLE pending_registrations ALTER COLUMN phone_number DROP NOT NULL`,
```

---

## BUG-073 — Login Customer via Phone Number Gagal ("Internal server error." / "Validation failed.") (2026-06-17)

**Page:** `/masuk`
**Reporter:** Customer tidak bisa login via nomor HP — muncul "Internal server error." Saat coba mode email, muncul "Validation failed."

### Root Cause 1 — Migration 030 tidak terdaftar di schema runner (`app.js`)

`auth.service.js` dan `customer_login_attempt.service.js` diperbarui untuk menggunakan kolom `identifier` di tabel `customer_login_attempts` (mendukung phone ATAU email sebagai lockout key). Namun migration 030 (`030_phone_email_flexible.sql`) **tidak pernah ditambahkan ke `runSchemaGuard` di `app.js`**.

Akibatnya, kolom `identifier` tidak ada di DB saat runtime:
```
error: column "identifier" does not exist
  at customer_login_attempt.service.js:10 (checkLockout)
  at auth.service.js:393 (loginCustomer)
```

Karena error ini bukan `AppError` (tidak `isOperational`), error handler mengembalikan `"Internal server error."` ke client.

### Root Cause 2 — Router `/login/customer` tidak mendukung mode email

Route validator di `auth.router.js` hanya memvalidasi `phone_number` sebagai required:
```javascript
body('phone_number').trim().notEmpty().withMessage('Nomor telepon wajib diisi.')
```

Saat user pilih tab email dan kirim `{ email: "..." }` tanpa `phone_number`, validator `notEmpty()` gagal → `validate` middleware mengembalikan `"Validation failed."` (HTTP 422).

Padahal `auth.service.js` **sudah mendukung kedua mode** (phone OR email) sejak migration 030.

### Fix Applied

**1. DB — migration 030 diterapkan langsung:**
```sql
ALTER TABLE customer_login_attempts ADD COLUMN IF NOT EXISTS identifier VARCHAR(255);
UPDATE customer_login_attempts SET identifier = phone_number WHERE identifier IS NULL;
ALTER TABLE customer_login_attempts ALTER COLUMN phone_number TYPE VARCHAR(255);
DROP INDEX IF EXISTS idx_customer_login_attempts_phone;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_login_attempts_identifier
  ON customer_login_attempts (identifier);
-- (plus customers dan pending_registrations changes)
```

**2. `backend/src/app.js` — tambah schema guard Migration 030:**
```javascript
await runSchemaGuard('Migration 030 — Phone/Email flexible auth', [
  `ALTER TABLE customers ALTER COLUMN phone_number DROP NOT NULL`,
  // ... check constraint, email index, pending_registrations, customer_login_attempts
]);
```

**3. `backend/src/modules/auth/auth.router.js` — update `/login/customer` validator:**
```javascript
body('phone_number').optional().trim(),
body('email').optional().trim().isEmail().withMessage('Format email tidak valid.'),
body().custom((_, { req }) => {
  if (!req.body.phone_number && !req.body.email)
    throw new Error('Nomor HP atau email wajib diisi.');
  return true;
}),
body('deviceId').optional().isUUID().withMessage('deviceId harus berformat UUID.'),
```

### Lesson Learned → STD-037

Setiap kali membuat file SQL di `backend/migrations/`, WAJIB langsung mendaftarkan SQL-nya ke `runSchemaGuard` di `app.js`. File migration SQL yang tidak terdaftar di schema runner tidak akan pernah dieksekusi pada deployment baru maupun restart.

---

## BUG-072 — Total Group Payment Anomali (String Concatenation) + CASHIER_EDITABLE di GroupPaymentPage (2026-06-17)

**Reporter:** `/cashier/group-bayar` — setelah kasir tambah produk via product browser, total berubah menjadi nilai absurd (Rp 29.840.000.234.144 yang seharusnya Rp 30.074.144).

### Root Cause BUG 1 — String Concatenation pada `extraAmount`

PostgreSQL kolom `NUMERIC`/`DECIMAL` dikirim sebagai **string** oleh `node-postgres` (default behavior). `normalizeProduct()` di `GroupPaymentPage.jsx` menyalin `price: p.price` tanpa konversi.

Saat kasir klik "+ Tambah":
```
setExtraAmount(prev => prev + product.price)
= 0 + "234144"           // number + string = string concatenation!
= "234144"               // extraAmount menjadi string
```

Lalu saat menghitung grandTotal:
```
grandTotal = baseTotal + extraAmount
= 29840000 + "234144"    // number + string = string concatenation!
= "29840000234144"       // = Rp 29.840.000.234.144 ❌
```

`formatRupiah(extraAmount)` masih tampil benar karena `Intl.NumberFormat.format()` menerima string numerik.

### Root Cause BUG 2 — CASHIER_EDITABLE tidak diterapkan di GroupPaymentPage

Product browser di `GroupPaymentPage` tidak memiliki status guard, tidak konsisten dengan `PaymentPage` (BUG-069/BUG-070 pattern).

### Fix

**`frontend/src/pages/cashier/GroupPaymentPage.jsx`:**
- `normalizeProduct`: `price: p.price` → `price: parseFloat(p.price) || 0`
- `handleAddProduct`: `setExtraAmount(prev => prev + product.price)` → `+ parseFloat(product.price)` (defense-in-depth)
- Tambah `const CASHIER_EDITABLE = ['PENDING', 'RESERVED', 'WAITING_PAYMENT']`
- Tambah `const isEditable = CASHIER_EDITABLE.includes(selectedTrx[0]?.status)`
- Wrap panel product browser kanan dengan `{isEditable && ...}`

**`frontend/src/pages/cashier/PaymentPage.jsx`:**
- `normalizeProduct`: sama — `price: parseFloat(p.price) || 0` (bug yang sama, dipatch sekalian)

### Standarisasi

Ditambahkan **STD-036** — `price` dari API wajib di-cast `parseFloat()` sebelum dipakai dalam aritmatika.

---

## BUG-070 — Backend Menolak Add Item & Voucher untuk Transaksi RESERVED (2026-06-17)

**Reporter:** Kasir — setelah BUG-069 fix (frontend menampilkan fitur untuk RESERVED), backend tetap menolak dengan 422: "Hanya transaksi PENDING yang dapat diubah" (add item) dan "Voucher hanya dapat diterapkan pada transaksi PENDING" (voucher).

### Root Cause

Dua fungsi backend hardcode `status !== 'PENDING'` sebagai guard:
- `addItemToTransaction()` — `orders.service.js` line 737
- `applyVoucherToTransaction()` — `orders.service.js` line 842

Keduanya tidak mengenal status RESERVED yang dipakai oleh HELPER_INPUT flow. Frontend (BUG-069) sudah diperluas ke `isEditable` tapi backend belum mengikuti.

**Pattern masalah:** Frontend dan backend menggunakan definisi "transaksi yang bisa diubah kasir" yang tidak konsisten. Frontend: `['PENDING', 'RESERVED', 'WAITING_PAYMENT']`. Backend: `['PENDING']` saja.

### Fix

**`backend/src/modules/orders/orders.service.js`:**
- `addItemToTransaction`: ganti `status !== 'PENDING'` → `!CASHIER_EDITABLE.includes(status)` di mana `CASHIER_EDITABLE = ['PENDING', 'RESERVED', 'WAITING_PAYMENT']`
- `applyVoucherToTransaction`: sama — ganti dengan `CASHIER_EDITABLE` check
- Pesan error diperbarui untuk menyebutkan semua status yang diizinkan

**`frontend/src/pages/cashier/PaymentPage.jsx`:**
- Guard voucher dikembalikan ke `isEditable` (sebelumnya sempat di-revert ke `isPending` saat investigasi BUG-069)

### Standarisasi

Ditambahkan **STD-035** — Status Guard Kasir: Gunakan `CASHIER_EDITABLE`, bukan hardcode `'PENDING'`. Berlaku untuk semua fungsi kasir baru yang ditambahkan di masa depan.

---

## BUG-069 — Fitur Kasir di /cashier/bayar/:id Hilang saat Status RESERVED (2026-06-17)

**Reporter:** Kasir — di halaman `/cashier/bayar/:id`, tiga fitur tidak tampil: (1) product browser + kategori di panel kanan, (2) tombol hapus item 🗑️, (3) input voucher.

### Root Cause

`PaymentPage.jsx` menggunakan variabel `isPending` (`txn?.status === 'PENDING'`) sebagai gate untuk ketiga fitur tersebut. Transaksi HELPER_INPUT flow masuk dengan status `RESERVED` (bukan `PENDING`), sehingga semua fitur tersembunyi.

### Fix

**`frontend/src/pages/cashier/PaymentPage.jsx`:**
- Tambah variabel `isEditable = ['PENDING', 'RESERVED', 'WAITING_PAYMENT'].includes(txn?.status)`
- Ganti guard dengan `{isEditable && ...}` untuk dua fitur:
  - Tombol hapus item (🗑️) per baris item
  - Panel kanan product browser + search + kategori
- Voucher **tetap** `{isPending && ...}` — backend `applyVoucherToTransaction` menolak status non-PENDING dengan 422 (`status !== 'PENDING'`). Menampilkan voucher input untuk RESERVED akan selalu error.

---

## BUG-051-03 — Pre-Order PENDING Tidak Muncul di /admin/preorder (2026-06-17)

**Reporter:** TXN-20260616-00167 (status `PENDING`) tidak ditemukan di halaman `/admin/preorder` tab manapun.

### Root Cause

**`preorder.service.js` statusMap tidak mencakup status awal pre-order (`PENDING_APPROVAL`, `PENDING`).**

TXN-20260616-00167 memiliki `status = 'PENDING'` (sudah disetujui helper, belum dibayar customer). Sebelum fix:

| Status         | Tercover di admin/preorder? |
|----------------|----------------------------|
| PENDING_APPROVAL | ❌ Tidak                   |
| PENDING          | ❌ Tidak                   |
| PAID             | ✅ Tab "Sudah Dibayar"     |
| AWAITING_SHIPMENT| ✅ Tab "Menunggu Kirim"    |
| ARRIVED          | ✅ Tab "Barang Sudah Sampai"|
| COMPLETED        | ✅ Tab "Selesai"           |

Status PENDING_APPROVAL dan PENDING tidak ada di statusMap → admin tidak bisa memonitor pre-order yang belum dibayar.

### Fix

**`backend/src/modules/preorder/preorder.service.js`:**
- Tambah `'pending': ['PENDING_APPROVAL', 'PENDING']` ke statusMap
- Tambah `'PENDING_APPROVAL', 'PENDING'` ke entry `active` dan `all`

**`frontend/src/pages/admin/PreorderShipmentPage.jsx`:**
- Tab baru "Menunggu Pembayaran" (key: `'pending'`, warna ungu `#7C3AED`) — posisi pertama
- Badge status per card: "Menunggu Approval Helper" (PENDING_APPROVAL) atau "Menunggu Pembayaran" (PENDING)
- Default tab diubah ke `'pending'` — admin langsung lihat yang perlu perhatian
- Tab info-only (tidak ada action button) — admin hanya monitor, bukan action

### Complete Tab Coverage After Fix

```
Menunggu Pembayaran → Sudah Dibayar → Menunggu Kirim → Barang Sudah Sampai → Selesai
   (PENDING_APPROVAL/PENDING)  (PAID)  (AWAITING_SHIPMENT)  (ARRIVED)  (COMPLETED)
```

### Prevention

Admin page harus selalu mencakup SEMUA status pre-order dari awal flow. Lihat STD-034 Rule L.

---

## BUG-051-02 — Pre-Order PAID Tidak Muncul di /admin/preorder (2026-06-17)

**Reporter:** TXN-20260616-00167 tidak ditemukan di halaman `/admin/preorder`.

### Root Cause

**Gap transisi status `PAID → AWAITING_SHIPMENT` tidak diimplementasikan.**

Flow CR-050: `PAID → AWAITING_SHIPMENT → ARRIVED → PREORDER_HANDOVER → COMPLETED`

Tiga komponen bermasalah:

1. **`getPreorderList` statusMap** tidak punya entry `'paid'` → PAID transactions tidak bisa di-query oleh admin page.
2. **`STATUS_TABS` di `PreorderShipmentPage.jsx`** tidak punya tab "Sudah Dibayar" → tidak ada UI untuk melihat PAID pre-orders.
3. **Tidak ada endpoint/fungsi transisi `PAID → AWAITING_SHIPMENT`** → setelah customer bayar, tidak ada cara admin memindahkan order ke antrian pengiriman.

Akibatnya: PAID pre-orders "hilang" — tidak tampil di tab manapun di /admin/preorder, dan tidak bisa diproses.

### Fix

**`backend/src/modules/preorder/preorder.service.js`:**
- Tambah `'paid': ['PAID']` ke statusMap
- Tambah `'PAID'` ke entry `active` dan `all`
- Fungsi baru `confirmReadyToShip(txnId)` → UPDATE status `PAID → AWAITING_SHIPMENT` + audit log

**`backend/src/modules/preorder/preorder.router.js`:**
- Route baru `PATCH /preorder/:txnId/ready-to-ship`

**`frontend/src/api/preorder.js`:**
- Export `confirmReadyToShip(txnId)`

**`frontend/src/pages/admin/PreorderShipmentPage.jsx`:**
- Tab baru "Sudah Dibayar" (key: `'paid'`, warna orange)
- Button "🚀 Proses Pengiriman" di tab paid → confirmation modal → `confirmReadyToShip`
- State `readyConfirm` + handler `handleReady()`

### Complete Status Flow After Fix

```
PAID → [Admin klik Proses Pengiriman] → AWAITING_SHIPMENT
     → [Admin klik Konfirmasi Sudah Sampai] → ARRIVED
     → [Helper serah terima] → PREORDER_HANDOVER / COMPLETED
```

### Prevention

Lihat STD-034 (dibuat bersamaan dengan bug ini).

---

## BUG-051-01 — Pre-Order Stepper Tidak Menunjukkan Step Aktif (2026-06-17)

**Reporter:** TXN-20260616-00167 — tracking stepper semua step grey, tidak ada step yang highlight sebagai current/done.

### Root Cause

Dua bug dalam logika stepper di `OrderTrackingPage.jsx`:

**Bug A — `curIdx = -1` untuk status PENDING/PENDING_APPROVAL**

Step pertama menggunakan key `'PAID'`, sehingga saat status transaksi adalah `'PENDING'` atau `'PENDING_APPROVAL'`:
```javascript
const curIdx = ORDER.indexOf(order.status);
// ORDER = ['PAID', 'AWAITING_SHIPMENT', 'ARRIVED', ...]
// order.status = 'PENDING' → indexOf = -1
// Efek: done = (-1 >= idx) = false untuk SEMUA step
// curIdx = -1 tidak cocok dengan satu pun step → tidak ada highlight
```

**Bug B — Step keys semantically salah**

`{ key: 'PAID', label: 'Pembayaran' }` berarti: "step Pembayaran dianggap AKTIF ketika status sudah PAID." Padahal PAID = pembayaran sudah selesai → harusnya step berikutnya (Menunggu Kirim) yang aktif.

Mapping yang benar:
- `'PENDING'` → step aktif saat customer belum bayar → label "Pembayaran"
- `'PAID'` → step aktif setelah bayar, menunggu kirim → label "Menunggu Kirim"
- `'AWAITING_SHIPMENT'` → sedang dikirim → label "Dalam Pengiriman"
- dll.

### Fix

**`frontend/src/pages/customer/OrderTrackingPage.jsx`:**

1. Remapping step keys agar setiap step CURRENT ketika status = key:
```javascript
const PREORDER_STEPS = [
  { key: 'PENDING',          label: 'Pembayaran',        icon: '💳' },
  { key: 'PAID',             label: 'Menunggu Kirim',    icon: '📦' },
  { key: 'AWAITING_SHIPMENT',label: 'Dalam Pengiriman',  icon: '🚚' },
  { key: 'ARRIVED',          label: 'Tiba di Indonesia', icon: '📍' },
  { key: 'PREORDER_HANDOVER',label: 'Serah Terima',      icon: '🤝' },
  { key: 'COMPLETED',        label: 'Selesai',           icon: '✅' },
];
```

2. Map `PENDING_APPROVAL` → `PENDING` sebelum indexOf:
```javascript
const mappedStatus = order.status === 'PENDING_APPROVAL' ? 'PENDING' : order.status;
const curIdx = ORDER.indexOf(mappedStatus);
```

3. Hapus `usesShippedFlow` (SHIPPED legacy step) — AWAITING_SHIPMENT menggantikan SHIPPED di flow baru per CR-050.

### Prevention

Lihat STD-033 (dibuat bersamaan dengan bug ini).

---

## RC-051 — CR-051: Penyempurnaan Approval Pre-Order (2026-06-17)

### CR1 — Tab "Approval Pre-Order" Tambah Status PENDING_APPROVAL

**Perubahan:** `getPreorderApprovalOrders` (was `getPreorderPaidOrders`) — query diubah dari `status = 'PAID'` menjadi `status IN ('PENDING_APPROVAL', 'PAID')`, diurutkan PENDING_APPROVAL lebih dulu. Route `GET /helper/preorder-queue` (was `/preorder-paid`). Panel di HelperPage menampilkan dua seksi: "Menunggu Approval" dan "Sudah Dibayar".

**Files:** `helper.service.js`, `helper.router.js`, `api/helper.js`, `HelperPage.jsx`

### CR2 — Auto-fill Shipping Form dengan Data Customer

**Perubahan:** `ApprovalCard` shipping state di-init dengan data dari `txn`:
```javascript
const [shippingName,    setShippingName]    = useState(txn.customer_name  || '');
const [shippingPhone,   setShippingPhone]   = useState(txn.customer_phone || '');
const [shippingAddress, setShippingAddress] = useState('Event Amazing Toy Show Gandaria City');
```

**File:** `ApprovalQueueTab.jsx`

---

## BUG-050-02 — Helper Tidak Bisa Approve Pre-Order: Shipping Form Tidak Muncul (2026-06-17)

**Reporter:** TXN-20260616-00167 — saat klik "Setujui Semua" di page `/helper`, notif: *"Nama penerima wajib diisi untuk Pre-Order."*

### Root Cause

**Penyebab utama:** Transaksi pre-order yang dibuat selama window deployment non-atomik CR-050 mendapatkan `order_type = 'REGULAR'` di DB (nilai default dari migration 029), meskipun item-nya adalah produk pre-order (`products.is_preorder = TRUE`).

Flow yang menyebabkan error:
1. Frontend membaca `txn.order_type` dari `GET /helper/approval-queue`
2. `isPreorder = txn.order_type === 'PREORDER'` → **false** (karena order_type='REGULAR')
3. Modal konfirmasi tampil **tanpa** shipping form
4. User klik "Ya, Setujui" → `shippingFields = null` dikirim ke backend
5. Backend `approveOrder` mendeteksi `order_type='PREORDER'` dari DB (atau item-level) → melempar 422

**Masalah tambahan (gap requirement):**
- Items di approval queue tidak menampilkan label PRE-ORDER per item (Req-1 gap)
- Belum ada tab "Approval Pre-Order" untuk pre-order dengan status PAID (Req-3 gap)
- Query `getApprovalQueue` items tidak mengambil `p.is_preorder` dari tabel `products`

### Fix

**`backend/src/modules/helper/helper.service.js` — `getApprovalQueue`:**

Tambah `p.is_preorder` ke items SELECT, dan auto-correct `order_type` runtime jika ada item pre-order namun `order_type` tercatat 'REGULAR' (handle legacy transactions):
```javascript
// Items query sekarang menyertakan p.is_preorder
SELECT ti.item_id, ..., p.is_preorder, ...

// Setelah fetch items:
if (txn.order_type !== 'PREORDER' && txn.items.some(i => i.is_preorder)) {
  txn.order_type = 'PREORDER'; // runtime correction, frontend akan tampil form shipping
}
```

**`backend/src/modules/helper/helper.service.js` — `approveOrder`:**

Fallback detection dari items jika `order_type` bukan 'PREORDER'. Auto-correct ke DB:
```javascript
if (!isPreorderTxn) {
  const preorderCheck = await client.query(`SELECT EXISTS(...p.is_preorder=TRUE...) AS has_preorder`, ...);
  if (preorderCheck.rows[0].has_preorder) {
    isPreorderTxn = true;
    await client.query(`UPDATE transactions SET order_type = 'PREORDER' WHERE transaction_id = $1`, ...);
  }
}
```

**`frontend/src/components/helper/ApprovalQueueTab.jsx` — `ItemRow`:**

Tambah badge PRE-ORDER pada produk pre-order:
```jsx
{item.is_preorder && (
  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 ...">
    🔖 PRE-ORDER
  </span>
)}
```

**`backend/src/modules/helper/helper.service.js` — `getPreorderPaidOrders` (baru):**

Fungsi baru untuk mengembalikan PAID pre-order transactions beserta shipping details dan items.

**`backend/src/modules/helper/helper.router.js`:**

Route baru `GET /api/v1/helper/preorder-paid`.

**`frontend/src/pages/helper/HelperPage.jsx`:**

Tambah sub-menu "Approval Pre-Order" di seksi Approval sidebar, dengan `PreorderApprovalPanel` yang menampilkan PAID pre-order dengan shipping info dan item list.

### Data Fix untuk TXN-20260616-00167

Jika `order_type` masih 'REGULAR' di DB, auto-correct akan berjalan saat `approveOrder` dipanggil. Namun untuk kejelasan data dapat dijalankan:
```sql
UPDATE transactions
SET order_type = 'PREORDER'
WHERE transaction_id = 'TXN-20260616-00167';
```

### Prevention

Lihat STD-032 (dibuat bersamaan dengan bug ini).

---

## BUG-050-01 — Pre-Order Treatment Bug: SELF_ORDER Bypass (2026-06-17)
**Reporter:** TXN-20260616-00163 (Astro Boy pre-order tidak di-treat sebagai PREORDER)

### Root Cause

Dua bug terpisah menyebabkan produk pre-order tidak ditangani dengan benar di jalur SELF_ORDER:

**Bug A — Tidak ada blokir pre-order di SELF_ORDER mode (`createOrder`)**

`createOrder()` tidak pernah memvalidasi bahwa `is_preorder` items tidak boleh masuk jalur SELF_ORDER. CR-050 mendefinisikan dua sub-fitur:
- Sub-feature A: Helper input order → shipping diisi saat buat order
- Sub-feature B: Customer self-order → hanya lewat HELPER_APPROVE, shipping diisi Helper saat approval

Karena tidak ada guard, customer bisa place order pre-order via SELF_ORDER mode. Hasilnya: transaksi PREORDER tercipta tanpa `shipping_*` fields → order stuck, tidak bisa diproses ke AWAITING_SHIPMENT.

**Bug B — Stock deduction tidak punya guard `is_preorder` di SELF_ORDER mode**

Di `createOrder()` step 8 (insert items), kode deduct stock unconditionally untuk SELF_ORDER mode:
```javascript
// SEBELUM (bug):
if (!isHelperApproveMode) {
  await client.query(`UPDATE products SET stock_quantity - $1 ...`)
}
// Tidak ada check !p.is_preorder — stok pre-order ikut terpotong
```

**Root cause TXN-20260616-00163 spesifik:**
Transaksi kemungkinan besar dibuat saat deployment CR-050 tidak atomik — migration 029 sudah jalan (kolom `is_preorder` ada, Astro Boy di-set is_preorder=true), tapi application code `createOrder` belum ter-deploy, sehingga tidak ada `isPreorderCart` check → `order_type` default ke 'REGULAR' di DB.

### Fix

**`backend/src/modules/orders/orders.service.js`:**

1. Tambah guard pre-order di SELF_ORDER section (sebelum on-hold check):
```javascript
// CR-038 + CR-050: In SELF_ORDER mode, reject on-hold AND pre-order items.
if (!isHelperApproveMode) {
  const preorderItems = items.filter(i => productMap[i.product_id]?.is_preorder);
  if (preorderItems.length > 0) {
    throw new AppError(
      `Produk pre-order tidak bisa dipesan mandiri: ${names}. Silakan minta bantuan Helper.`,
      422, { preorderProductIds: [...] }
    );
  }
  // ... existing on-hold check
}
```

2. Tambah `!p.is_preorder` guard ke stock deduction:
```javascript
if (!isHelperApproveMode && !p.is_preorder) {
  // deduct stock
}
```

**`frontend/src/pages/customer/CartPage.jsx`:**

Tambah frontend guard di `handlePlaceOrder()` untuk SELF_ORDER mode:
```javascript
if (!isApproveMode) {
  const preorderItems = items.filter(i => i.is_preorder);
  if (preorderItems.length > 0) {
    setError(`Produk pre-order tidak bisa dipesan mandiri: ${names}. Hubungi Helper.`);
    return;
  }
}
```

### Data Fix untuk TXN-20260616-00163

Transaksi yang sudah ada perlu diperbaiki manual via DB:
```sql
UPDATE transactions
SET order_type = 'PREORDER'
WHERE transaction_id = 'TXN-20260616-00163';
```
**Catatan:** Setelah fix order_type, shipping fields masih kosong. Helper perlu diinformasikan untuk mengisi via endpoint `PATCH /api/v1/helper/transactions/:txnId/shipping` (atau proses ulang order baru).

### Prevention

Lihat STD-PRE-001 (dibuat bersamaan dengan bug ini).

---

## RC-BulkUpload-01 — Sync Kolom Bulk Upload Produk dengan Schema Terkini (2026-06-17)

**Root Cause:** `bulkUpload.controller.js` dan `ProductBulkUpload.jsx` tidak ikut diperbarui ketika CR-035 menambah `is_on_hold`, `is_display_only`, `max_per_customer`, dan CR-050 menambah `is_preorder`, `preorder_note` ke tabel `products`. INSERT statement hanya mencakup kolom asli, sehingga produk yang ter-upload tidak bisa di-set ke status pre-order atau display-only via bulk upload.

**Dampak:** Tidak ada data corruption (semua kolom baru punya safe default), tapi Admin tidak bisa mass-import produk pre-order.

**Fix — `backend/src/modules/admin/bulkUpload.controller.js`:**
Tambah 5 kolom ke INSERT statement:
```sql
INSERT INTO products
  (..., is_on_hold, is_display_only, max_per_customer, is_preorder, preorder_note)
VALUES (..., $12, $13, $14, $15, $16)
```
Params: `resolveBoolean` untuk 4 boolean field (existing helper), `parseInt || null` untuk `max_per_customer`, string/null untuk `preorder_note`.

**Fix — `frontend/src/pages/admin/ProductBulkUpload.jsx`:**
- `HEADERS` — tambah 5 kolom baru di akhir array
- `FIELD_DESCS` — tambah deskripsi bahasa Indonesia untuk tiap kolom
- `EXAMPLE_ROW` — tambah nilai contoh (semua false/kosong — default aman)
- `parseSheet()` — tambah type coercions: boolean untuk `is_on_hold`, `is_display_only`, `is_preorder`; integer/null untuk `max_per_customer`
- `handleSubmit` payload — sertakan 5 kolom baru

---

## CR-050 — Fitur Pre-Order (Sub-feature A + B) (2026-06-17)
**Linked CR**: CR-050

### Ringkasan

Implementasi sistem Pre-Order end-to-end. Dua sub-fitur:

| | Sub-feature A | Sub-feature B |
|---|---|---|
| **Inisiator order** | Helper/Admin | Customer self-order |
| **Mode** | HELPER_INPUT | HELPER_APPROVE |
| **Alamat kirim** | Diisi Helper saat buat order | Diisi Helper saat approval |
| **Cart campuran** | N/A | Ditolak — wajib all-pre-order |
| **Display-only** | Boleh dijual sebagai pre-order | Tidak muncul di katalog |

**Invariant utama:** Pre-order items **TIDAK PERNAH** mengurangi stok — di `createOrder`, `createHelperOrder`, `approveOrder`, maupun `approveItem`.

### Status Flow

```
PENDING_APPROVAL → PENDING → PAID → AWAITING_SHIPMENT → ARRIVED → PREORDER_HANDOVER → COMPLETED
                                                                  ↑ SHIPPED dihapus dari flow baru
CANCELLED (jika Helper reject)
EXPIRED (jika timer habis setelah PENDING — tidak ada restore stok)
```

SHIPPED tetap ada di status machine untuk backward compat dengan order lama, tapi tidak digunakan di flow baru.

---

### RC-050-01: `status.machine.js` — Hapus SHIPPED dari pre-order flow

**File:** `backend/src/modules/orders/status.machine.js`

**Root Cause:** `AWAITING_SHIPMENT` masih mengarah ke `SHIPPED` (flow lama). CR-050 spec: barang langsung dikonfirmasi tiba tanpa perlu input resi.

**Fix:**
```javascript
// BEFORE:
AWAITING_SHIPMENT: new Set(['SHIPPED']),

// AFTER:
AWAITING_SHIPMENT: new Set(['ARRIVED']),   // CR-050: direct
SHIPPED:           new Set(['ARRIVED']),   // legacy backward compat

// ALLOWED_ACTORS:
ARRIVED: ['ADMIN', 'LEADER'],              // ditambah LEADER
```

---

### RC-050-02: `preorder.service.js` — `confirmArrived` accept AWAITING_SHIPMENT

**File:** `backend/src/modules/preorder/preorder.service.js`

**Root Cause:** `confirmArrived()` memanggil `_fetchPreorderTxn(client, txnId, 'SHIPPED')` — hardcode status SHIPPED. Dengan flow baru, order masuk dari AWAITING_SHIPMENT bukan SHIPPED.

**Fix:** Try AWAITING_SHIPMENT dulu, fallback ke SHIPPED untuk backward compat:
```javascript
let txn;
try {
  txn = await _fetchPreorderTxn(client, txnId, 'AWAITING_SHIPMENT');
} catch (e) {
  if (e.message?.includes('Status transaksi tidak sesuai')) {
    txn = await _fetchPreorderTxn(client, txnId, 'SHIPPED');
  } else throw e;
}
```

---

### RC-050-03: `products.service.js` + `products.router.js` — Toggle Pre-Order

**Files:**
- `backend/src/modules/products/products.service.js`
- `backend/src/modules/products/products.router.js`

**Root Cause:** Tidak ada endpoint untuk Helper mengubah status pre-order produk secara programatik.

**Fix — Service:**
```javascript
async function togglePreorder(productId, isPreorder, preorderNote) {
  const result = await query(
    `UPDATE products SET is_preorder = $1, preorder_note = $2, updated_at = NOW()
     WHERE product_id = $3 RETURNING *`,
    [isPreorder, preorderNote || null, productId],
  );
  if (!result.rows[0]) throw new AppError('Produk tidak ditemukan.', 404);
  return result.rows[0];
}
```

**Fix — Router:** `PATCH /api/v1/products/:productId/preorder` — role: HELPER, LEADER, ADMIN
```javascript
body('is_preorder').isBoolean()
body('preorder_note').optional({ nullable: true }).isString().isLength({ max: 500 })
```

---

### RC-050-04: `orders.service.js` — `createOrder()` pre-order validation

**File:** `backend/src/modules/orders/orders.service.js`

**Root Cause:** `createOrder()` tidak mengenal konsep pre-order: stock check selalu dijalankan, tidak ada `order_type` di INSERT, tidak ada validasi mixed cart.

**Fix (4 perubahan):**

1. Tambah `is_preorder` ke product SELECT
2. Mixed cart validation di HELPER_APPROVE mode:
```javascript
if (isHelperApproveMode) {
  const preorderItems = items.filter(i => productMap[i.product_id]?.is_preorder);
  if (preorderItems.length > 0 && preorderItems.length !== items.length) {
    throw new AppError('Pre-Order tidak bisa digabung dengan produk reguler. Buat order terpisah.', 422);
  }
}
```
3. Skip stock check untuk pre-order items:
```javascript
for (const item of items) {
  const p = productMap[item.product_id];
  if (p.is_preorder) continue;  // never deduct stock
  if (p.stock_status === 'OUT_OF_STOCK' || p.stock_quantity < item.quantity) { ... }
}
```
4. Tambah `order_type` ke INSERT transactions:
```javascript
const orderType = isPreorderCart ? 'PREORDER' : 'REGULAR';
// INSERT: (... order_type ...) VALUES (... $4 ...)
```

---

### RC-050-05: `helper.service.js` + `helper.router.js` — Pre-order exemptions

**Files:**
- `backend/src/modules/helper/helper.service.js`
- `backend/src/modules/helper/helper.router.js`

**Root Cause:** Helper service tidak memiliki exemption untuk pre-order: display-only item diblokir, stok selalu dicek/dipotong, `approveOrder` tidak mengenal PREORDER order type.

**Fix (6 perubahan):**

**A. `createHelperOrder()` — allow display-only if pre-order:**
```javascript
// BEFORE:
if (p.is_display_only) throw new AppError(...)

// AFTER:
if (p.is_display_only && !p.is_preorder) throw new AppError(...)
```

**B. `createHelperOrder()` — skip stock check for pre-order:**
```javascript
for (const item of items) {
  const p = productMap[item.product_id];
  if (p.is_preorder) continue;
  if (p.stock_quantity < item.qty) throw new AppError(...)
}
```

**C. `createHelperOrder()` — skip stock deduction for pre-order:**
```javascript
if (!p.is_preorder) {
  await client.query(`UPDATE products SET stock_quantity = stock_quantity - $1 ...`, [...])
}
```

**D. `getApprovalQueue()` — tambah `t.order_type` ke SELECT & GROUP BY**

**E. `approveOrder()` — new signature + PREORDER branch:**
```javascript
async function approveOrder(transactionId, helperId, helperTenantId, note = null, shippingFields = null)

// Di dalam:
const isPreorderTxn = txn.order_type === 'PREORDER';
if (isPreorderTxn) {
  // Validasi shipping fields wajib
  // Skip stock check + deduction
  // Simpan shipping_* ke transactions saat UPDATE
}
```

**F. `approveItem()` — skip stock deduction if pre-order:**
```javascript
const prodRes = await client.query(
  `SELECT product_name, stock_quantity, is_preorder FROM products WHERE product_id = $1 FOR UPDATE`, [...]
);
if (prod?.is_preorder) {
  // skip check & deduction
} else {
  if (!prod || prod.stock_quantity < effectiveQty) throw new AppError(...)
  await client.query(`UPDATE products SET stock_quantity = stock_quantity - $1 ...`, [...])
}
```

**helper.router.js — approve endpoint:** Tambah body validators untuk 5 shipping fields (`shipping_name`, `shipping_phone`, `shipping_address`, `shipping_city`, `shipping_province`) dan pass ke service.

---

### RC-050-06: `wa.service.js` — WA pre-order baru

**File:** `backend/src/modules/wa/wa.service.js`

**Root Cause:** Dua template WA belum ada: `sendPreorderCancelled` dan `sendPreorderExpired`.

**Fix:** Tambah dua fungsi baru dengan pola yang sama (check DISABLED, call `_callGateway`, fire-and-forget safe):
- `sendPreorderCancelled(phone, customerName)` — kirim saat Helper reject pre-order
- `sendPreorderExpired(phone, customerName)` — kirim saat PENDING pre-order expire

---

### RC-050-07: `TxnExpireJob.js` — WA notification untuk expired pre-order

**File:** `backend/src/modules/scheduler/jobs/TxnExpireJob.js`

**Root Cause:** Step 2 (sweep PENDING) tidak membedakan REGULAR vs PREORDER — tidak ada notifikasi WA dan komentar "no stock restore" tidak akurat untuk pre-order (pre-order memang tidak pernah deduct stok).

**Fix:** Ubah RETURNING clause di Step 2 agar include `order_type` + customer contact, lalu fire-and-forget WA:
```javascript
RETURNING t.transaction_id, t.order_type,
  t.customer_phone,
  (SELECT c.phone_number FROM customers c WHERE c.customer_id = t.customer_id) AS reg_phone,
  (SELECT c.full_name FROM customers c WHERE c.customer_id = t.customer_id) AS customer_name

// Setelah audit log:
if (row.order_type === 'PREORDER') {
  const phone = row.reg_phone || row.customer_phone;
  if (phone) waSvc.sendPreorderExpired(phone, row.customer_name || 'Customer')
    .catch(err => logger.warn(...));
}
```

---

### RC-050-08: `ApprovalQueueTab.jsx` — PRE-ORDER badge + shipping form

**File:** `frontend/src/components/helper/ApprovalQueueTab.jsx`

**Root Cause:** Approval card tidak membedakan order pre-order vs reguler. Helper tidak memiliki form untuk mengisi alamat pengiriman saat approval Sub-feature B.

**Fix:**
1. PRE-ORDER badge di header card jika `txn.order_type === 'PREORDER'`
2. Header background orange tint untuk pre-order cards
3. Shipping form (5 field) di dalam modal "Setujui Semua" jika pre-order
4. Tombol Ya simpan disabled sampai 3 field wajib (name, phone, address) terisi
5. `handleApproveAll(txnId, shippingFields)` — pass shipping fields ke `approveOrder(txnId, null, shippingFields)`
6. `api/helper.js` — update signature `approveOrder(txnId, note, shippingFields)`

---

### RC-050-09: `CartPage.jsx` + `CartContext.jsx` — Mixed cart validation + badge

**Files:**
- `frontend/src/pages/customer/CartPage.jsx`
- `frontend/src/context/CartContext.jsx`

**Root Cause:** Cart tidak menyimpan `is_preorder` di item, sehingga frontend tidak bisa memvalidasi mixed cart atau menampilkan badge pre-order.

**Fix:**

**CartContext.jsx:** Tambah `is_preorder: product.is_preorder || false` saat `addItem()`.

**CartPage.jsx:**
1. Mixed cart validation sebelum checkout (HELPER_APPROVE mode only):
```javascript
if (isApproveMode) {
  const preorderItems = items.filter(i => i.is_preorder);
  if (preorderItems.length > 0 && preorderItems.length !== items.length) {
    setError('Pre-Order tidak bisa digabung dengan produk reguler. Buat order terpisah.');
    return;
  }
}
```
2. PRE-ORDER badge (🔖 PRE-ORDER) di sebelah nama item jika `item.is_preorder`

---

### RC-050-10: `OrderTrackingPage.jsx` — Pre-order stepper tanpa SHIPPED

**File:** `frontend/src/pages/customer/OrderTrackingPage.jsx`

**Root Cause:** Pre-order stepper menyertakan step SHIPPED. Dengan flow CR-050, AWAITING_SHIPMENT → ARRIVED langsung — order yang belum pernah masuk SHIPPED akan salah menampilkan SHIPPED sebagai "done".

**Fix:** Tampilkan SHIPPED step hanya untuk order lama yang memang pernah masuk status SHIPPED:
```javascript
const usesShippedFlow = order.status === 'SHIPPED' || !!order.shipped_at;
const PREORDER_STEPS = [
  { key: 'PAID',             label: 'Pembayaran',     icon: '💳' },
  { key: 'AWAITING_SHIPMENT',label: 'Menunggu Kirim', icon: '📦' },
  ...(usesShippedFlow ? [{ key: 'SHIPPED', label: 'Dalam Pengiriman', icon: '🚚' }] : []),
  { key: 'ARRIVED',          label: 'Barang Sampai',  icon: '📍' },
  { key: 'PREORDER_HANDOVER',label: 'Serah Terima',   icon: '🤝' },
  { key: 'COMPLETED',        label: 'Selesai',        icon: '✅' },
];
```

---

### RC-050-11: `ProductPreorderTogglePage.jsx` (halaman baru)

**File:** `frontend/src/pages/helper/ProductPreorderTogglePage.jsx` *(baru)*

**Root Cause:** Tidak ada UI untuk Helper mengubah status pre-order produk tanpa harus masuk ke Admin panel.

**Fix:** Halaman baru di `/helper/products/preorder`:
- List semua produk booth dengan toggle `is_preorder`
- Input field `preorder_note` muncul saat toggle ON
- Badge PRE-ORDER pada item aktif
- Tombol Simpan muncul hanya saat ada perubahan (dirty state)
- Memanggil `PATCH /api/v1/products/:productId/preorder`

**Registrasi:**
- `frontend/src/App.jsx` — import + route `/helper/products/preorder`
- `frontend/src/pages/helper/HelperPage.jsx` — nav entry "🔖 Pre-Order Produk"
- `frontend/src/api/products.js` — tambah `toggleProductPreorder(productId, isPreorder, preorderNote)`

---

### RC-050-12: `PreorderShipmentPage.jsx` — Hapus tab SHIPPED, direct confirmArrived

**File:** `frontend/src/pages/admin/PreorderShipmentPage.jsx`

**Root Cause:** Page masih menampilkan tab "Dalam Pengiriman" (SHIPPED) dan memaksa admin input resi sebelum konfirmasi tiba. Dengan flow CR-050, resi tidak diperlukan.

**Fix:**
1. Hapus `{ key: 'shipped', ... }` dari `STATUS_TABS`
2. Ganti aksi tab `awaiting` dari "📦 Input Resi & Kirim" menjadi "✅ Konfirmasi Barang Sudah Sampai" yang langsung trigger `confirmArrived`

### Prevention
- STD-XXX (baru): Pre-order items tidak boleh mengurangi stok di layer manapun. Setiap fungsi yang handle `transaction_items` harus cek `is_preorder` sebelum `UPDATE products SET stock_quantity - $1`.
- Mixed cart validation wajib ada di backend (orders.service) DAN frontend (CartPage) — keduanya independen sebagai defense in depth.

---

## FEAT-002 — Tampilkan Status Pre-Order di Halaman /product/:id (2026-06-16)
**Linked CR**: CR-FEAT-002

#### RC-23: `MockProductDetailPage.jsx` belum memiliki UI untuk status pre-order

**Root Cause:**
- `getProductById()` di `products.service.js` menggunakan `SELECT p.*` — semua kolom otomatis tersedia termasuk `is_preorder` dan `preorder_note`
- Tidak ada bug di backend — data sudah ada di response API
- Hanya UI di `MockProductDetailPage.jsx` yang belum menampilkan indikator pre-order

### Fix Applied — RC-23

**File:** `frontend/src/pages/customer/MockProductDetailPage.jsx`

```javascript
// Tambah computed vars setelah stockBadge
const isPreorder = !!product.is_preorder;
const preorderNote = product.preorder_note || null;
```

**Perubahan UI (3 lokasi):**

1. **Hero overlay badge** — bottom-left gambar produk:
```jsx
{isPreorder && (
  <span style={{
    position: 'absolute', bottom: 14, left: 14,
    fontSize: 11, fontWeight: 800, letterSpacing: '0.8px',
    padding: '4px 12px', borderRadius: 20,
    background: 'rgba(234,88,12,0.92)', color: '#fff',
    backdropFilter: 'blur(6px)',
    boxShadow: '0 2px 8px rgba(234,88,12,0.35)',
  }}>
    PRE-ORDER
  </span>
)}
```

2. **Status badge row** — menggantikan badge stok saat `isPreorder = true`:
```jsx
{isPreorder ? (
  <span style={{
    fontSize: 10.5, fontWeight: 700, padding: '3px 12px', borderRadius: 20,
    background: 'rgba(255,237,213,0.90)', color: '#C2410C',
    border: '1px solid rgba(234,88,12,0.18)',
  }}>Pre-Order</span>
) : (
  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 12px', borderRadius: 20, ...stockBadge }}>
    {t(stockKey)}
  </span>
)}
```

3. **Info box Pre-Order** — antara price dan spec strip:
```jsx
{isPreorder && (
  <div style={{
    background: 'linear-gradient(135deg, rgba(255,237,213,0.80) 0%, rgba(254,215,170,0.60) 100%)',
    border: '1px solid rgba(234,88,12,0.20)',
    borderRadius: 14, padding: '12px 14px',
    display: 'flex', gap: 10, alignItems: 'flex-start',
  }}>
    <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>🔖</span>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#9A3412' }}>Produk Pre-Order</span>
      {preorderNote && (
        <span style={{ fontSize: 12, color: '#C2410C', lineHeight: 1.5 }}>{preorderNote}</span>
      )}
      <span style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
        Pembayaran dilakukan sekarang. Barang dikirim/diambil sesuai estimasi.
      </span>
    </div>
  </div>
)}
```

**Backend tidak perlu diubah** — `getProductById` dan `getProductByBarcode` keduanya pakai `SELECT p.*` sehingga semua kolom baru dari migration otomatis tersedia.

### Prevention
- Lihat STD-030 — untuk halaman detail, pastikan SELECT menggunakan `p.*` atau RETURNING `*` agar kolom baru dari migration otomatis masuk
- Bandingkan: `MockProductDetailPage` (SELECT p.*) vs `adminListProducts` (SELECT eksplisit) — pola SELECT p.* lebih aman untuk evolusi schema

---

## FEAT-001 — Tampilkan Status Pre-Order di Halaman /katalog (2026-06-16)
**Linked CR**: CR-FEAT-001

#### RC-22: Public products API tidak mengembalikan `is_preorder`/`preorder_note` — badge tidak muncul

**Root Cause:**
- `ProductCard.jsx` sudah memiliki UI lengkap untuk pre-order (overlay badge + label bawah + preorder_note)
- `products.service.js` `getProducts()` menggunakan SELECT eksplisit yang tidak menyertakan `p.is_preorder` dan `p.preorder_note`
- Frontend menerima `product.is_preorder = undefined` → badge tidak render (kondisi falsy)
- Pattern sama dengan BUG-011 / RC-21

**Tidak ada bug di frontend** — `ProductCard` sudah siap, hanya data yang tidak mengalir.

### Fix Applied — RC-22

**File 1:** `backend/src/modules/products/products.service.js` — `getProducts()` SELECT

```javascript
// Sebelum fix
SELECT p.product_id, ..., p.is_on_hold, p.is_display_only, p.max_per_customer,
       t.tenant_id, t.tenant_name, ...

// Setelah fix — tambah is_preorder dan preorder_note
SELECT p.product_id, ..., p.is_on_hold, p.is_display_only, p.max_per_customer,
       p.is_preorder, p.preorder_note,
       t.tenant_id, t.tenant_name, ...
```

**File 2:** `frontend/src/pages/customer/BrowsePage.jsx` — tambah filter chip Pre-Order

```jsx
// State lokal
const [preorderOnly, setPreorderOnly] = useState(false);

// Computed
const hasPreorderProducts = products.some(p => p.is_preorder);
const displayProducts = preorderOnly
  ? productModeProducts.filter(p => p.is_preorder)
  : productModeProducts;

// Chip (hanya tampil jika ada produk pre-order di katalog)
{hasPreorderProducts && (
  <button onClick={() => setPreorderOnly(v => !v)}
    style={preorderOnly ? ACTIVE_ORANGE_STYLE : DEFAULT_ORANGE_STYLE}>
    🔖 Pre-Order
  </button>
)}

// Section header: count dari displayProducts
{t('browse.items', { count: displayProducts.length })}

// ProductGrid: pakai displayProducts
<ProductGrid products={displayProducts} />
```

**Behavior filter chip:**
- Chip hanya muncul jika minimal 1 produk di katalog berstatus `is_preorder = true`
- Chip bisa di-stack dengan category filter: "Action Figure" + "Pre-Order" = pre-order Action Figures
- Judul section berubah ke "Pre-Order" saat chip aktif
- Count produk update real-time sesuai filter aktif

**Tampilan `ProductCard` saat is_preorder = true:**
- Overlay badge "PRE-ORDER" (orange) pojok kiri atas gambar
- `preorder_note` (teks 10px orange) di bawah nama produk
- Badge "Pre-Order" (orange pastel) menggantikan badge stok (Tersedia/Terbatas/Habis)
- Tombol "Tambah ke Keranjang" tetap muncul (pre-order tetap bisa dibeli)

### Prevention
- Lihat STD-030 — setiap `ADD COLUMN` migration wajib diikuti review SELECT eksplisit di semua query untuk tabel yang sama
- `products.service.js` dan `admin.service.js` keduanya punya SELECT eksplisit terpisah untuk tabel `products` — keduanya harus diupdate bersamaan saat ada kolom baru

---

## BUG-011 — Toggle Pre-Order Reset ke OFF Setiap Keluar Aplikasi (2026-06-16)
**Linked CR**: CR-BUG-011

#### RC-21: `adminListProducts()` tidak include `is_preorder` dan `preorder_note` di SELECT

**Root Cause:**
- `adminCreateProduct()` dan `adminUpdateProduct()` menggunakan `RETURNING *` → mengembalikan semua kolom termasuk `is_preorder`
- `adminListProducts()` menggunakan SELECT eksplisit — dan kolom `p.is_preorder`, `p.preorder_note` tidak tercantum (line 136-139 di `admin.service.js`)
- Frontend `openEdit(p)` mengisi form dari data produk di list: `is_preorder: p.is_preorder ?? false`
- Karena `p.is_preorder` = `undefined` (tidak ada di response), ekspresi `undefined ?? false` = `false` → toggle selalu OFF

**Alur yang salah:**
```
Admin klik Edit → openEdit(p) → p dari listProducts response
                                 → p.is_preorder = undefined (tidak di SELECT)
                                 → form.is_preorder = false   ← BUG
```

**Bukti DB benar, response salah:**
```sql
SELECT product_id, barcode, is_preorder, preorder_note FROM products WHERE barcode = 'TZKH-020B';
-- product_id | barcode   | is_preorder | preorder_note
-- P0001-001  | TZKH-020B | t           | Estimasi kedatangan agustus 2026
```
Data DB sudah `true` — tapi API response tidak mengembalikan kolom ini.

### Fix Applied — RC-21

**File:** `backend/src/modules/admin/admin.service.js` — `adminListProducts()` SELECT query

```javascript
// Sebelum fix — kolom is_preorder tidak ada
SELECT p.product_id, p.product_name, p.category, p.price,
       p.stock_quantity, p.stock_status, p.image_url, p.description,
       p.barcode, p.odoo_categ_id, p.is_active, p.created_at, p.updated_at,
       t.tenant_id, t.tenant_name, t.booth_location

// Setelah fix — tambah is_preorder dan preorder_note
SELECT p.product_id, p.product_name, p.category, p.price,
       p.stock_quantity, p.stock_status, p.image_url, p.description,
       p.barcode, p.odoo_categ_id, p.is_active, p.created_at, p.updated_at,
       p.is_preorder, p.preorder_note,
       t.tenant_id, t.tenant_name, t.booth_location
```

Tidak ada perubahan lain yang diperlukan — frontend sudah handle `p.is_preorder ?? false` dan `p.preorder_note || ''` dengan benar.

### Prevention
- **SELECT eksplisit harus disinkronkan setiap kali ada kolom baru**: setiap kali migration menambahkan kolom ke tabel yang sudah punya SELECT eksplisit di list query, kolom tersebut WAJIB ditambahkan ke SELECT yang sama.
- **Pattern `RETURNING *` vs SELECT eksplisit**: `RETURNING *` pada create/update otomatis include kolom baru, tapi SELECT list query TIDAK. Ini perbedaan yang mudah terlewat.
- **Checklist migrasi kolom baru**: lihat STD-030 di standard.md.

---

## BUG-001 — Odoo Integration Tidak Aktif (2026-06-16)
**Linked CR**: CR-BUG-001

### Root Causes (4 issues)

#### RC-1: `POST /admin/odoo/config` tidak set `odoo_is_active: true`
- Setelah user selesai wizard (Verify → pilih company → "Simpan Koneksi"), `odoo_is_active` tetap `false`
- User harus toggle manual + klik "Simpan" lagi — tidak intuitif
- **File**: `backend/src/modules/admin/admin.router.js` line ~315

#### RC-2: Trailing slash di `odoo_base_url` membuat URL double-slash
- User input: `https://demo-260614a.odoo.com/` (dengan trailing slash)
- URL yang dibangun: `https://demo-260614a.odoo.com//web/session/authenticate` → bisa gagal di beberapa konfigurasi server
- **File**: `admin.service.js` (`_connectOdoo`), `StockSyncService.js` (`_loadOdooConfig`), `verifyOdooConnection`

#### RC-3: `ProductSyncJob` & `StockSyncJob` tidak cek `odoo_is_active`
- Job scheduler jalan setiap interval terlepas dari apakah Odoo aktif atau tidak
- Hasilkan error log terus-menerus: "Odoo credentials not configured"
- Membingungkan: `odoo_is_active` toggle di UI tidak punya efek nyata pada job
- **File**: `backend/src/modules/scheduler/jobs/ProductSyncJob.js`, `StockSyncJob.js`

#### RC-4: `handleOdooSave` di frontend tidak update state dari response
- Setelah "Simpan Koneksi & Company" sukses, UI tidak menampilkan `odoo_is_active: true` terbaru
- User harus reload halaman untuk melihat perubahan status
- **File**: `frontend/src/pages/admin/tabs/IntegrationTab.jsx` fungsi `handleOdooSave`

### Fixes Applied

| Fix | File | Perubahan |
|-----|------|-----------|
| RC-1 | `admin.router.js` | Tambah `odoo_is_active: true` ke `saveIntegrationConfig` di `POST /admin/odoo/config` |
| RC-2 | `admin.service.js` | `.replace(/\/+$/, '')` pada `baseUrl` di `_connectOdoo` dan `verifyOdooConnection` |
| RC-2 | `StockSyncService.js` | `.replace(/\/+$/, '')` pada `baseUrl` di `_loadOdooConfig` |
| RC-3 | `ProductSyncJob.js` | Cek `cfg.odoo_is_active` sebelum memanggil `syncOdooProducts`; return `skipped` jika false |
| RC-3 | `StockSyncJob.js` | Cek `cfg.odoo_is_active` sebelum membuat `StockSyncService`; return `skipped` jika false |
| RC-4 | `IntegrationTab.jsx` | `handleOdooSave` sekarang `setConfig(r.data.data)` setelah response sukses |

### Cara Penggunaan Setelah Fix

Alur yang benar di Admin → Integrasi → Integration with Odoo:
1. Isi **Odoo Base URL** (tanpa atau dengan trailing slash — otomatis dibersihkan)
2. Isi **Database Name**
3. Isi **Login Username** dan **Password**
4. Klik **🔍 Verify Connection** → tunggu konfirmasi
5. Pilih **Company** dari dropdown
6. Klik **💾 Simpan Koneksi & Company**
   → Setelah ini, `odoo_is_active` otomatis `true`, badge berubah "● Aktif"
7. Klik **Simpan** (tombol bawah) untuk menyimpan field lain (walk-in partner ID, dll.)

#### RC-5: `.env` dan `integration/.env` masih menunjuk ke Odoo instance LAMA
- `hybrid_integration` adalah **container terpisah** yang membaca Odoo credentials **hanya dari env vars**, bukan dari DB `system_settings`
- Ketika admin mengubah config di UI (tersimpan ke DB), `hybrid_integration` tetap terhubung ke instance lama `edu-student4.odoo.com`
- **File**: `.env` (root), `integration/.env`
- **Fix**: Update kedua file ke credentials `demo-260614a.odoo.com` dan restart container `hybrid_integration`
- **Konfirmasi**: Log `hybrid_integration` menunjukkan `"ODOO_DB":"demo-260614a"` dan `Odoo: authenticated uid=26`

#### RC-6: `hybrid_integration` tidak reload config saat admin save — session Odoo stale
- `loadConfigFromDB()` di `integration/src/app.js` dipanggil **sekali saat startup** saja; `env` object tidak pernah diupdate lagi
- `_sessionId` di `odoo.client.js` di-cache di memori; `authenticate()` (yang memanggil `loadCredentials()` untuk baca DB fresh) hanya dipanggil saat session null/invalid
- Akibat: saat admin simpan URL/DB/password baru via UI → DB terupdate → tapi `hybrid_integration` tetap pakai session dan credentials lama sampai restart
- **Fix**: 
  - `integration/src/routes/sync.router.js`: Tambah `POST /sync/reload-config` (dilindungi `requireSecret`) yang memanggil `odoo.invalidateSession()` → memaksa re-auth dengan baca DB fresh saat Odoo call berikutnya
  - `backend/src/modules/admin/admin.router.js`: Tambah helper `_notifyIntegrationReload()` yang fire-and-forget POST ke `${INTEGRATION_WEBHOOK_URL}/sync/reload-config`; dipanggil setelah `POST /admin/odoo/config` dan `PUT /admin/integration` berhasil menyimpan

### Prevention
- Jangan pernah split `odoo_is_active` dari flow save koneksi — aktivasi harus atomik dengan save credentials
- Setiap job scheduler yang bergantung pada service eksternal HARUS cek flag aktif sebelum run
- Response dari save endpoint HARUS langsung di-apply ke state UI (tidak hanya toast)
- Saat admin menyimpan Odoo config baru, backend **wajib** notify `hybrid_integration` via `/sync/reload-config` agar session lama langsung dibuang — tanpa ini integration tetap pakai credentials lama sampai restart
- `hybrid_integration` sekarang: `loadConfigFromDB()` di startup untuk `env`, tapi `loadCredentials()` di `odoo.client.js` baca DB fresh di setiap `authenticate()` — sehingga invalidate session cukup untuk force re-auth dengan config terbaru

#### RC-7: `integration/.env` menunjuk ke DB yang berbeda (`amazing_toys_sos`) dari DB yang dipakai backend (`amazing_toys_hybrid`)
- Docker Compose menetapkan `XREF_DB_URL=...amazing_toys_hybrid` untuk `hybrid_integration` container (override `.env`)
- Tapi `integration/.env` masih berisi `XREF_DB_URL=...amazing_toys_sos` — DB lama yang tidak pernah diupdate admin UI
- Saat `node src/app.js` dijalankan **lokal** (bukan via Docker), file `.env` dipakai langsung → baca DB yang salah → tampil config Odoo lama `edu-student4`
- **File**: `integration/.env`
- **Fix**: Ganti `amazing_toys_sos` → `amazing_toys_hybrid` di `XREF_DB_URL`

---

#### RC-8: `odoo.client.js` `loadCredentials()` baca DB langsung — DB masih punya config `edu-student4`
- `loadCredentials()` di `odoo.client.js` (line 25-47) baca dari `system_settings` WHERE key='integration_config' **setiap kali** `authenticate()` dipanggil
- DB (`amazing_toys_hybrid`) masih berisi config `edu-student4.odoo.com` karena sebelumnya admin hanya update file `.env`, bukan save via Admin UI
- Ketika integration service push TXN ke Odoo → auth ke `edu-student4.odoo.com` (bukan `demo-260614a`) → auth gagal (password berbeda) → masuk retry queue
- Polling loop setiap 60 detik terus retry, tapi selalu gagal (DB masih salah)
- **File**: tidak ada perubahan code — ini murni data issue

### Fixes Applied

| Fix | Tipe | Keterangan |
|-----|------|-----------|
| RC-8 (data) | Operasional | Admin wajib save credentials `demo-260614a` via Admin UI → `/admin` → Integrasi → Integration with Odoo → Verify → Pilih company → Simpan Koneksi |
| RC-8 (deploy) | Ops | `docker compose build --no-cache backend integration && docker compose up -d` untuk deploy perubahan RC-6 (reload-config endpoint) |

#### RC-9: `_doPushOrder` tidak handle stale `inFlight=true` dengan `odoo_id=null`
- Ketika push gagal setelah `upsertXref(null, {inFlight: true})` (mis: SOS/Odoo timeout), xref tersisa dengan `inFlight=true` dan `odoo_id=null`
- Polling berikutnya melihat `existing.sync_metadata.inFlight=true`, cek age: jika age > 60s → TIDAK masuk `age < 60s` block → fall-through ke "duplicate event discarded" dengan return `{success: true, odoo_id: null}`
- Order tidak pernah di-push ulang meski tidak ada di Odoo
- **File**: `integration/src/services/order.push.js` baris 154-160
- **Fix**: Setelah `age >= 60s` AND `!existing.odoo_id` → `deleteXref` + `return _doPushOrder(transactionId)` (fresh retry)

### Recovery TXN-20260616-00139

Setelah admin save credentials baru via UI:
1. DB diupdate dengan `demo-260614a` credentials
2. `_notifyIntegrationReload()` dipanggil → `/sync/reload-config` → `odoo.invalidateSession()` → `_sessionId = null`
3. Polling loop (interval 60 detik) menemukan TXN-20260616-00139 masih `odoo_id = null` di `integration_xref`
4. Memanggil `pushOrder('TXN-20260616-00139')` → `loadCredentials()` baca DB fresh → `demo-260614a` → auth sukses → order dibuat di Odoo ✓

### Prevention
- **PENTING**: Setiap ganti Odoo instance, admin WAJIB save via Admin UI (bukan hanya edit `.env`). `loadCredentials()` SELALU prioritaskan DB di atas `.env`.
- `.env` hanya dipakai sebagai fallback saat DB belum punya config sama sekali
- Polling loop di integration service (setiap 60 detik) berfungsi sebagai safety net untuk transaksi PAID yang belum ada odoo_id — recovery otomatis setelah credentials diperbaiki

---

## BUG-004 — Customer & Sales Person Tidak Sesuai di Odoo (2026-06-16)
**Linked CR**: CR-BUG-004

#### RC-10: `customer.sync.js` phone/email lookup tidak skip company partners
- Step 2 (phone) dan Step 3 (email) di `resolveOrCreatePartner` tidak membedakan antara individual partner dan company partner / contact-of-company
- Phone `081180003939` terdaftar sebagai contact "Roy" dari company "ST CORP" (is_company=False, parent_id=<ST CORP id>)
- Step 2 menemukan partner ini, update nama-nya jadi nama SOS customer ("Roy") — tapi partner_id yang dikembalikan adalah contact "ST CORP", bukan individual "Roy"
- Odoo menampilkan "ST CORP" di Sale Order karena partner_id mengarah ke contact tersebut
- **File**: `integration/src/services/customer.sync.js` step 2 & 3
- **Fix**:
  - Tambah field `is_company` dan `parent_id` ke searchRead di step 2 dan step 3
  - Filter dengan `.find(p => !p.is_company && !p.parent_id)` — hanya match individual partner (bukan company, bukan contact-of-company)
  - Jika tidak ada individual match → lanjut ke step berikutnya (eventually create new partner di step 4)

#### RC-11: `order.push.js` tidak set `user_id` di `orderVals`
- Ketika `user_id` tidak di-set di `sale.order` create payload, Odoo otomatis assign authenticated API user sebagai salesperson
- API user adalah `aristya.rahadiyan@clavis.co.id` (uid=26) → ditampilkan sebagai "Aris" di Sale Order
- **Fix**: Tambah field `odoo_default_salesperson_id` (integer, opsional) ke:
  1. `DEFAULT_INTEGRATION_CONFIG` di `admin.service.js` — supaya field tersimpan ke DB
  2. `loadCredentials()` di `odoo.client.js` — baca dari DB, return sebagai `defaultSalespersonId`
  3. `resolveStartupRefs()` di `odoo.client.js` — cache ke `_cache.defaultSalespersonId`
  4. `order.push.js` — jika `cache.defaultSalespersonId` ada, set `orderVals.user_id = cache.defaultSalespersonId`
  5. Admin UI `IntegrationTab.jsx` — tambah section "Default Sales Person" dengan numeric input

### Cara Penggunaan Setelah Fix

1. Admin → Integrasi → Integration with Odoo → section "Default Sales Person"
2. Isi **Default Salesperson User ID** dengan ID integer `res.users` dari Odoo
   - Cara cek: Odoo → Pengaturan → Pengguna → pilih user → lihat ID di URL
3. Klik **Simpan** di bagian bawah
4. Integration service akan pakai `user_id` ini di setiap Sale Order yang baru dibuat

### Prevention
- Setiap phone/email lookup di `resolveOrCreatePartner` HARUS selalu fetch `is_company` dan `parent_id` dan skip non-individual partners
- `orderVals.user_id` harus selalu di-set secara eksplisit — jangan rely pada Odoo default (API user)

---

## BUG-005 — Total Odoo Salah: Tax Anomali (2026-06-16)
**Linked CR**: CR-BUG-005

#### RC-12: `order.push.js` tidak set `tax_id` → Odoo pakai default tax produk (`price_include=True`)

**Root Cause:**
- `order.push.js` tidak pernah menyertakan field `tax_id` pada order line yang dikirim ke Odoo
- Odoo otomatis menggunakan **default tax dari product template** masing-masing produk
- Default tax PPN 11% di Odoo dikonfigurasi sebagai **`price_include = True`** (harga sudah termasuk pajak)
- Akibatnya: `price_unit = 1,000,000` (DPP/sebelum pajak dari SOS) → Odoo back-calculate: `1,000,000 ÷ 1.11 = 900,901` sebagai subtotal, dan `amount_total = 1,000,000` (bukan 1,110,000)

**Bukti matematis:**
```
900,900 = 1,000,000 ÷ 1.11   ← tanda pasti price_include=True
```

**File**: `integration/src/services/order.push.js` baris 276–282

### Fixes Applied

| Fix | File | Perubahan |
|-----|------|-----------|
| RC-12 (code) | `order.push.js` | Setiap order line sekarang set `tax_id` eksplisit: `[[6, 0, [cache.defaultTaxId]]]` jika dikonfigurasi, atau `[[6, 0, []]]` (tax-free) jika tidak — tidak pernah inherit default produk |
| RC-12 (config) | `admin.service.js` | Tambah `odoo_default_tax_id: null` ke `DEFAULT_INTEGRATION_CONFIG` |
| RC-12 (client) | `odoo.client.js` | `loadCredentials()` baca `odoo_default_tax_id` dari DB; `resolveStartupRefs()` cache ke `_cache.defaultTaxId` |
| RC-12 (UI) | `IntegrationTab.jsx` | Tambah section "Default Tax (PPN)" dengan input ID integer `account.tax` |

### Cara Penggunaan Setelah Fix

1. Di Odoo: **Accounting → Configuration → Taxes** → cari "PPN 11%"
   - Catat ID-nya dari URL (contoh: `?id=3` → ID = 3)
   - Konfigurasi tax boleh tetap **Tax Included in Price** (policy client) — integration akan handle gross-up otomatis
2. Admin → Integrasi → Integration with Odoo → section **"Default Tax (PPN)"**
3. Isi **Default Tax ID** dengan integer ID dari langkah 1
4. Klik **Simpan**
5. Restart/reload `hybrid_integration` agar config baru terbaca

### Hasil Setelah Fix

**Skenario A — Tax Excluded (`price_include = False`):**
```
SOS unit_price = 1,000,000 (DPP)
→ dikirim ke Odoo price_unit = 1,000,000 (tidak diubah)
→ price_subtotal = 1,000,000  ✓
→ price_tax      = 110,000    ✓
→ amount_total   = 1,110,000  ✓
```

**Skenario B — Tax Included (`price_include = True`, policy client):**
```
SOS unit_price = 1,000,000 (DPP)
→ gross-up: 1,000,000 × 1.11 = 1,110,000
→ dikirim ke Odoo price_unit = 1,110,000
→ Odoo back-calc: 1,110,000 ÷ 1.11 = 1,000,000 (DPP)  ✓
→ price_subtotal = 1,000,000  ✓
→ price_tax      = 110,000    ✓
→ amount_total   = 1,110,000  ✓
```

### Prevention
- Setiap order line HARUS set `tax_id` eksplisit — jangan inherit default produk
- Jika `odoo_default_tax_id` tidak dikonfigurasi, kirim `[[6, 0, []]]` (explicit no-tax)
- Saat startup, `resolveStartupRefs()` fetch `price_include` dan `amount` dari Odoo — gross-up dilakukan otomatis tanpa konfigurasi manual tax rate
- Gross-up hanya aktif jika: `defaultTaxId` ada AND `defaultTaxPriceInclude = true` AND `defaultTaxRate` berhasil di-resolve

---

## BUG-006 — Helper Page Harga Pre-Tax & PPN Hardcode (2026-06-16)
**Linked CR**: CR-BUG-006

#### RC-13: `MembuatOrderPanel` tidak gunakan `usePublicConfig` — harga pre-tax, PPN hardcode
- `HelperPage.jsx` impor `useAppLogo` tapi tidak impor `usePublicConfig` dari file yang sama (`../../hooks/useAppLogo`)
- `MembuatOrderPanel` menggunakan `Math.round(subtotal * 0.12)` → PPN hardcode 12%, tidak membaca `ppn_rate` dari admin config
- Harga produk di list: `{formatRupiah(p.price)}` → pre-tax, tidak konsisten dengan halaman lain yang menampilkan harga tax-inclusive
- Cart summary per-item: `{formatRupiah((i.price || 0) * i.qty)}` → pre-tax
- Label "PPN ~12%" hardcode

### Fixes Applied

| File | Perubahan |
|------|-----------|
| `frontend/src/pages/helper/HelperPage.jsx` | Tambah `usePublicConfig` ke import dari `../../hooks/useAppLogo` |
| `HelperPage.jsx` `MembuatOrderPanel` | Tambah `const ppnRate = parseFloat(publicConfig?.ppn_rate) \|\| 0` |
| `HelperPage.jsx` line ~372 | `Math.round(subtotal * 0.12)` → `Math.round(subtotal * ppnRate / 100)` |
| `HelperPage.jsx` product list price | `formatRupiah(p.price)` → `formatRupiah(Math.round(p.price * (1 + ppnRate / 100)))` |
| `HelperPage.jsx` cart summary item | `formatRupiah((i.price || 0) * i.qty)` → tax-inclusive |
| `HelperPage.jsx` PPN label | `PPN ~12%` → `PPN ~{ppnRate}%` |

### Prevention
- Semua halaman yang menampilkan harga ke user (customer/helper/cashier) HARUS fetch `ppn_rate` dari `usePublicConfig()` — tidak boleh hardcode rate
- Pattern standar: `const ppnRate = parseFloat(config?.ppn_rate) || 0`
- Harga tampil ke user = `Math.round(price * (1 + ppnRate / 100))` (tax-inclusive)
- PPN kalkulasi = `Math.round(subtotal * ppnRate / 100)`

---

## BUG-007 — GRP-20260616-0007 Tidak Terintegrasi ke Odoo (2026-06-16)
**Linked CR**: CR-BUG-007

#### RC-14: `order.push.js` SELALU kirim `tax_id: [[6,0,[]]]` meski Odoo tidak punya field tersebut

**Root Cause:**
- `order.push.js` memiliki logika:
  ```javascript
  if (cache.defaultTaxId) {
    lineVals.tax_id = [[6, 0, [cache.defaultTaxId]]];
  } else {
    lineVals.tax_id = [[6, 0, []]];  // ← ALWAYS sent — BUG
  }
  ```
- Ketika `odoo_default_tax_id` tidak dikonfigurasi (`null`), else-branch tetap mengirim `tax_id: [[6,0,[]]]` ke Odoo
- Odoo `demo-260614a` menolak field ini: `"Invalid field 'tax_id' on model 'sale.order.line'"` → seluruh `sale.order.create` gagal
- Setelah gagal, `inFlight=true` tetap di xref tapi `odoo_id=null` → TXN terjebak (stale inFlight)
- **File**: `integration/src/services/order.push.js`

**Verifikasi DB:**
```sql
SELECT value->>'odoo_default_tax_id' FROM system_settings WHERE key='integration_config';
-- Result: NULL → else branch selalu aktif → selalu kirim tax_id
```

**Fix:**
```javascript
// Sebelum (BUG): selalu kirim tax_id
if (cache.defaultTaxId) {
  lineVals.tax_id = [[6, 0, [cache.defaultTaxId]]];
} else {
  lineVals.tax_id = [[6, 0, []]];  // ← MASALAH
}

// Sesudah (FIX): gate pada hasTaxIdField
if (cache.defaultTaxId && cache.hasTaxIdField) {
  lineVals.tax_id = [[6, 0, [cache.defaultTaxId]]];
} else if (!cache.defaultTaxId && cache.hasTaxIdField) {
  lineVals.tax_id = [[6, 0, []]];
}
// Jika !hasTaxIdField → tidak kirim tax_id sama sekali
```

- Tambah startup check di `resolveStartupRefs()` (`odoo.client.js`):
  ```javascript
  const taxFields = await searchRead('ir.model.fields',
    [['model', '=', 'sale.order.line'], ['name', '=', 'tax_id']], ['name']);
  _cache.hasTaxIdField = taxFields.length > 0;
  ```
- Log startup: `hasTaxIdField: false` untuk `demo-260614a` → konfirmasi field tidak ada → `tax_id` tidak dikirim → `sale.order.create` berhasil

#### RC-15: SOS 404 (transaksi lama) di-retry terus tanpa batas — dead-letter tidak ada

**Root Cause:**
- TXN lama (`TXN-20260616-00140`, `TXN-20260615-00101`, `TXN-20260609-00043`) tidak lagi ada di SOS → GET `/transactions/:id` mengembalikan 404
- `order.push.js` tidak handle HTTP 404 dari SOS secara khusus — exception diteruskan, polling retry pada siklus berikutnya
- Transaksi-transaksi ini ter-queue ulang setiap 60 detik tanpa batas → mencemari log dan membuang resource Odoo API
- **File**: `integration/src/services/order.push.js`, `integration/src/scheduler/scheduler.js`

**Fix:**
1. `order.push.js`: deteksi `err.response?.status === 404` dari SOS → upsert xref dengan `deadLetter: true`:
   ```javascript
   if (err.response?.status === 404) {
     logger.warn('Order push: SOS 404 — marking dead-letter', { transactionId });
     await xref.upsertXref('order', transactionId, null, { deadLetter: true, reason: 'SOS 404' });
     return { success: false, odoo_order_id: null, error: 'SOS 404 — transaction not found' };
   }
   ```
2. `scheduler.js`: tambah kondisi `AND (x.sync_metadata->>'deadLetter')::boolean IS NOT TRUE` pada polling query Phase 1

### Recovery TXN-20260616-00147 dan TXN-20260616-00148

Setelah stale inFlight di-clear via DB direct:
```sql
DELETE FROM integration_xref
WHERE sos_id IN ('TXN-20260616-00147','TXN-20260616-00148')
  AND sync_metadata->>'inFlight' = 'true'
  AND odoo_id IS NULL;
```
- Container `hybrid_integration` di-rebuild dan di-redeploy
- Polling cycle berikutnya: TXN-00147 → Odoo SO #4436 ✓, TXN-00148 → Odoo SO #4437 ✓
- GRP-20260616-0007 kedua transaksinya kini terintegrasi ke Odoo

### Prevention
- Setiap field yang dikirim ke Odoo HARUS terlebih dahulu dicek keberadaannya di `resolveStartupRefs()` via `ir.model.fields` lookup — jangan assume field ada karena ada di satu instance Odoo
- Pola gate: `if (value && cache.hasField) { send }` — tidak pernah kirim field tanpa gate
- Error 404 dari SOS adalah kondisi terminal (data sudah tidak ada) — HARUS langsung dead-letter, bukan retry
- Dead-letter mechanism: `upsertXref(null, { deadLetter: true })` + polling query exclude via `(sync_metadata->>'deadLetter')::boolean IS NOT TRUE`

---

## BUG-010 — Tax Salah di sale.order dan account.move (2026-06-16)
**Linked CR**: CR-BUG-010

#### RC-18: Kirim `tax_id` via `write` terpisah setelah SO dibuat (draft), sebelum confirm

**Root Cause:**
- `sale.order.create` menolak `tax_id` dalam nested `order_line: [[0, 0, vals]]` pada Odoo Online (lihat RC-17)
- RC-17 fallback: retry tanpa `tax_id` → SO line inherit default tax produk (11% INC)
- Invoice (`account.move`) dibuat via `sale.advance.payment.inv` wizard dari SO yang sudah confirmed
- Odoo copy taxes dari `sale.order.line.tax_id` ke `account.move.line.tax_ids` saat invoice creation
- Akibat: invoice juga pakai 11% INC → total Odoo = 1,000,000 (price-inclusive), bukan 1,110,000

**Perbedaan Create vs Write:**
- `sale.order.create` dengan `order_line: [[0, 0, {..., tax_id: ...}]]` → DITOLAK Odoo (nested create restriction)
- `sale.order.line.write([lineId], {tax_id: [[6,0,[234]]]})` → DAPAT BERHASIL (direct write pada record existing)

### Fix Applied — RC-18: Step 1.5 di `order.push.js`

Tambah step baru setelah create SO (draft) dan sebelum `action_confirm`:

```javascript
// ── Step 1.5: Apply tax override on order lines via write ──────────────────
if (cache.defaultTaxId) {
  try {
    const orderLines = await odoo.searchRead(
      'sale.order.line', [['order_id', '=', odooOrderId]], ['id']
    );
    const lineIds = orderLines.map(l => l.id);
    if (lineIds.length > 0) {
      await odoo.write('sale.order.line', lineIds, { tax_id: [[6, 0, [cache.defaultTaxId]]] });
      logger.info('Order push: tax override applied on draft SO lines', {
        transactionId, odooOrderId, taxId: cache.defaultTaxId, lineCount: lineIds.length,
      });
    }
  } catch (taxErr) {
    // Non-fatal: jika write juga gagal, order tetap lanjut dengan default tax produk
    logger.warn('Order push: tax_id write on SO lines failed — product default tax will apply', {...});
  }
}
// ── Step 2: action_confirm ────────────────────────────────────────────────
```

**Alur yang diharapkan setelah fix:**
```
Step 1:   sale.order.create (tanpa tax_id) → SO draft #XXXX
Step 1.5: sale.order.create tolak tax_id → RC-17 retry tanpa tax_id
          → sale.order.line.write([lineIds], {tax_id: [[6,0,[234]]]})
          → SO lines: tax = Tax ID 234 "12% (Non-Luxury Good)"
Step 2:   action_confirm → SO confirmed
Step 3:   action_lock → SO locked
[B]:      sale.advance.payment.inv wizard → account.move (invoice)
          → invoice lines copy tax dari SO lines = Tax ID 234 ✓
[C]:      action_post → invoice posted
[D]:      payment registered → invoice paid
```

**Efek pada total:**
```
defaultTaxRate: 0.11, defaultTaxPriceInclude: false
price_unit = 1,000,000 (DPP dari SOS)
→ Odoo calc: subtotal = 1,000,000, tax = 110,000
→ amount_total = 1,110,000 = SOS total_amount ✓  (mismatch warning hilang)
```

### Prevention (RC-18)
- Ketika `sale.order.create` menolak field pada nested order line vals, gunakan `write` terpisah pada `sale.order.line` setelah SO draft dibuat — write path melewati code path berbeda dari create
- Urutan yang aman untuk set field yang tidak bisa di-set saat create: **Create draft → Write fields → Confirm**
- Tax override via write HARUS dilakukan SEBELUM `action_confirm`, karena setelah confirm SO di-lock dan invoice generation copy taxes dari state confirmed
- Untuk `account.move`: tidak perlu write terpisah — Odoo automatically copy `sale.order.line.tax_ids` ke `account.move.line.tax_ids` saat invoice creation via wizard

#### RC-19: Dynamic tax field name detection via `fields_get` — root cause final tax bug

**Root Cause:**
- RC-18 + RC-17 masih menggunakan field name `tax_id` secara hardcoded
- Odoo Online `demo-260614a` sebenarnya MEMILIKI field pajak di `sale.order.line`, namun field namenya adalah `tax_ids` (bukan `tax_id`)
- Sebelumnya: `ir.model.fields` query mengembalikan 0 hasil (SaaS access restriction) → `hasTaxIdField=false` → salah disimpulkan field tidak ada
- Konsekuensi RC-17: RC-17 melihat error `"Invalid field 'tax_id'"` → inline recovery strip `tax_id` → Step 1.5 juga kirim `tax_id` → Odoo tolak → warning saja → Odoo pakai default produk (11% INC)
- **Root cause sebenarnya**: field name SALAH (`tax_id` vs `tax_ids`) — bukan field tidak ada

**Detection via `fields_get` (RC-19):**
- `fields_get(['tax_id', 'tax_ids', 'taxes_id'], {attributes: ['type']})` pada model level lebih reliable dari `ir.model.fields` query (tidak kena SaaS restriction)
- Pada `demo-260614a`: `fields_get` mengembalikan `{'tax_ids': {...}}` → `taxLineFieldName = 'tax_ids'`
- Startup log setelah RC-19: `"taxLineFieldName":"tax_ids","hasTaxIdField":true`

### Fix Applied — RC-19: Dynamic field name + self-healing RC-17

**`odoo.client.js` `resolveStartupRefs()`:**
```javascript
// Ganti ir.model.fields query dengan fields_get — lebih reliable di Odoo SaaS
let taxLineFieldName = null;
try {
  const solTaxCheck = await callKw('sale.order.line', 'fields_get',
    [['tax_id', 'tax_ids', 'taxes_id']], { attributes: ['type'] });
  taxLineFieldName = 'tax_id'   in solTaxCheck ? 'tax_id'
    : 'tax_ids'  in solTaxCheck ? 'tax_ids'
    : 'taxes_id' in solTaxCheck ? 'taxes_id'
    : null;
} catch (_e) { /* non-fatal */ }
_cache.taxLineFieldName = taxLineFieldName;  // 'tax_ids' pada demo-260614a
_cache.hasTaxIdField    = taxLineFieldName !== null;
```

**`order.push.js` lineVals:**
```javascript
// Gunakan nama field dinamis (bukan hardcoded 'tax_id')
if (cache.defaultTaxId && cache.taxLineFieldName) {
  lineVals[cache.taxLineFieldName] = [[6, 0, [cache.defaultTaxId]]];
}
```

**RC-17 (inline recovery) — tidak null `taxLineFieldName`:**
```javascript
if (_taxRejected) {
  // Hanya strip dari lineVals dan retry — taxLineFieldName TIDAK di-null
  // sehingga Step 1.5 masih bisa mencoba write() pada draft lines
  for (const line of orderVals.order_line) { delete line[2][_taxField]; }
  odooOrderId = await odoo.create('sale.order', orderVals);
}
```

**Step 1.5 — gunakan `taxLineFieldName` dari cache:**
```javascript
const _taxField15 = cache.taxLineFieldName;  // 'tax_ids' (tidak null karena RC-17 tidak null-kan)
if (cache.defaultTaxId && _taxField15) {
  await odoo.write('sale.order.line', lineIds, { [_taxField15]: [[6, 0, [cache.defaultTaxId]]] });
  // → "Order push: tax override applied on draft SO lines via write"
}
// Jika write juga tolak field: null taxLineFieldName + hasTaxIdField=false (disable for session)
```

**Alur order push setelah RC-19:**
```
Startup:  fields_get → taxLineFieldName = 'tax_ids', hasTaxIdField = true
Step 1:   sale.order.create → order_line includes tax_ids: [[6,0,[234]]]
          → Odoo terima (field name sudah benar) → SO draft, tax = Tax ID 234 ✓
Step 1.5: write(sale.order.line, lineIds, {tax_ids: [[6,0,[234]]]}) → konfirmasi tax
          → Log: "tax override applied on draft SO lines via write"
Step 2:   action_confirm → SO confirmed, tax = Tax ID 234 "12% (Non-Luxury Good)" ✓
[B]:      invoice creation → copy tax dari SO lines → tax = Tax ID 234 ✓
```

**Konfirmasi Startup Log Setelah RC-19:**
```json
{
  "taxLineFieldName": "tax_ids",
  "hasTaxIdField": true,
  "defaultTaxId": 234,
  "defaultTaxRate": 0.11,
  "defaultTaxPriceInclude": false
}
```

### Prevention (RC-19)
- **Jangan hardcode field name Odoo** — field name bervariasi antar versi Odoo dan antar instance (on-premise vs SaaS). Selalu deteksi via `fields_get` pada startup.
- `fields_get` adalah model-level API (memanggil method Python pada class model), reliable di Odoo Online SaaS. `ir.model.fields` search_read dapat di-filter oleh company context / SaaS access restrictions.
- Pattern deteksi field: probe beberapa kandidat nama (`tax_id`, `tax_ids`, `taxes_id`) di `fields_get` → gunakan yang pertama ditemukan → cache sebagai `taxLineFieldName`.
- RC-17 inline recovery TIDAK boleh null `taxLineFieldName` — hanya strip dari lineVals. Permanent disable hanya jika write JUGA gagal (dihandle di Step 1.5).

---

## NOTE-001 — Tambah Transaction ID ke Payment Note di Odoo Sale Order (2026-06-16)
**Linked CR**: CR-NOTE-001

#### RC-20: `paymentNote` di `order.push.js` tidak menyertakan Transaction ID

**Root Cause:**
- `paymentNote` dibangun dari payment details (method, ref, cash, cashier, paid_at) tapi tidak ada `transactionId`
- Tanpa TXN ID di note, admin tidak bisa langsung mengidentifikasi sale order Odoo mana yang berasal dari transaksi SOS mana hanya dari tampilan Odoo

### Fix Applied — RC-20

**File**: `integration/src/services/order.push.js`

```javascript
// Sebelum fix — TXN ID tidak ada di note
const paymentNote = [
  `Payment Method: ${txn.payment_method || 'UNKNOWN'}`,
  `Ref: ${txn.payment_reference || '-'}`,
  `Cash Received: Rp ${txn.cash_received || 0}`,
  `Change: Rp ${txn.cash_change || 0}`,
  `Cashier: ${txn.cashier_name || '-'}`,
  `Paid At: ${txn.paid_at || '-'}`,
].join(' | ');

// Setelah fix — TXN ID sebagai item pertama
const paymentNote = [
  `TXN: ${transactionId}`,
  `Payment Method: ${txn.payment_method || 'UNKNOWN'}`,
  `Ref: ${txn.payment_reference || '-'}`,
  `Cash Received: Rp ${txn.cash_received || 0}`,
  `Change: Rp ${txn.cash_change || 0}`,
  `Cashier: ${txn.cashier_name || '-'}`,
  `Paid At: ${txn.paid_at || '-'}`,
].join(' | ');
```

**Contoh output:**
```
TXN: TXN-20260616-00155 | Payment Method: QRIS | Ref: - | Cash Received: Rp 0 | Change: Rp 0 | Cashier: Kasir Satu | Paid At: 2026-06-16T07:46:58.309Z
```

### Prevention
- Setiap entitas yang di-push ke Odoo HARUS menyertakan identifier asal (TXN ID / GRP ID) di field yang mudah dibaca manusia (`note`, `origin`, atau custom field)
- `origin` field di sale order sudah diisi `transactionId` — tapi `origin` tidak terlihat di default list view Odoo, sedangkan `note` bisa ditampilkan
- Standard urutan field `note`: **ID transaksi selalu di posisi pertama**, diikuti detail operasional

---

## BUG-009 — GRP-20260616-0008: Loop Karena RC-16 Kirim tax_id ke Odoo yang Tidak Support (2026-06-16)
**Linked CR**: CR-BUG-009

#### RC-17: RC-16 mengirim `tax_id` tanpa error recovery — Odoo tolak field → loop infinite inFlight

**Root Cause:**
- RC-16 menghapus `hasTaxIdField` gate → selalu kirim `tax_id: [[6,0,[234]]]` ketika `defaultTaxId` dikonfigurasi
- Odoo Online `demo-260614a` TIDAK memiliki field `tax_id` yang dapat di-set pada `sale.order.line` melalui API create
- Bukti: startup `hasTaxIdField: false` (dari `ir.model.fields` query), dan error berulang `"Invalid field 'tax_id' on model 'sale.order.line'"`
- RC-16 tidak menambah fallback — saat `sale.order.create` gagal, order masuk retry queue → polling pick up → gagal lagi → loop
- `inFlight: true` tetap di xref tanpa `odoo_id` → stale inFlight di-clear setiap 60s → retry → gagal → loop terus

**Diagnosis:**
```
07:17:20 - Odoo rejects tax_id → retryQueue
07:17:52 - retry queue fires → "another process creating" (inFlight check)
07:18:25 - polling: stale inFlight cleared → retry → Odoo rejects tax_id → retryQueue
07:18:58 - retry queue → "another process creating"
07:19:31 - polling: stale inFlight cleared → retry → same error
[cycle repeats indefinitely]
```

### Fix Applied — RC-17

Tambah **inline auto-recovery** di `sale.order.create` catch block di `order.push.js`:

```javascript
} catch (err) {
  cb.recordFailure('odoo');

  // Odoo Online instances may not expose tax_id as a writable field on sale.order.line.
  // Self-heal: if Odoo rejects it, disable for this session and retry create immediately.
  if (err.message?.includes("Invalid field 'tax_id'") && cache.defaultTaxId) {
    logger.warn('Order push: Odoo rejected tax_id — disabling and retrying without tax_id', ...);
    cache.hasTaxIdField = false;        // persist for all future orders this session
    for (const line of orderVals.order_line) {
      delete line[2].tax_id;            // strip from all prepared line vals
    }
    try {
      odooOrderId = await odoo.create('sale.order', orderVals);  // retry without tax_id
      logger.info('Order push: sale.order created (tax_id override disabled ...)', ...);
    } catch (retryErr) {
      // normal error handling + retry queue
    }
  } else {
    // normal error handling + retry queue
  }
}
```

**Efek:**
- Ketika `tax_id` ditolak: log warning → strip dari lineVals → retry inline → order berhasil dengan product default tax
- `cache.hasTaxIdField = false` persists di memory → semua order berikutnya di session ini tidak kirim `tax_id` (tidak perlu rebuild)
- Tidak ada lagi loop infinite — error yang sebelumnya fatal kini auto-recovery

**Konfirmasi:**
```
07:25:25 - stale inFlight cleared → retry dengan kode baru
07:25:25 - "Odoo rejected tax_id ... disabling and retrying without tax_id" [WARN]
07:25:26 - "sale.order created (tax_id override disabled)" → Odoo #4438 ✓
07:25:26 - TXN-00149: order confirmed + locked + delivery created → SUCCESS
07:25:27 - TXN-00150: same recovery → Odoo #4439 → SUCCESS
```

### Kenapa `tax_id` Tidak Bisa Di-set via API pada Instance Ini

Odoo Online `demo-260614a` adalah Odoo SaaS/Online. Pada beberapa konfigurasi Odoo Online:
- `ir.model.fields` query untuk `sale.order.line.tax_id` mengembalikan 0 hasil (akses restricted)
- `sale.order.create` dengan `tax_id` dalam nested order_line vals mengembalikan "Invalid field"
- Produk Odoo akan terus menggunakan default tax dari `product.template.taxes_id`

**Implikasi**: Tax override per-order via integration **tidak bisa dilakukan** pada instance ini. Untuk mengubah tax pada order lines, admin perlu mengubah default taxes langsung di product template di Odoo.

### Prevention
- Error `"Invalid field X"` pada `sale.order.create` HARUS ditangani sebagai **recoverable** (bukan fatal) ketika field tersebut adalah optional configuration (tax, custom fields, dll.)
- Pattern standar untuk optional Odoo fields: coba kirim → jika Odoo tolak dengan "Invalid field" → disable otomatis + retry inline
- Jangan pernah kirim optional fields tanpa self-healing fallback — field yang ada di satu Odoo instance mungkin tidak ada di instance lain (SaaS vs on-premise, versi berbeda)
- `cache.hasTaxIdField = false` di runtime cukup untuk disable semua order berikutnya tanpa restart container

---

## BUG-008 — Tax Salah di Odoo: Product Default 11% INC Bukan Tax ID Konfigurasi (2026-06-16)
**Linked CR**: CR-BUG-008

#### RC-16: Dua root cause terpisah — tax_id tidak pernah dikirim meski Tax ID sudah dikonfigurasi

**Root Cause A — Sumber config salah (`loadCredentials()` tidak baca `tax_config`)**

- Admin mengonfigurasi Odoo Tax ID di `/admin` → Pajak & SPT → field "Odoo Tax ID (manual)" = 234
- Nilai ini tersimpan di `system_settings WHERE key='tax_config'` sebagai `{"odoo_tax_id": 234, "odoo_tax_name": "12% (Non-Luxury Good)", ...}`
- `loadCredentials()` di `odoo.client.js` hanya membaca `system_settings WHERE key='integration_config'`
- Field `integration_config.odoo_default_tax_id` = NULL (belum diisi di tab Integrasi)
- Akibat: `_creds.defaultTaxId = null` → `_cache.defaultTaxId = null` → `tax_id` tidak masuk `lineVals`
- **File**: `integration/src/clients/odoo.client.js` fungsi `loadCredentials()`

**Root Cause B — RC-14 hasTaxIdField gate terlalu konservatif**

- RC-14 menambahkan gate: `if (cache.defaultTaxId && cache.hasTaxIdField)` sebelum mengirim `tax_id`
- `hasTaxIdField` di-set dari `ir.model.fields` query pada startup — pada Odoo Online `demo-260614a`, query ini mengembalikan 0 hasil (kemungkinan company context / SaaS access restriction) sehingga `hasTaxIdField = false`
- Akibat: bahkan jika `defaultTaxId` dikonfigurasi dengan benar, `hasTaxIdField = false` memblokir `tax_id` dari dikirim
- Product Odoo menggunakan default tax mereka sendiri (11% INC / `price_include=True`) → total Odoo salah

### Fixes Applied

| Fix | File | Perubahan |
|-----|------|-----------|
| RC-16 (A) | `odoo.client.js` `loadCredentials()` | Tambah query parallel ke `tax_config`; gunakan `tax_config.odoo_tax_id` sebagai `defaultTaxId` (primary), fallback ke `integration_config.odoo_default_tax_id` (backward compat) |
| RC-16 (B) | `order.push.js` | Hapus `&& cache.hasTaxIdField` dari kondisi `defaultTaxId` — ketika admin sudah set Tax ID, selalu kirim; hapus branch "explicitly clear to `[[6,0,[]]]`" |
| RC-16 (log) | `odoo.client.js` `resolveStartupRefs()` | Tambah `defaultTaxId`, `defaultTaxRate`, `defaultTaxPriceInclude` ke startup log untuk verifikasi |

**Kode sebelum fix (BUG):**
```javascript
// order.push.js — tax_id gated on hasTaxIdField (always false → never sent)
if (cache.defaultTaxId && cache.hasTaxIdField) {   // ← hasTaxIdField selalu false
  lineVals.tax_id = [[6, 0, [cache.defaultTaxId]]];
} else if (!cache.defaultTaxId && cache.hasTaxIdField) {
  lineVals.tax_id = [[6, 0, []]];
}

// odoo.client.js loadCredentials() — tidak baca tax_config
return {
  ...
  defaultTaxId: cfg.odoo_default_tax_id ? Number(...) : null,  // ← integration_config only, = null
};
```

**Kode setelah fix:**
```javascript
// order.push.js — kirim tax_id ketika dikonfigurasi, tanpa gate hasTaxIdField
if (cache.defaultTaxId) {
  lineVals.tax_id = [[6, 0, [cache.defaultTaxId]]];
}
// Jika tidak ada defaultTaxId → tidak kirim tax_id (Odoo gunakan default produk)

// odoo.client.js loadCredentials() — baca dari tax_config (primary) + integration_config (fallback)
const taxIdFromTaxConfig = taxCfg?.odoo_tax_id ? Number(taxCfg.odoo_tax_id) : null;
const defaultTaxId = taxIdFromTaxConfig
  || (cfg.odoo_default_tax_id ? Number(cfg.odoo_default_tax_id) : null);
```

### Konfirmasi Startup Log Setelah Fix

```json
{
  "defaultTaxId": 234,
  "defaultTaxRate": 0.11,
  "defaultTaxPriceInclude": false,
  "hasTaxIdField": false
}
```

- `defaultTaxId: 234` ✓ — dibaca dari `tax_config.odoo_tax_id`
- `defaultTaxPriceInclude: false` ✓ — price-exclusive; tidak perlu gross-up; kirim DPP langsung
- `hasTaxIdField: false` tetapi TIDAK memblokir karena gate sudah dihapus dari `defaultTaxId` path

**Hasil untuk order berikutnya:**
```
SOS price_unit = 1,000,000 (DPP, price_include=False → tidak ada gross-up)
→ Kirim ke Odoo: price_unit = 1,000,000, tax_id = [[6,0,[234]]]
→ Odoo hitung: subtotal = 1,000,000, tax = 110,000 (11%)
→ amount_total = 1,110,000 = SOS total ✓
```

### Cara Penggunaan

Source of truth untuk Odoo Tax ID adalah **Admin → Pajak & SPT → "Odoo Tax ID (manual)"**:
1. Di Odoo: Accounting → Configuration → Taxes → cari tax yang dipakai → catat ID dari URL
2. Admin UI → `/admin` → tab Pajak & SPT → isi **Odoo Tax ID (manual)** → Simpan
3. Restart/reload `hybrid_integration` agar config baru terbaca
4. Field `integration_config.odoo_default_tax_id` di tab Integrasi tetap berfungsi sebagai fallback

### Prevention

- **Single source of truth**: Odoo Tax ID HARUS dikonfigurasi di `tax_config` (Pajak & SPT), bukan di `integration_config` — kedua tempat menyimpan tax info (SOS rate + Odoo ID) dan harus sinkron
- `loadCredentials()` harus selalu baca `tax_config` bersamaan dengan `integration_config`
- Jangan gunakan kemampuan deteksi field (`hasTaxIdField`, `ir.model.fields` query) sebagai gate untuk mengirim nilai yang sudah dikonfigurasi eksplisit oleh admin — jika admin set Tax ID, asumsinya field ada di Odoo
- `ir.model.fields` query pada Odoo Online SaaS tidak reliable sebagai gate (mungkin filtered/restricted) — gunakan hanya untuk informasi log, bukan flow control

---

## RECEIPT-001 — ThermalReceipt Redesign (2026-06-16)
**Linked CR**: CR-RECEIPT-001

### Fixes Applied
- Redesign penuh `ThermalReceipt.jsx` sesuai `receipt-sample.html`
- Logo: ekstrak golden sun dari receipt-sample, simpan ke `frontend/public/logo.png`; gunakan `publicCfg?.logo_url || '/logo.png'`
- `ThermalGroupReceipt.jsx` diupdate sama: ganti ToyIcon → logo conditional
- Pickup section: tambah `S.pickupTitle` (10px) terpisah dari `S.sectionTitle` (15px)
- HR rules: `ruleSolid` / `ruleDashed` / `ruleHair` sesuai hierarki visual sample
