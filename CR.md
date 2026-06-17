# Change Request Log

## CR-062 — Auto-fill Shipping Form dari Customer Lookup di Helper Order (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: Low
- **Module**: Frontend → Helper → HelperPage (`/helper`) — MembuatOrderPanel
- **Status**: RESOLVED
- **Related**: CR-061

### Deskripsi
Setelah CR-061 (lookup customer by phone), data customer (nama, HP) sudah tersedia di `customerInfo`. Request: auto-fill form "Alamat Pengiriman (Pre-Order)" saat customer ditemukan.

**Mapping field:**
| Field Form | Sumber |
|---|---|
| Nama Penerima | `customerInfo.full_name` dari lookup |
| No. HP Penerima | `customerInfo.phone_number` dari lookup |
| Alamat Lengkap | Hardcoded: `"Amazing Toy Show Indonesia"` |
| Kota / Kabupaten | Tidak di-fill |
| Provinsi | Tidak di-fill |

### Perubahan

**`frontend/src/pages/helper/HelperPage.jsx`**:
- Tambah `useEffect` yang watch `customerInfo`
- Saat `customerInfo.found === true`: auto-fill `shipName`, `shipPhone`, `shipAddress`
- Field kota dan provinsi tidak di-fill (tetap manual)
- User masih bisa edit manual setelah auto-fill

### Catatan
- Auto-fill HANYA terjadi saat lookup berhasil (found = true)
- Tidak auto-clear saat phone dihapus — user memutuskan sendiri
- `createHelperOrder` flow tidak berubah

---

## CR-061 — Customer Phone Lookup di Helper Order Panel (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: Medium
- **Module**: Frontend → Helper → HelperPage (`/helper`) + Backend → Cashier router
- **Status**: RESOLVED

### Deskripsi
Halaman `/helper` menu "Order" (MembuatOrderPanel) sudah memiliki field "No. HP Customer (opsional)" namun tidak memberikan konfirmasi apakah nomor terdaftar. Gunakan pola CR-060 (debounced lookup) untuk menampilkan nama dan email customer saat helper mengisi nomor HP.

**Flow:**
1. Helper input no. HP
2. Setelah berhenti mengetik (debounce 600ms), sistem lookup customer
3. Jika ditemukan: tampilkan nama + email (border hijau)
4. Jika tidak ditemukan: tampilkan "Customer belum terdaftar — akan dicatat sebagai Walk-in" (border amber)
5. Flow `createHelperOrder` tidak berubah

### Perubahan

**`backend/src/modules/cashier/cashier.router.js`**:
- Tambah `'HELPER'` ke `authorize()` pada route `GET /cashier/customer-lookup`
- Sebelumnya: `authorize('CASHIER', 'LEADER', 'ADMIN')`
- Sesudah: `authorize('CASHIER', 'LEADER', 'ADMIN', 'HELPER')`

**`frontend/src/pages/helper/HelperPage.jsx`**:
- Import `useRef` dari React
- Import `lookupCustomerByPhone` dari `../../api/cashier`
- State baru: `customerInfo`, `lookupLoading`, `lookupTimerRef`
- Fungsi `handlePhoneChange(val)`: debounce 600ms, panggil lookup, set customerInfo
- Reset `customerInfo` dan timer saat order sukses dibuat
- Phone input: border dinamis, spinner, clear button, panel info di bawah

### Catatan
- Endpoint `GET /cashier/customer-lookup` di-share antara kasir (CR-060) dan helper (CR-061)
- Tidak ada migrasi DB — query hanya baca tabel `customers`
- Standar: lihat STD-038

---

## CR-060 — Verifikasi Customer di Kasir POS sebelum Checkout (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: Medium
- **Module**: Frontend → Cashier → CashierPOSPage (`/cashier/pos`) + Backend → Cashier
- **Status**: RESOLVED

### Deskripsi
Kasir yang mengisi "No. HP Customer" di POS tidak mendapat konfirmasi apakah nomor tersebut terdaftar di sistem. Permintaan: tambahkan verifikasi nama, nomor HP, dan email customer saat kasir mengisi nomor HP sebelum proses pembayaran dimulai.

**Flow yang diminta:**
1. Kasir input no. HP di field "No. HP Customer (opsional)"
2. Setelah berhenti mengetik (debounce 600ms), sistem otomatis lookup customer
3. Jika ditemukan: tampilkan nama dan email customer di bawah field (border hijau)
4. Jika tidak ditemukan: tampilkan peringatan "Customer belum terdaftar — akan dicatat sebagai Walk-in" (border amber)
5. Proses bayar tetap berjalan seperti biasa (tidak ada gate blocking)

### Perubahan

**`backend/src/modules/cashier/cashier.service.js`**:
- Tambah fungsi `lookupCustomerByPhone(phone)` — query `customers` by `phone_number`, return `{ customer_id, full_name, phone_number, email }` atau `null`

**`backend/src/modules/cashier/cashier.router.js`**:
- Tambah `GET /api/v1/cashier/customer-lookup?phone=xxx` — auth: CASHIER/LEADER/ADMIN, 200 + data jika ditemukan, 404 jika tidak

**`frontend/src/api/cashier.js`**:
- Tambah `lookupCustomerByPhone(phone)` → `GET /cashier/customer-lookup`

**`frontend/src/pages/cashier/CashierPOSPage.jsx`**:
- Import `lookupCustomerByPhone` dari api
- State baru: `customerInfo` (null | { found: true, ...data } | { found: false }), `lookupLoading`, `lookupTimerRef`
- Fungsi `handlePhoneChange`: debounce 600ms, panggil lookup, set customerInfo
- Fungsi `handlePhoneClear`: reset phone + customerInfo sekaligus
- Customer phone card: border warna dinamis (hijau/amber/abu), spinner saat lookup, panel info di bawah
- Cart panel header: tampilkan nama customer jika ditemukan

### Catatan
- Walk-in flow (phone kosong) tidak terpengaruh
- `handleBayar()` dan `createCashierOrder` tidak diubah — phone tetap dikirim as-is
- Tidak ada migrasi DB

---

## CR-059 — Push Notifikasi Order Masuk di Kasir POS Pad (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: Medium
- **Module**: Frontend → Cashier → CashierPOSPage (`/cashier/pos`)
- **Status**: RESOLVED

### Deskripsi
Kasir di halaman `/cashier/pos` tidak mendapat notifikasi real-time saat helper membuat order baru. `broadcastToCashier` sudah ada di `websocket.js` dan event `ORDER_RESERVED` sudah di-broadcast ke ALL di `helper.service.js:260`, namun frontend kasir belum subscribe dan tidak menampilkan notifikasi apapun.

### Perubahan

**`frontend/src/hooks/useOrderNotifications.js`** *(baru)*:
- Hook singleton (module-level state, sama persis pola `usePaymentNotifications`)
- Subscribe ke event `ORDER_RESERVED` via `useWebSocket`
- Payload: `{ transactionId, boothId }` dari backend
- Menyimpan history notifikasi (`notifs`), state toast aktif (`toast`), unread count
- Memainkan chime 3-nada descending (C6→A5→E5) — berbeda dari chime ascending `usePaymentNotifications`
- Toast auto-dismiss setelah 6 detik
- Expose: `notifs`, `toast`, `unreadCount`, `markRead`, `markAll`, `dismissToast`

**`frontend/src/pages/cashier/CashierPOSPage.jsx`**:
- Import `useOrderNotifications`
- Tambah komponen `OrderNotifToast` — floating toast biru di atas halaman, muncul saat order baru masuk, dismiss manual atau auto-dismiss 6s
- Tambah komponen `OrderNotifBell` — bell icon dengan badge merah (unread count), klik buka dropdown list notifikasi terakhir, baca otomatis saat dropdown dibuka
- Bell ditempatkan sebagai elemen ke-3 di baris top (sejajar phone + barcode scanner)
- Dropdown menutup saat klik di luar (click-outside handler)

### Behavior Setelah Fix
1. Helper buat order → `ORDER_RESERVED` broadcast ke ALL
2. Kasir di `/cashier/pos` menerima event → chime berbunyi + toast muncul di atas halaman
3. Toast menampilkan nomor transaksi + ID booth, bisa di-dismiss manual atau hilang sendiri dalam 6 detik
4. Bell icon di top-bar menampilkan badge merah dengan jumlah unread
5. Klik bell → dropdown list semua notifikasi sesi ini, status baca/belum baca
6. Buka dropdown → semua notif otomatis ditandai dibaca (badge hilang)

---

## CR-058 — Navigasi & UX /helper/order-success (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: Low
- **Module**: Frontend → Helper → HelperOrderSuccessPage (`/helper/order-success`)
- **Status**: RESOLVED

### Deskripsi
Halaman `/helper/order-success` tidak memiliki tombol navigasi "Kembali". Satu-satunya CTA adalah "Buat Order Berikutnya" di bawah. Label teknikal "Layer 3 — QR di Layar Helper" tidak user-friendly.

### Perubahan

**`frontend/src/pages/helper/HelperOrderSuccessPage.jsx`:**
- Tambah tombol **← Kembali ke Helper** di atas (di bawah back button, sebelum header sukses) — navigasi ke `/helper`
- Label card QR: "Layer 3 — QR di Layar Helper" → **"QR untuk Pembayaran Kasir"**
- Label status chip "Layer 2": "Push notifikasi dikirim" → **"Notifikasi dikirim ke customer"** + sub-text yang lebih jelas
- Label status chip "Layer 3": "QR aktif di layar ini" → **"QR tersedia di layar ini"** + sub-text kontekstual
- Section label: "Status Pengiriman QR" → **"Status Notifikasi"**
- CTA bawah: dari 1 tombol full-width menjadi **2 tombol sejajar** — `← Kembali` (secondary) + `Buat Order Berikutnya` (primary)

### Behavior Setelah Fix
1. Helper menekan "← Kembali ke Helper" di atas → kembali ke `/helper`
2. Atau tekan tombol "← Kembali" di CTA bawah → sama
3. Label lebih mudah dipahami staff non-teknikal

---

## CR-057 — Badge & Info Box Pre-Order di Halaman /product_cart/:id (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: Low
- **Module**: Frontend → Customer → ProductCartPage (`/product_cart/:id`)
- **Status**: RESOLVED

### Deskripsi
Halaman `/product_cart/:id` tidak menampilkan indikasi visual bahwa produk adalah pre-order. Halaman `/product/:id` (`MockProductDetailPage`) sudah memiliki implementasi lengkap.

### Perubahan

**`frontend/src/pages/customer/ProductCartPage.jsx`:**
- Tambah derived values `isPreorder` + `preorderNote` dari data produk
- Tambah **overlay badge** "PRE-ORDER" oranye di sudut kiri bawah hero image (sama persis dengan `MockProductDetailPage`)
- Ganti status badge di header row: tampilkan badge "Pre-Order" oranye saat `isPreorder`, fallback ke stock badge seperti sebelumnya
- Tambah **Pre-Order info box** (gradient oranye, ikon 🔖) setelah blok harga, menampilkan `preorderNote` jika ada

### Behavior Setelah Fix
1. Scan QR produk pre-order → `/product_cart/:id` menampilkan badge "PRE-ORDER" di foto
2. Header row menampilkan badge "Pre-Order" (oranye) alih-alih badge stok
3. Info box menjelaskan alur pre-order dan catatan produk (jika ada)
4. Produk reguler tidak terpengaruh

---

## CR-056 — Mixed Cart Defense (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: High
- **Module**: Backend Orders/Helper + Frontend ApprovalQueueTab
- **Status**: RESOLVED

### Deskripsi
Tidak ada validasi server-side yang mencegah order berisi campuran item pre-order dan reguler. Backend `createOrder()` hanya memblokir pre-order di SELF_ORDER mode, bukan mixed cart universal. `approveOrder()` tidak mendeteksi anomali mixed cart. Frontend tidak memberi indikasi visual per tipe item.

### Perubahan

**`backend/src/modules/orders/orders.service.js`:**
- Pindahkan validasi mixed cart ke luar blok `isHelperApproveMode` → berlaku untuk **semua mode**
- HTTP status → 400 (dari 422)
- Variabel `preorderItemsAll` shared antara mixed-cart check dan SELF_ORDER check

**`backend/src/modules/helper/helper.service.js`:**
- Ganti single EXISTS query dengan COUNT query yang menghitung `preorder_count` + `regular_count`
- Mixed cart (keduanya > 0) → `logger.error` + throw AppError 400
- All-preorder tapi `order_type=REGULAR` → `logger.warn` + auto-koreksi ke PREORDER (behavior BUG-050-02 dipertahankan)

**`frontend/src/components/helper/ApprovalQueueTab.jsx`:**
- `ItemRow`: Badge per item — 🔖 PRE-ORDER (oranye) / REGULER (hijau)
- `ApprovalCard`: Tambah state `mixedChecked`, computed `hasMixedCart`
- Banner warning merah muncul jika `hasMixedCart`
- Modal "Approve All": Tambah checkbox "Saya sudah periksa tipe barang" saat `hasMixedCart`
- Tombol "Ya, Setujui" disabled saat `hasMixedCart && !mixedChecked`
- `mixedChecked` di-reset saat modal ditutup (onClose & Batal & onClick)

### Behavior Setelah Fix
1. `createOrder()` menolak HTTP 400 untuk cart campuran di semua mode order
2. `approveOrder()` mendeteksi anomali mixed cart → log error + HTTP 400
3. Helper melihat badge tipe per item di ApprovalCard
4. Banner merah muncul otomatis jika order anomali mixed cart
5. Helper harus centang konfirmasi sebelum tombol Approve aktif
6. Semua state checkbox di-reset saat modal ditutup

---

## CR-055 — Tambah Kategori Inline di Field "Kategori *" (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: Low
- **Module**: Admin → Master Data → Form Produk & Bulk Category Modal
- **Status**: RESOLVED

### Deskripsi
Field "Kategori *" di modal **Set Kategori Semua Produk** (Bulk Category Modal) tidak memiliki affordance "Tambah Kategori Baru". User harus menutup modal, membuat produk dummy dengan kategori baru, lalu kembali — tidak efisien.

Form Create/Edit produk individual sudah compliant (STD-009). Bulk Category Modal belum.

### Perubahan
**`frontend/src/pages/admin/tabs/MasterDataTab.jsx`:**
- Tambah `onAddNew={handleAddCategory}` pada `CategoryCombobox` di Bulk Category Modal
- `handleAddCategory` sudah ada dan ter-share — tidak perlu fungsi baru

**`backend/src/app.js`:**
- Tambah idempotent schema guard untuk tabel `product_categories` (STD-010)
- `CREATE TABLE IF NOT EXISTS product_categories (...)` + index pada kolom `name`

### Behavior Setelah Fix
1. User buka modal "Set Kategori Semua Produk"
2. Ketik nama kategori baru di field "Kategori *"
3. Dropdown tampilkan opsi "➕ Tambahkan '{nama}'"
4. Klik → kategori disimpan ke tabel `product_categories`, list ter-refresh
5. Kategori baru langsung tersedia sebagai pilihan

---

## CR-054 — Konfirmasi Sebelum Proses Pembayaran di Halaman Kasir (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: Low
- **Module**: Cashier → Payment Page (`/cashier/bayar/:txnId`)
- **Status**: RESOLVED

### Deskripsi
Tambah konfirmasi modal sebelum tombol "Proses Pembayaran" benar-benar memproses transaksi. Menghindari pemrosesan tidak sengaja (mis-click).

### Perilaku
1. Kasir klik **"Proses Pembayaran"** → muncul modal "Konfirmasi Pembayaran"
2. Modal menampilkan: ID Transaksi, Total, Metode Bayar, dan badge PRE-ORDER jika berlaku
3. Kasir klik **"Ya, Proses"** → pembayaran dieksekusi (flow seperti sebelumnya)
4. Kasir klik **"Batal"** → modal tutup, tidak ada perubahan

### Perubahan
**`frontend/src/pages/cashier/PaymentPage.jsx`:**
- Import `Modal` dari `../../components/ui/Modal`
- State baru `confirmModal` (boolean)
- `handleProcess(e)` — hanya membuka modal, tidak memanggil API
- `handleConfirmProcess()` — memanggil `processPayment` (dipanggil dari modal confirm)
- Modal konfirmasi menampilkan ringkasan transaksi sebelum proses

---

## CR-053 — Tab Pre-Order & Queue Fix di Halaman Kasir (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: Medium
- **Module**: Cashier Dashboard (`/cashier`)
- **Status**: RESOLVED

### CR1 — Tab "Pre-Order" Khusus Pembayaran Pre-Order
Tambah tab baru **"Pre-Order"** di antara tab Queue dan Processed.  
Menampilkan semua pre-order `status = 'PENDING'` (`order_type = 'PREORDER'`) yang menunggu pembayaran kasir — **tanpa filter tanggal**, karena pre-order bisa disetujui hari sebelum event.  
Setiap row menampilkan tanggal disetujui, tanggal dibuat, dan label "🔖 PRE-ORDER".  
Click row → navigasi ke `/cashier/bayar/:txnId` (flow pembayaran yang sudah ada).

### CR2 — Queue Tab Include Pre-Order Lintas Tanggal
Tab Queue sekarang juga menampilkan PENDING pre-orders dari hari manapun (bukan hanya hari ini).  
Setiap pre-order di Queue tab ditandai badge **"PRE-ORDER"** berwarna orange.

**Root cause fix:** `getPaymentQueue` sebelumnya punya `AND DATE(t.created_at) = $1` yang memblokir pre-order yang dibuat di hari sebelumnya.

### Perubahan
**`backend/src/modules/cashier/cashier.service.js`:**
- `getPaymentQueue`: tambah `OR (t.status = 'PENDING' AND t.order_type = 'PREORDER')` — bypass date filter untuk pre-orders
- Fungsi baru `getPreorderPaymentQueue()` — hanya PENDING pre-orders, tanpa date filter, diurutkan `approved_at ASC`

**`backend/src/modules/cashier/cashier.router.js`:**
- Route baru `GET /cashier/preorder-queue`

**`frontend/src/api/cashier.js`:**
- Export `getPreorderPaymentQueue`

**`frontend/src/pages/cashier/CashierDashboardPage.jsx`:**
- Tab baru "Pre-Order" (orange, badge count)
- Queue tab: badge "PRE-ORDER" per row + `order_type` dari backend
- Pre-Order tab: list lengkap dengan tanggal disetujui + belum dibayar label

---

## CR-052 — Barcode Transaksi di Halaman Tracking Pre-Order (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: Low
- **Module**: Customer → Order Tracking Page (`/pesanan/:id`)
- **Status**: RESOLVED

### Deskripsi
Pada halaman tracking pesanan `/pesanan/ID`, jika pesanan adalah **Pre-Order**, tampilkan barcode transaksi (Code128) di bawah stepper. Tujuan: memudahkan helper memverifikasi dan mencari barang pre-order milik customer tanpa harus membaca/mengetik ID manual.

### Perubahan
**`frontend/src/pages/customer/OrderTrackingPage.jsx`:**
- Import `Barcode` dari `react-barcode`
- Tambah section "🔖 Barcode Transaksi" di dalam blok pre-order stepper
- Barcode format Code128, value = `transaction_id`
- Label: "Tunjukkan ke petugas booth untuk verifikasi"

**`frontend/package.json`:**
- Tambah dependency `react-barcode@1.6.1`

---

## CR-051 — Penyempurnaan Approval Pre-Order di Helper Page (2026-06-17)
- **Date**: 2026-06-17
- **Reporter**: Admin
- **Severity**: Medium
- **Module**: Helper Page → Approval Pre-Order tab
- **Status**: RESOLVED

### CR1 — PENDING_APPROVAL Pre-Order Masuk ke Tab "Approval Pre-Order"
Pre-order dengan status `PENDING_APPROVAL` harus tampil di tab "Approval Pre-Order" (tidak hanya PAID).  
Tab kini menampilkan dua seksi:
- **Menunggu Approval** — `PENDING_APPROVAL` pre-orders (belum disetujui Helper)
- **Sudah Dibayar** — `PAID` pre-orders (siap diproses pengiriman)

Backend: `GET /helper/preorder-queue` (renamed dari `/preorder-paid`) mengembalikan `IN ('PENDING_APPROVAL', 'PAID')`, diurutkan PENDING_APPROVAL lebih dulu.

### CR2 — Form "Setujui Pre-Order" Auto-Fill Data Customer
Form shipping saat Helper approve pre-order kini terisi otomatis:
- **Nama Penerima** → `customer_name` dari data registrasi customer
- **No. HP Penerima** → `customer_phone` dari data registrasi customer
- **Alamat Lengkap** → Default: `"Event Amazing Toy Show Gandaria City"`

Helper tetap bisa mengubah nilai default sebelum submit.

---

## CR-050 — Fitur Pre-Order (Sub-feature A + B)
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: High
- **Module**: Orders → Pre-Order System (Backend + Frontend)
- **Status**: RESOLVED — see resolution.md RC-050

### Deskripsi
Implementasi sistem Pre-Order lengkap dengan dua sub-fitur:
- **Sub-feature A**: Helper/Admin input order pre-order manual untuk customer (produk display-only atau HK belum dibuka). Helper isi alamat pengiriman saat order.
- **Sub-feature B**: Customer self-order produk pre-order via katalog di mode HELPER_APPROVE. Cart campuran (pre-order + reguler) ditolak. Helper isi alamat pengiriman saat approval.

### Status Flow
`PENDING_APPROVAL → PENDING → PAID → AWAITING_SHIPMENT → ARRIVED → PREORDER_HANDOVER → COMPLETED`
SHIPPED dihapus dari flow baru (CR-050). EXPIRED jika timer habis setelah approve (tidak ada restore stok — stok tidak pernah dikurangi).

### Implementation Summary
- Pre-order items TIDAK PERNAH mengurangi stok (createOrder, createHelperOrder, approveOrder, approveItem)
- Mixed cart (pre-order + reguler) ditolak di mode HELPER_APPROVE
- `order_type = PREORDER` disimpan di transactions
- Kolom shipping_* disimpan di transactions
- Notifikasi WA: Confirmed, Shipped, Arrived, Completed, Cancelled, Expired
- AWAITING_SHIPMENT → ARRIVED langsung (tanpa SHIPPED)
- ProductPreorderTogglePage baru untuk Helper mengelola toggle pre-order produk

---

## CR-FEAT-002 — Tampilkan Status Pre-Order di Halaman /product/:id
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: Medium
- **Module**: Customer → /product/:id → MockProductDetailPage
- **Status**: RESOLVED — see resolution.md RC-23

### Deskripsi
Halaman detail produk `/product/:id` belum menampilkan indikator Pre-Order. Customer yang membuka detail produk pre-order tidak mendapat informasi bahwa produk tersebut adalah pre-order, estimasi kedatangan, maupun penjelasan alur pembelian.

### Expected
- Badge "PRE-ORDER" overlay di bagian bawah gambar hero
- Badge "Pre-Order" (orange) menggantikan badge stok di baris tenant name
- Info box Pre-Order (amber) di bawah harga berisi: judul "Produk Pre-Order", `preorder_note`, dan catatan alur pembayaran

### Root Cause
Lihat RC-23 di resolution.md.

---

## CR-FEAT-001 — Tampilkan Status Pre-Order di Halaman /katalog
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: Medium
- **Module**: Customer → /katalog → ProductCard + filter chip
- **Status**: RESOLVED — see resolution.md RC-22

### Deskripsi
Halaman `/katalog` belum menampilkan indikator Pre-Order pada kartu produk maupun opsi filter untuk produk pre-order. Admin meminta status pre-order disisipkan di catalog agar customer dapat melihat produk mana yang berstatus pre-order.

### Expected
- Badge "PRE-ORDER" muncul di pojok kiri atas gambar produk (overlay)
- Label "Pre-Order" menggantikan badge stok di bawah harga
- Catatan pre-order (`preorder_note`) tampil di bawah nama produk
- Chip filter "🔖 Pre-Order" di atas grid untuk menyaring hanya produk pre-order

### Root Cause
Lihat RC-22 di resolution.md.

---

## CR-BUG-011 — Toggle Pre-Order Reset ke OFF Setiap Keluar Aplikasi
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: High
- **Module**: Admin → Master Data → Edit Produk → Toggle Pre-Order
- **Status**: RESOLVED — see resolution.md RC-21

### Deskripsi
Toggle "Produk ini adalah Pre-Order" pada form Edit Produk tidak persist. Setelah toggle di-ON-kan dan disimpan, saat form dibuka kembali toggle kembali ke posisi OFF — meskipun nilai sudah tersimpan dengan benar di database.

### Symptom
- Produk `TZKH-020B` (Astro Boy): DB menyimpan `is_preorder = true`, `preorder_note = 'Estimasi kedatangan agustus 2026'`
- Form Edit Produk selalu menampilkan toggle = OFF saat dibuka
- Save ulang dengan toggle ON → tersimpan → keluar → buka lagi → OFF kembali
- Efek: produk yang seharusnya pre-order diperlakukan sebagai produk regular di semua flow (kasir, customer, checkout)

### Root Cause
Lihat RC-21 di resolution.md.

---

## CR-BUG-001 — Odoo Integration Tidak Aktif Setelah Konfigurasi Admin
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: High
- **Module**: Admin → Integrasi → Integration with Odoo
- **Status**: RESOLVED — see resolution.md

### Deskripsi
Setelah admin mengubah konfigurasi Odoo di halaman `/admin` tab Integrasi, sistem tidak terintegrasi meski URL dan DB sudah diisi.

### Symptom
- `odoo_base_url = https://demo-260614a.odoo.com/` dan `odoo_db = demo-260614a` tersimpan
- Status badge tetap "○ Nonaktif"
- Product sync dan stock sync tidak berjalan
- Scheduler job menghasilkan error log berulang meski Odoo belum dikonfigurasi

---

## CR-BUG-002 — Perubahan Konfigurasi Odoo Tidak Langsung Berlaku di Integration Service
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: High
- **Module**: Admin → Integrasi → Integration with Odoo → hybrid_integration container
- **Status**: RESOLVED — see resolution.md RC-6

### Deskripsi
Setelah admin menyimpan konfigurasi Odoo baru via UI, `hybrid_integration` service tetap terhubung ke instance Odoo lama (session cached). Perubahan hanya berlaku setelah container restart manual.

### Symptom
- Admin ubah URL/DB/password di Admin UI → disimpan ke DB ✓
- `hybrid_backend` baca dari DB saat request → langsung pakai config baru ✓
- `hybrid_integration` masih pakai session lama / credentials lama — tidak tahu ada perubahan ✗

### Root Cause
Lihat RC-6 di resolution.md.

---

## CR-BUG-003 — Transaksi Tidak Masuk ke Odoo demo-260614a
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: High
- **Module**: Integration → Order Push → Odoo Sale Order
- **Status**: RESOLVED — see resolution.md RC-8, RC-9

### Deskripsi
Transaksi `TXN-20260616-00139` tidak muncul di `https://demo-260614a.odoo.com/`. Order push ke Odoo gagal.

### Symptom
- Payment berhasil di SOS (status = PAID) ✓
- Webhook `ORDER_PAID` dikirim ke integration service ✓
- Order tidak muncul di Odoo `demo-260614a` ✗
- Integration service log menunjukkan auth ke `edu-student4.odoo.com` (instance lama)

### Root Cause
Lihat RC-8 di resolution.md.

---

## CR-BUG-004 — Customer & Sales Person Tidak Sesuai di Odoo Sale Order
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: Medium
- **Module**: Integration → Order Push → Customer Sync
- **Status**: RESOLVED — see resolution.md RC-10, RC-11

### Deskripsi
- Field **Customer** di Odoo Sale Order menampilkan "ST CORP" (nama perusahaan) alih-alih nama asli customer SOS ("Roy")
- Field **Sales Person** di Odoo Sale Order selalu menampilkan user API login (Aris, uid=26) karena `user_id` tidak di-set di `orderVals`

### Symptom
- TXN-20260616-00139: customer SOS = "Roy", phone = 081180003939
- Phone `081180003939` sudah terdaftar di Odoo sebagai contact dari company "ST CORP" (is_company=False, parent_id≠null)
- `resolveOrCreatePartner` step 2 (phone lookup) menemukan partner ini dan update nama-nya jadi "ST CORP" → salah
- `orderVals.user_id` tidak pernah di-set → Odoo assign authenticated API user sebagai salesperson → Aris

### Root Cause
Lihat RC-10 dan RC-11 di resolution.md.

---

## CR-RECEIPT-001 — ThermalReceipt Redesign & Logo
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: Medium
- **Module**: Cashier → Print Receipt
- **Status**: RESOLVED

### Deskripsi
- Logo di receipt masih ToyIcon bukan gambar logo event golden sun
- Section "Collect Your Items At" terlalu besar (24px), perlu dikurangi
- Format receipt tidak sesuai receipt-sample.html

---

## CR-BUG-005 — Total Odoo Salah: 900,900 Alih-alih 1,110,000 (Tax Anomali)
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: High
- **Module**: Integration → Order Push → sale.order.line → tax_id
- **Status**: RESOLVED — see resolution.md RC-12

### Deskripsi
Transaksi `TXN-20260616-00143` → `MYE/SO/2026/00415` menunjukkan total yang salah di Odoo.

### Symptom
- SOS: subtotal = 1,000,000, PPN 11%, expected total = 1,110,000
- Odoo: subtotal = 900,900, PPN 11%, total = 1,000,000 (bukan 1,110,000)
- Angka 900,900 = 1,000,000 ÷ 1.11 (tanda bahwa Odoo back-calculate tax dari price_unit)

### Root Cause
Lihat RC-12 di resolution.md.

---

## CR-NOTE-001 — Tambah Transaction ID ke Payment Note di Odoo Sale Order
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: Low
- **Module**: Integration → Order Push → sale.order note
- **Status**: RESOLVED — see resolution.md RC-20

### Deskripsi
Field `note` di Odoo sale order tidak mencantumkan Transaction ID (`TXN-YYYYMMDD-XXXXX`), sehingga sulit men-trace order Odoo mana yang berasal dari transaksi SOS mana tanpa membuka detail order satu per satu.

### Symptom
- Sale order Odoo: field `note` berisi payment method, cashier, dll — tanpa TXN ID
- Contoh note sebelumnya: `Payment Method: QRIS | Ref: - | Cash Received: Rp 0 | ...`
- Admin harus lookup manual via field `origin` atau `x_studio_sos_transaction_id`

### Expected
Note format: `TXN: TXN-20260616-00155 | Payment Method: QRIS | Ref: - | ...`

### Root Cause
Lihat RC-20 di resolution.md.

---

## CR-BUG-010 — Tax Salah di sale.order dan account.move: 11% INC Bukan Tax ID 234
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: High
- **Module**: Integration → Order Push → sale.order.line + account.move.line
- **Status**: RESOLVED — see resolution.md RC-18, RC-19

### Deskripsi
Order yang masuk ke Odoo menggunakan tax "11% (INC)" (default produk) bukan Tax ID 234 "12% (Non-Luxury Good)" yang dikonfigurasi di Admin → Pajak & SPT. Baik `sale.order` maupun `account.move` (invoice) terpengaruh karena invoice copy taxes dari SO lines.

### Symptom
- SO lines di Odoo: `tax_id = [11% (INC)]` → total Odoo = 1,000,000 (price-inclusive), SOS total = 1,110,000 → mismatch 110,000
- Invoice `account.move`: sama, copy dari SO lines → amount_total = 1,000,000 bukan 1,110,000

### Root Cause
Lihat RC-18 dan RC-19 di resolution.md.

**Final root cause (RC-19)**: field name pajak di `sale.order.line` pada Odoo Online `demo-260614a` adalah `tax_ids` (bukan `tax_id` yang selama ini dikirim). Semua error "Invalid field 'tax_id'" yang berulang disebabkan field name salah. `fields_get` mendeteksi field name yang benar; `ir.model.fields` tidak reliable di Odoo SaaS.

---

## CR-BUG-009 — GRP-20260616-0008: Order Push Gagal Loop Karena RC-16 Kirim tax_id ke Odoo yang Tidak Support
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: High
- **Module**: Integration → Order Push → sale.order.line → tax_id
- **Status**: RESOLVED — see resolution.md RC-17

### Deskripsi
GRP-20260616-0008 (TXN-00149, TXN-00150) tidak terintegrasi ke Odoo. Bug berulang meski CR-BUG-008 sudah di-resolve.

### Symptom
- Log: `"Odoo RPC error [sale.order.create]: Invalid field 'tax_id' on model 'sale.order.line'"` — berulang setiap polling
- TXN-00149 dan TXN-00150 stuck `inFlight: true` tanpa `odoo_id`
- RC-16 mengirim `tax_id: [[6,0,[234]]]` tapi Odoo instance `demo-260614a` menolak field ini

### Root Cause
Lihat RC-17 di resolution.md.

---

## CR-BUG-008 — Tax Salah di Odoo: 11% (INC) Bukan Tax ID yang Dikonfigurasi
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: High
- **Module**: Integration → Order Push → sale.order.line → tax_id
- **Status**: RESOLVED — see resolution.md RC-16

### Deskripsi
Order yang di-push ke Odoo menggunakan tax "11% (INC)" (default tax dari product template), bukan Tax ID 234 "12% (Non-Luxury Good)" yang dikonfigurasi admin di halaman `/admin` → Pajak & SPT → "Odoo Tax ID (manual)".

**Case**: TXN-20260616-00147 & TXN-20260616-00148 → Odoo MYE/SO/2026/00418 & MYE/SO/2026/00419

### Symptom
- Odoo order lines menampilkan "11% (INC)" (dari product template default)
- `total_amount` di SOS = 1,110,000 (DPP + 11%)
- Odoo total = 1,000,000 (price-inclusive karena 11% INC diterapkan) — SALAH
- Startup log: `hasTaxIdField: false` → RC-14 gate mencegah `tax_id` dikirim

### Root Cause
Lihat RC-16 di resolution.md.

---

## CR-BUG-007 — GRP-20260616-0007 Tidak Terintegrasi ke Odoo
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: High
- **Module**: Integration → Order Push → sale.order.line → tax_id + Scheduler Dead-letter
- **Status**: RESOLVED — see resolution.md RC-14, RC-15

### Deskripsi
GRP (group transaction) `GRP-20260616-0007` berisi dua transaksi individual `TXN-20260616-00147` dan `TXN-20260616-00148` (masing-masing Rp 1.110.000, total Rp 2.220.000, customer "Roy") tidak muncul di Odoo.

### Symptom
- Kedua TXN berstatus PAID di SOS ✓
- `integration_xref` menunjukkan `sync_metadata: {"inFlight": true}`, `odoo_id = null` — terjebak sejak 06:50 UTC ✓
- Log integration: `"Odoo RPC error [sale.order.create]: Invalid field 'tax_id' on model 'sale.order.line'"` ✗
- TXN lama (`TXN-20260616-00140`, `TXN-20260616-00101`, `TXN-20260609-00043`) di-retry terus karena 404 dari SOS ✗

### Root Cause
Lihat RC-14 dan RC-15 di resolution.md.

---

## CR-BUG-006 — Helper Page: Harga Produk Tidak Include PPN & PPN Hardcode 12%
- **Date**: 2026-06-16
- **Reporter**: Admin
- **Severity**: Medium
- **Module**: Helper → Membuat Order → product list & cart summary
- **Status**: RESOLVED — see resolution.md RC-13

### Deskripsi
Di halaman `/helper`, panel "Membuat Order":
- Harga produk di list ditampilkan **pre-tax** (belum include PPN), berbeda dengan halaman lain (customer cart, product card) yang menampilkan harga **tax-inclusive**
- PPN di ringkasan pesanan hardcode `~12%` dan kalkulasi `* 0.12`, tidak membaca dari konfigurasi admin "Tarif PPN (%)" di halaman `/admin` → Pajak & SPT

### Symptom
- Produk "Lego Batman" harga Rp 1.000.000 (pre-tax), tapi PPN config = 11% → seharusnya tampil Rp 1.110.000 (incl. PPN)
- Label "PPN ~12%" dan kalkulasi `subtotal * 0.12` tidak sinkron dengan admin config

### Root Cause
Lihat RC-13 di resolution.md.
