# Change Request Log

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
