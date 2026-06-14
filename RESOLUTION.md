# Bug Resolution Report
**Project:** Amazing Toys Fair 2026 — Self-Order Kiosk (SOS) × Odoo 18 Integration  
**Date:** 2026-05-27  
**Resolved by:** clavis Development

---

## Daftar Bug (Index)

| ID | Tanggal | Symptom Singkat | Layer | Status | CR Terkait |
|---|---|---|---|---|---|
| [BUG-001](#bug-001) | 2026-05-27 | Transaksi tersync ke company salah (Odoo unauthorized company) | Integration | ✅ Resolved | CR-001, CR-009, CR-010 |
| [BUG-002](#bug-002) | 2026-05-27 | Semua produk `stock_quantity=0`, order diblokir | Integration | ✅ Resolved | CR-002, CR-003, CR-004, CR-005 |
| [BUG-003](#bug-003) | 2026-05-27 | `/katalog` tidak sync otomatis setelah admin update produk | Backend + Frontend | ✅ Resolved | CR-007, CR-008 |
| [BUG-004](#bug-004) | 2026-05-27 | TXN-20260527-00002 tidak tersync ke Odoo SO | Integration | ✅ Resolved | CR-006, CR-006b |
| [BUG-005](#bug-005) | 2026-05-27 | "Set Kategori" bulk modal menggunakan plain text input | Frontend | ✅ Resolved | CR-011 |
| [BUG-006](#bug-006) | 2026-05-27 | ComboboxField label kosong saat options load async | Frontend | ✅ Resolved | CR-012 |
| [BUG-007](#bug-007) | 2026-05-27 | "Website Not Found" saat akses app | Infra/DNS | ✅ Resolved | — |
| [BUG-008](#bug-008) | 2026-05-28 | Receipt `/pesanan/:id/receipt` masih tampilkan harga pre-tax | Frontend | ✅ Resolved | CR-014 |
| [BUG-009](#bug-009) | 2026-05-28 | Perubahan source frontend tidak reflected di running app | Infra/Docker | ✅ Resolved | — |
| [BUG-010](#bug-010) | 2026-05-28 | TXN-20260528-00014 delayed + duplicate SO di Odoo | Integration | ✅ Resolved | CR-016 |
| [BUG-011a](#bug-011a) | 2026-05-29 | `/pesanan/:id` masih tampilkan harga pre-tax | Frontend | ✅ Resolved | CR-023a |
| [BUG-011b](#bug-011b) | 2026-05-29 | `/product/:id` masih tampilkan harga pre-tax | Frontend | ✅ Resolved | CR-024 |
| [BUG-011](#bug-011) | 2026-05-28 | VoucherPoll CB-Flood blokir transaksi baru | Integration | ✅ Resolved | CR-017, CR-018, CR-019 |
| [BUG-012](#bug-012) | 2026-05-28 | Concurrent polling loops → intermittent CB trip | Integration | ✅ Resolved | CR-020 |
| [BUG-013](#bug-013) | 2026-05-30 | "Access denied. Required role: CUSTOMER" saat kasir klik Bayar POS | Backend | ✅ Resolved | CR-023 |
| [BUG-014](#bug-014) | 2026-05-31 | Limit "Maks Item per Order" tidak dienforce | Backend + Frontend | ✅ Resolved | CR-028 |
| [BUG-015](#bug-015) | 2026-06-04 | Migration 010 gagal: FK `customers(id)` tidak ditemukan | Database | ✅ Resolved | CR-029 |
| [BUG-016a](#bug-016a) | 2026-06-04 | Voucher tenant-scoped menerapkan diskon ke semua item | Backend + Integration | ✅ Resolved | CR-030 |
| [BUG-017a](#bug-017a) | 2026-06-06 | `FOR UPDATE` lock produk booth lain di `createHelperOrder` | Backend | ✅ Resolved | CR-035 |
| [BUG-018](#bug-018) | 2026-06-06 | "Role tidak valid" saat buat akun HELPER | Backend | ✅ Resolved | CR-038 |
| [BUG-019](#bug-019) | 2026-06-06 | Tombol "+ Cart" masih aktif saat `order_mode = HELPER_INPUT` | Frontend + Backend | ✅ Resolved | CR-035 |
| [BUG-020](#bug-020) | 2026-06-07 | WebSocket in-app notification tidak terkirim ke customer (CR-036 Layer 2) | Backend + Frontend | ✅ Resolved | CR-036, CR-038 |
| [BUG-023](#bug-023) | 2026-06-07 | Halaman POS Langsung (`/cashier/pos`) hilang / 404 | Frontend | ✅ Resolved | CR-023 |
| [BUG-024](#bug-024) | 2026-06-07 | POS Langsung diblokir di mode HELPER_INPUT + missing HP/barcode input | Backend + Frontend | ✅ Resolved | CR-023, CR-035 |
| [BUG-025](#bug-025) | 2026-06-07 | Gambar produk tidak tampil (broken image icon) | Frontend | ✅ Resolved | — |
| [BUG-026](#bug-026) | 2026-06-07 | Fitur voucher kasir hilang dari `/cashier/pos` dan PaymentPage | Backend + Frontend | ✅ Resolved | CR-037 |
| [BUG-027](#bug-027) | 2026-06-09 | Tombol "Setuju" tidak menghilangkan item dari antrian approval | Backend + Frontend | ✅ Resolved | CR-050 |
| [BUG-028](#bug-028) | 2026-06-08 | Barang `is_on_hold` tidak masuk "Disimpan untuk Nanti" saat checkout | Backend + Frontend | ✅ Resolved | CR-051 |
| [BUG-029](#bug-029) | 2026-06-09 | "Registration failed. Please try again." — backend crash `sharp` + PORT mismatch | Backend/Dev | ✅ Resolved | CR-052 |
| [BUG-030](#bug-030) | 2026-06-09 | `/katalog` produk tidak ter-load (`401 Authentication token required`) | Backend | ✅ Resolved | CR-045 |
| [BUG-031](#bug-031) | 2026-06-09 | QR Scanner kamera tidak bisa mendeteksi QR code | Frontend | ✅ Resolved | CR-046 |
| [BUG-032](#bug-032) | 2026-06-09 | Scan QR di `/katalog`: "Produk tidak ditemukan" | Frontend | ✅ Resolved | CR-047 |
| [BUG-033](#bug-033) | 2026-06-08 | `approveOrder` selalu gagal 500 (`FOR UPDATE` + `LEFT JOIN`) | Backend | ✅ Resolved | CR-048 |
| [BUG-034](#bug-034) | 2026-06-08 | Tab "Antrian Approval" tidak muncul (`usePublicConfig` cache poisoning) | Frontend | ✅ Resolved | CR-049 |
| [BUG-035](#bug-035) | 2026-06-10 | `<button>` nested di dalam `<button>` di ProductCard (React DOM warning) | Frontend | ✅ Resolved | CR-056 |
| [BUG-036](#bug-036) | 2026-06-10 | `LangDropdown is not defined` di CustomerShell (Vite HMR stale cache) | Frontend/Dev | ✅ Resolved | CR-057 |
| [BUG-037](#bug-037) | 2026-06-10 | `Download the React DevTools` muncul di console — React berjalan di dev mode | Frontend/Infra | ✅ Resolved | — |
| [BUG-038](#bug-038) | 2026-06-10 | Klik "-" pada qty pill langsung hapus item (qty=5 → 0, bukan 4) | Frontend | ✅ Resolved | — |
| [BUG-039](#bug-039) | 2026-06-10 | `/pesanan/:id` tidak auto-refresh setelah kasir proses pembayaran | Frontend | ✅ Resolved | — |
| [BUG-040](#bug-040) | 2026-06-11 | `approveItem` (per-item approval) selalu gagal 500 (`FOR UPDATE` on JOIN) | Backend | ✅ Resolved | CR-040 |
| [BUG-041](#bug-041) | 2026-06-11 | Antrian approval kosong — migration 017 belum diaplikasikan + `TxnExpireJob` kolom tidak ada | Database + Backend | ✅ Resolved | CR-040 |
| [BUG-042](#bug-042) | 2026-06-11 | Input qty di modal approve item tidak bisa diketik (snap ke 1) | Frontend | ✅ Resolved | CR-040 |
| [BUG-043](#bug-043) | 2026-06-11 | Route `POST .../items/:itemId/approve` not found — router lama di container | Backend/Deploy | ✅ Resolved | CR-040 |
| [BUG-044](#bug-044) | 2026-06-11 | `approveItem` 500 — `inconsistent types deduced for parameter $1` pada UPDATE `subtotal = unit_price * $1` | Backend | ✅ Resolved | CR-040 |
| [BUG-045](#bug-045) | 2026-06-11 | Kasir & customer tracking tampilkan qty original (5) bukan qty approved (3) | Frontend + Backend | ✅ Resolved | CR-040 |
| [BUG-046](#bug-046) | 2026-06-11 | Voucher `usage_limit=2` hanya bisa dipakai 1 kali — per-customer duplicate check terlalu ketat | Backend | ✅ Resolved | — |
| [CR-046](#cr-046) | 2026-06-11 | Auto-refresh approval queue tanpa blink — Virtual DOM smart merge + `React.memo` | Frontend | ✅ Done | CR-046 |
| [BUG-047](#bug-047) | 2026-06-11 | Receipt & pickup page tampilkan qty original bukan approved (ASTRO BOY ×4 harusnya ×2) | Frontend | ✅ Resolved | — |
| [CR-047](#cr-047) | 2026-06-11 | Urutkan produk `/katalog` berdasarkan status stok: Tersedia → Terbatas → Habis | Frontend | ✅ Done | CR-047 |
| [CR-048](#cr-048) | 2026-06-11 | Hide chip "X pcs / Stock" di halaman detail produk — hanya badge status yang tampil | Frontend | ✅ Done | CR-048 |
| [BUG-048](#bug-048) | 2026-06-12 | Tab "Antrian Approval" di `/helper` tampilkan kosong — migration DB tidak auto-apply + error ditelan diam | Database + Backend + Frontend | ✅ Resolved | — |
| [BUG-049](#bug-049) | 2026-06-12 | Semua screen blank — ternary chain tidak lengkap di `ApprovalQueueTab.jsx` (missing `: null`) | Frontend | ✅ Resolved | — |
| [CR-049](#cr-049) | 2026-06-12 | SPA navigation: ganti `window.location.href` di `api/client.js` dengan `CustomEvent + useNavigate` | Frontend | ✅ Done | — |
| [CR-041](#cr-041) | 2026-06-12 | OTP Login + Trusted Device: Email OTP untuk perangkat baru, skip OTP 30 hari, refresh token per device | Backend + Frontend | ✅ Done | — |
| [BUG-050](#bug-050) | 2026-06-12 | Serah Terima Outstanding tampilkan qty original bukan approved | Backend | ✅ Resolved | — |
| [BUG-051](#bug-051) | 2026-06-13 | Admin Master Data field "Kategori *" tidak ada menu tambah kategori | Backend + Frontend | ✅ Resolved | STD-009 |
| [CR-053](#cr-053) | 2026-06-13 | Delete Item Approval Workflow: kasir ajukan hapus item → leader approve/reject real-time via WebSocket | Backend + Frontend | ✅ Done | — |
| [BUG-052](#bug-052) | 2026-06-13 | `/daftar` & `/masuk` selalu tampil "Amazing Toys Fair 2026" hardcoded setelah rebuild — Docker image tidak meng-copy `data/`, tidak ada volume | Infra/Docker | ✅ Resolved | — |
| [CR-061](#cr-061) | 2026-06-13 | Fraud Protection: block delete item pada TRX PAID, amount_charged, ADD_ITEM audit log, fraud WS alert, discrepancy endpoint | Backend | ✅ Done | — |
| [BUG-053](#bug-053) | 2026-06-13 | QR Scanner tidak bekerja pada perangkat lama — tidak ada legacy getUserMedia polyfill, constraint cascade, play() guard, srcObject fallback | Frontend | ✅ Resolved | — |
| [BUG-054](#bug-054) | 2026-06-13 | Hapus item via CR-053/CR-061 tidak mengembalikan stok; PaymentPage delete button tidak dapat `product_id` dari API | Backend + Backend | ✅ Resolved | CR-053, CR-061 |
| [BUG-055](#bug-055) | 2026-06-13 | Page `/masuk` klik login → Internal server error — `customer_otps` & `customer_trusted_devices` belum ada di DB (tipe FK salah: `INTEGER` bukan `UUID`) | Database + Backend | ✅ Resolved | — |
| [BUG-056](#bug-056) | 2026-06-13 | TXN-20260613-00070 status `RESERVED` melewati `expires_at` tapi tidak otomatis EXPIRED — `TxnExpireJob` hanya sweep `PENDING`, tidak `RESERVED`/`WAITING_PAYMENT` | Backend/Scheduler | ✅ Resolved | — |
| [BUG-057](#bug-057) | 2026-06-13 | Tombol 🗑️ di `/cashier/bayar/:id` → Internal Server Error — `item_delete_requests.product_id` bertipe `INTEGER` sedangkan `products.product_id` adalah `VARCHAR(20)` | Database + Backend | ✅ Resolved | — |
| [BUG-058](#bug-058) | 2026-06-13 | Klik "Setujui" di `/leader/hapus-approval` → Internal Server Error — menghapus item terakhir transaksi menyebabkan `total_amount = 0`, melanggar `transactions_total_amount_check (total_amount > 0)` | Backend | ✅ Resolved | — |
| [BUG-059](#bug-059) | 2026-06-13 | Customer cancel transaksi yang sudah di-approve parsial oleh helper → stok kembali +4 (seharusnya +2) — `cancelOrder()` menggunakan `item.quantity` (original) bukan `item.approved_quantity` (yang benar-benar dikurangi) | Backend | ✅ Resolved | — |
| [BUG-060](#bug-060) | 2026-06-14 | Field "Batas Waktu Checkout (menit)" di admin tidak bisa diketik — `onChange` pakai `parseInt \|\| 30`, field snap balik ke 30 setiap user clear untuk mengetik ulang | Frontend | ✅ Resolved | — |
| [BUG-061](#bug-061) | 2026-06-14 | WA notifikasi "hampir kadaluarsa" tidak terkirim (TXN-20260613-00080) — 3 root cause: (1) `c.phone` harus `c.phone_number`, (2) status `PENDING` tidak dicakup, (3) kolom `wa_expiry_notif_sent_at` tidak ada di schema guard | Backend/Scheduler/Database | ✅ Resolved | — |
| [BUG-062](#bug-062) | 2026-06-14 | Registrasi `081180003939` — customer lapor "registrasi failed" padahal OTP terkirim — `sendOTP()` dipanggil sebelum `INSERT INTO pending_registrations`; jika DB gagal OTP terkirim tapi tidak bisa diverifikasi | Backend/Auth | ✅ Resolved | — |
| [BUG-063](#bug-063) | 2026-06-14 | Tour Guide popup di mobile muncul di paling bawah layar, overlap nav bar — `bottom: 0` tanpa clearance; teks "memesan makanan" (harusnya produk), "Navigating..." (harusnya Bahasa Indonesia), "Langkah X dari 16" (jumlah step tetap membingungkan) | Frontend/UX | ✅ Resolved | — |
| [BUG-064](#bug-064) | 2026-06-14 | Group Checkout gagal — migration `022_group_checkout.sql` tidak pernah diaplikasikan; tabel `transaction_groups` + kolom `group_id` tidak ada di DB | Database | ✅ Resolved | CR-054 |
| [BUG-065](#bug-065) | 2026-06-15 | Klik "Konfirmasi Bayar" di `/cashier/group-bayar` gagal 422 — validator `body('transaction_ids.*').isUUID()` menolak format `TXN-YYYYMMDD-NNNNN` yang bukan UUID | Backend | ✅ Resolved | CR-054 |
| [BUG-066](#bug-066) | 2026-06-15 | `/pesanan/:id` tidak auto-refresh setelah Group Checkout — backend broadcast `GROUP_ORDER_PAID` tapi frontend hanya subscribe `ORDER_PAID`; polling juga tidak cover `PENDING_APPROVAL` | Frontend + Backend | ✅ Resolved | CR-054 |
| [BUG-067](#bug-067) | 2026-06-15 | Group invoice `GRP-*` tidak bisa digunakan untuk ambil barang di halaman helper — `HandoverOutstandingPanel` hanya filter by `transaction_id`, tidak handle format `GRP-*`; `handoverOrder` tidak punya logik group sehingga item multi-booth saling merusak; setiap booth butuh independent handover | Frontend + Backend | ✅ Resolved | CR-054 |

---

## BUG-001 — Transaksi Tersync ke Company Salah / "Access to unauthorized or invalid companies"

**Symptom:**  
All 57 products failed during push-product-sync with:
```
Odoo RPC error [product.template.read]: Access to unauthorized or invalid companies
```
Transaksi TXN-20260527-00002 tersync ke company 1 ("Dev.clavis.retail-business") padahal seharusnya ke company 5 ("AMAZING TOYS").

**Root Cause (chain of failures):**

| # | Defect | Impact |
|---|---|---|
| 1 | User `project@clavis.co.id` (uid=10) tidak memiliki akses ke company 5 ("AMAZING TOYS") di Odoo — `company_ids=[1]` only | Semua RPC call gagal dengan "unauthorized or invalid companies" |
| 2 | Kode `authenticate()` punya silent fallback: jika configured company tidak ada di `allowed_companies`, diam-diam ganti ke company 1 | Order TXN-20260527-00002 dibuat di company 1, bukan AMAZING TOYS |
| 3 | `property_stock_customer=False` untuk semua partner di konteks company 5 | `action_confirm` gagal: "No rule has been found to replenish X in 'False'" |
| 4 | `resolveStartupRefs` domain customer location filter `company_id=companyId`, tapi `Partners/Customers` adalah lokasi global (company_id=False) | `customerLocationId=null` → `property_stock_customer` tidak pernah di-set saat create partner |
| 5 | `stock.rule` id=55 ("WH.1: False → Customers") punya `location_src_id=False` — warehouse AMAZING TOYS dikonfigurasi dengan salah | Confusing error messages, delivery route ambiguous |

**Fixes:**
1. **Odoo**: Grant company 5 ke user uid=10 via RPC: `write('res.users', [10], { company_ids: [[4, 5]], company_id: 5 })`
2. **`odoo.client.js` `authenticate()`**: Ubah silent fallback menjadi hard `throw` — integrasi tidak boleh pernah menggunakan company yang berbeda dari yang dikonfigurasi karena seluruh data order, produk, dan stok akan masuk ke company yang salah.
3. **`odoo.client.js` `resolveStartupRefs()`**: Fix domain customer location: hapus filter `company_id=companyId`, ganti dengan `company_id=False` (shared/global location).
4. **`customer.sync.js`**: Set `property_stock_customer` pada operasi UPDATE (step 1/2/3) juga, bukan hanya CREATE (step 4) — agar existing partner yang belum punya property ini langsung terfix.
5. **Odoo**: Fix `stock.rule` id=55 `location_src_id` dari `False` → `Partners/Vendors` (id=4).
6. **Odoo**: Set `property_stock_customer=5` (Partners/Customers) untuk semua partner yang digunakan di sale orders company 5.
7. **Data**: Cancel order S00028 dan S00029 (salah masuk company 1), hapus xref, biarkan polling re-create di company 5.

**Files Changed:**
- `integration/src/clients/odoo.client.js`
- `integration/src/services/customer.sync.js`

**Recurrence Prevention:**
- `authenticate()` sekarang `throw` (bukan warn+fallback) jika configured company tidak accessible → integrasi gagal boot dan admin harus fix Odoo permissions terlebih dahulu
- `customerLocationId` sekarang resolved dengan benar → `property_stock_customer` di-set otomatis untuk setiap partner baru maupun yang di-update
- Semua order baru akan masuk ke company 5 (AMAZING TOYS)

---

## BUG-002 — Product "Outdoor Bubble Kit XL" stock_quantity=0, Blocking Orders

**Symptom:**  
Order attempted for "Outdoor Bubble Kit XL"; kiosk returned:
```
Produk 'Outdoor Bubble Kit XL' tidak tersedia dalam jumlah yang diminta
```
All 57 products had `stock_quantity=0` despite physical stock being present.

**Root Cause (three compounding defects):**

| # | Defect | Location |
|---|---|---|
| 1 | `product.sync.js` (Odoo→SOS pull) was writing `stock_quantity: stockQty` where `stockQty` came from Odoo consumable products — which always report `qty_available=0` | `integration/src/services/product.sync.js` |
| 2 | `stock.sync.js` filter was `['type', '=', 'consu']` (consumable), fetching the wrong product type; the comment directly above said "storable products only" | `integration/src/services/stock.sync.js` |
| 3 | 26 `integration_xref` entries for push-sync products were accidentally `CANCELLED` by a cleanup sweep; the `upsertXref` `ON CONFLICT` clause did not restore `status='ACTIVE'`, so those entries were skipped in subsequent syncs | `integration/src/services/push.product.sync.js` |

**Fixes:**
1. **product.sync.js**: Removed `stock_quantity` and `stock_status` from the PATCH payload. SOS owns stock independently for event inventory; the product sync must not overwrite it.
2. **stock.sync.js**: Changed filter `['type', '=', 'consu']` → `['type', '=', 'product']` (storable only, as the existing comment intended).
3. **push.product.sync.js**: Added `status='ACTIVE'` to the `ON CONFLICT DO UPDATE` clause so accidentally-cancelled xref entries are restored on the next push-product-sync run.

Also changed `buildProductVals` `type` from `'consu'` to `'service'` (no stock tracking, no delivery order, `action_confirm` always works without route configuration). This applies to all **new** Odoo products; existing products cannot be changed after they appear in stock moves.

**Database Fix Applied:**  
All 56 affected products restored to `stock_quantity=20` via direct SQL update.

**Files Changed:**
- `integration/src/services/product.sync.js`
- `integration/src/services/stock.sync.js`
- `integration/src/services/push.product.sync.js`

---

## BUG-003 — `/katalog` Data Out of Sync with `/admin` Master Data

**Symptom:**  
Changes made in Admin → Master Data (create/update/delete products) were not reflected in the `/katalog` customer-facing page without a full browser refresh.

**Root Cause (two independent gaps):**

| # | Defect | Location |
|---|---|---|
| 1 | Admin product write endpoints did not broadcast a WebSocket event after mutating product data — catalogue had no signal that data changed | `backend/src/modules/admin/admin.router.js` |
| 2 | `useCatalogueState` hook fetched data only once on mount; it had no WebSocket listener and no re-fetch on browser tab visibility change | `frontend/src/hooks/useCatalogueState.js` |

**Fixes:**
1. **admin.router.js**: Added `broadcastToAll({ event: 'PRODUCT_UPDATED' })` after every successful product mutation: `POST /products` (create), `PATCH /products/:id` (update), `DELETE /products/:id` (deactivate), and all three bulk-update endpoints.
2. **useCatalogueState.js**: 
   - Extracted fetch logic into a reusable `loadData` callback guarded by a `fetchingRef` ref to prevent concurrent fetches.
   - Added `document.addEventListener('visibilitychange', ...)` to re-fetch when the user returns to the tab.
   - Added `subscribe('PRODUCT_UPDATED', loadData)` via `useWebSocket` hook for real-time updates.
   - Increased product fetch limit from 200 → 500.

**Files Changed:**
- `backend/src/modules/admin/admin.router.js`
- `frontend/src/hooks/useCatalogueState.js`

---

## BUG-004 — TXN-20260527-00002 Not Synced to Odoo Sales Order

**Symptom:**  
Transaction `TXN-20260527-00002` (customer: Yasmin Salsabila, total: Rp 140,000, payment: PAID) did not appear as a confirmed sales order in Odoo.

**Root Cause (chain of events):**

1. The initial order push created Odoo draft sale.order `S00028` successfully.
2. `action_confirm` failed with: `"No rule has been found to replenish 'Outdoor Bubble Kit XL' in 'False'"` — product type was `consu` (consumable) and the Odoo warehouse had no outbound route configured (source location resolved to `False`).
3. The `_reConfirmOrder` retry logic applied the fallback route (Buy, id=33) to the order lines and retried — this **succeeded**, confirming the order (`state=sale`, `locked=true`).
4. However, the integration's `sync_metadata` was left with a stale `manualConfirmRequired: true` flag from a prior code path, making the integration appear to think the order was still unconfirmed.

**Fix:**
- Cleared the stale `manualConfirmRequired` flag from `integration_xref` — the order was already confirmed.
- Fixed `_reConfirmOrder` to use `confirmFailed: true` (keeps polling active) instead of `manualConfirmRequired: true` (permanently silences retries) when a route error occurs.
- `_reConfirmOrder` now checks if the order reached `state='sale'` or `state='done'` externally; if so, it clears `confirmFailed` and returns success — prevents the flag from persisting after out-of-band resolution.

**Final State:**
- Odoo S00028: `state=sale`, `locked=true`, partner=Yasmin Salsabila ✓
- `integration_xref`: `status=ACTIVE`, no stale flags, `odoo_id=28` ✓

**Files Changed:**
- `integration/src/services/order.push.js`

**Recurrence Prevention:**  
For future orders: `_doPushOrder` applies the fallback "Buy" route to order lines on the first route error and immediately retries `action_confirm`. New products pushed via push-product-sync are created as `type='service'`, which eliminates the route requirement entirely. Existing `consu` products cannot be changed (Odoo constraint), but the fallback route mechanism handles them transparently.

---

## BUG-005 — "Set Kategori" Bulk Modal Uses Plain Text Input (No Lookup)

**Symptom:**  
Admin → Master Data → "Set Kategori" modal displayed a free-form text field. Users could type arbitrary text instead of selecting from the registered category list ("Action Figure", "Anime", "Lego", etc.), allowing invalid categories to be bulk-applied to all products.

**Root Cause:**  
The Bulk Category Modal used a plain `<Input>` component instead of `<CategoryCombobox>`. The `categories` state (loaded from `GET /products/categories` via `getCategories()`) was available in scope and already wired to `CategoryCombobox` in the individual product edit form, but was never passed to the bulk modal.

**Fix:**  
Replaced `<Input>` with `<CategoryCombobox categories={categories}>` in the Bulk Category Modal. The combobox shows only registered categories, filters by what the user types, and prevents free-form input from bypassing the category list.

**Files Changed:**
- `frontend/src/pages/admin/tabs/MasterDataTab.jsx`

---

## BUG-006 — "Set Kategori Odoo" Combobox Displays Blank Label When Categories Load Asynchronously

**Symptom:**  
In Admin → Master Data, opening the edit product form for a product with an existing `odoo_categ_id` showed a blank Kategori Odoo field instead of the category name. Separately, if the "Set Kategori Odoo" modal was opened before the Odoo category list finished loading, the pre-selected category showed no label after categories loaded.

**Root Cause:**  
`ComboboxField.jsx` had a `useEffect` that synced display text when `value` changed, but `options` was intentionally excluded from the dependency array. When `odooCategories` loaded asynchronously (after the form or modal was already open with a selected `value`), the effect did not re-run, leaving the display blank even though the option now existed in the list.

**Fix:**  
Added a second `useEffect` in `ComboboxField.jsx` that watches `[options]`. When the options array changes and a `value` is already selected, it finds the matching option and updates the display text. The guard `if (value == null) return` prevents it from interfering with free-text search (where `value` is null while the user is typing).

**Files Changed:**
- `frontend/src/components/ui/ComboboxField.jsx`

---

## BUG-007 — "Website Not Found" Error When Accessing the App

**Symptom:**  
Browser shows a "Website not found — Sorry, Please confirm that this domain name has been bound to your website." page with a crown logo instead of the app UI.

**Root Cause:**  
The error page is served by a **domain registrar or hosting provider** (e.g., Alibaba Cloud, Tencent Cloud), not by this application. It appears when a custom domain name is entered in the browser but the domain is either:
1. Not pointed to this server's IP address (DNS not configured), or
2. The app is running locally and the user typed a domain URL instead of `localhost`.

The app's Nginx container was running correctly on `0.0.0.0:80` — the issue was purely at the URL/DNS level.

**Resolution:**  
Access the app via `http://localhost` when running locally with Docker Compose.

If deploying to a live server and using a custom domain:
1. Point the domain's A record to the server's public IP.
2. Wait for DNS propagation (up to 48h).
3. Then access via the domain name.

**Files Changed:**  
None — configuration/access issue only.

---

## BUG-008 — Receipt at `/pesanan/:id/receipt` Still Shows Pre-Tax Item Prices & Subtotal Row

**Symptom:**  
The digital receipt page (e.g., `/pesanan/TXN-20260528-00008/receipt`) shows:
- Item prices at **pre-tax** unit cost
- A **"Subtotal (N items)"** row
- A **"PPN X%"** row
…instead of tax-inclusive item prices with only a TOTAL row, as specified in CR-014.

**Root Cause:**  
CR-014 patched `ThermalReceipt.jsx` (used inside the cashier's print modal) and `print.service.js` (ESC/POS thermal print path), but **`ReceiptPickupPage.jsx`** contains its **own independent inline receipt renderer** (lines 122–155) that was never touched. This component is the page rendered at `/pesanan/:transactionId/receipt` for both customers and staff.

The duplicate renderer had:
- `formatRupiah(item.unit_price * item.quantity)` — pre-tax price
- `{hasTax && <span>Subtotal …</span>}` and `{hasTax && <span>PPN X%…</span>}` rows still present

**Resolution:**  
Updated `ReceiptPickupPage.jsx` to match the CR-014 spec:
1. Item price changed to `Math.round(item.unit_price * item.quantity * (1 + taxRate / 100))` — tax-inclusive, display-only.
2. Subtotal and PPN rows removed entirely.
3. Only the TOTAL row (sourced from `order.total_amount`) remains.

**Files Changed:**  
- `frontend/src/pages/customer/ReceiptPickupPage.jsx`

**Prevention:**  
Receipt layout changes must be applied to **all three** rendering paths:
1. `ThermalReceipt.jsx` — cashier print modal on-screen preview
2. `print.service.js` — ESC/POS thermal printer output
3. `ReceiptPickupPage.jsx` — customer/staff digital receipt page (`/pesanan/:id/receipt`)

---

## BUG-009 — Frontend Source Changes Not Reflected in Running App (Docker Build Cache)

**Symptom:**  
After correctly patching `ThermalReceipt.jsx` and `ReceiptPickupPage.jsx` for CR-014, the Print receipt modal and `/pesanan/:id/receipt` page still rendered pre-tax item prices and the old Subtotal/PPN rows. Running `npm run build` locally had no effect.

**Root Cause:**  
The frontend is served from a Docker container (`sos_frontend`) built via a **multi-stage Dockerfile**:
```
FROM node:20-alpine AS build  →  npm ci + npm run build
FROM nginx:1.27-alpine        →  COPY dist → /usr/share/nginx/html
```
The image bakes the JS bundle at **image-build time**. Editing source files or running `npm run build` locally only updates `frontend/dist/` on the host — the running container keeps serving its own stale image. There is no volume mount for the frontend dist.

**Resolution:**  
Rebuilt the Docker image and restarted the container:
```bash
docker compose build frontend
docker compose up -d frontend
```
Container recreated (`sos_frontend Recreated`), HTTP 200 confirmed on `http://localhost/`.

**Files Changed:**  
None — operational fix only (image rebuild + container restart).

**Prevention:**  
Any change to frontend source files requires:
```bash
docker compose build frontend && docker compose up -d frontend
```
This applies to **all** frontend changes — React components, CSS, assets, env-baked config. Do not assume `npm run build` on the host is sufficient while Docker is running.

---

## BUG-010 — TXN-20260528-00014 Delayed Integration + Duplicate SO Created in Odoo

**Symptom:**  
Transaction `TXN-20260528-00014` appeared "not integrated" to Odoo. The transaction was PAID at 12:01 WIB but the integration was delayed by ~8 minutes. Additionally, **2 duplicate sale orders** were found in Odoo for the same transaction: `S00045` and `S00046`.

**Root Cause (chain of 4 failures):**

| # | Defect | Impact |
|---|---|---|
| 1 | **Voucher polling limit = 50 + concurrent** — the `VoucherPoll` job processed all 13 backlogged transactions sequentially, making ~90 Odoo API calls in rapid succession → hit Odoo Online rate limit → `cb.recordFailure('odoo')` × 5 → **circuit breaker opened** | New real-time webhook events blocked for 2 minutes (CB reset time) |
| 2 | **Webhook fires voucher even if pushOrder failed** — `pushOrder().then(() => pushVoucher())` always fires voucher regardless of pushOrder result; when CB is open, both jobs are queued as retries | Double retry entries per transaction, increasing Odoo call volume on CB reset |
| 3 | **No in-flight guard on SO creation** — when CB reset, both the retry queue AND the polling fallback picked up the same transaction simultaneously; both called `_doPushOrder`, both found xref=null, both created an SO in Odoo | Duplicate SO: `S00045` + `S00046` for same transaction |
| 4 | **`x_studio_sos_transaction_id` field not in Odoo** — idempotency check via custom Odoo field disabled, removing the last line of defence against SO duplication | Odoo-side deduplication not possible; relies entirely on local xref |

**Fixes Applied — 2026-05-28:**

1. **`scheduler.js`** — reduced polling `LIMIT 100→5` for ORDER_PUSH and `LIMIT 50→5` for VoucherPoll; both loops made `await` (sequential with natural back-pressure). Prevents CB from opening under bulk processing.

2. **`webhook.router.js`** — `pushOrder().then(() => pushVoucher())` changed to only call `pushPaymentVoucher` when `result.success === true`. If pushOrder is blocked by CB, voucher is picked up by VoucherPoll on next cycle.

3. **`order.push.js`** — added `inFlight` guard: writes `{inFlight: true}` to `integration_xref` (with `odoo_id=null`) **before** calling Odoo to create the SO. Any concurrent run that finds an `inFlight` entry within the last 60s backs off immediately. Cleared when SO is upserted with real `odoo_id`.

4. **Odoo data fix** — duplicate `S00045` (no invoice, state=sale) cancelled via `sale.order.cancel` wizard. `S00046` retained as the authoritative record.

**Files Changed:**
- `integration/src/routes/webhook.router.js`
- `integration/src/scheduler/scheduler.js`
- `integration/src/services/order.push.js`

**Correlation with CR.md:**
- **CR-015** (Payment Voucher Integration) introduced VoucherPoll which — without polling rate limits — caused CB to open under backlog conditions, triggering this bug.
- The fix is additive to CR-015; no voucher logic changed.

**Prevention:**
- Polling batch size must remain ≤ 5 to avoid triggering Odoo Online rate limits (typically 100 req/min on trial instances).
- Any new polling loop must be `await` (sequential) with a hard `LIMIT ≤ 5`.
- The `inFlight` guard in `order.push.js` must be preserved for all future SO push paths.

---

## BUG-011a — `/pesanan/:transactionId` Masih Tampilkan Harga Pre-Tax

**Symptom:**  
Halaman order tracking (`/pesanan/TXN-xxx`) menampilkan harga item dan subtotal edit modal masih **pre-tax** (base price × quantity), tidak konsisten dengan `/katalog`, `/keranjang`, dan receipt yang sudah tax-inclusive sejak CR-022 dan BUG-008.

**Root Cause:**  
CR-022 mencakup `ProductCard.jsx`, `ProductBottomSheet.jsx`, `CartPage.jsx` — tetapi `OrderTrackingPage.jsx` terlewat. BUG-008 memperbaiki `ReceiptPickupPage.jsx` (path `/pesanan/:id/receipt`), tetapi halaman parent `/pesanan/:id` sendiri belum disentuh.

**Resolution:**  
Display-only fix pada `OrderTrackingPage.jsx`:
1. Tambah import `usePublicConfig` dari `../../hooks/useAppLogo`
2. Tambah `const ppnRate = parseFloat(config?.ppn_rate) || 0;`
3. Harga item: `formatRupiah(Math.round(item.unit_price * item.quantity * (1 + ppnRate / 100)))`
4. Subtotal edit modal: `formatRupiah(Math.round(editItem.unit_price * editQty * (1 + ppnRate / 100)))`

`order.total_amount` di header tidak diubah — sudah include tax sejak tersimpan di DB.

**Files Changed:**  
- `frontend/src/pages/customer/OrderTrackingPage.jsx`

**Prevention:**  
Perubahan harga tampilan harus diterapkan ke **semua** jalur rendering customer:
1. `ProductCard.jsx` — kartu produk katalog ✓ (CR-022)
2. `ProductBottomSheet.jsx` — detail produk popup ✓ (CR-022)
3. `CartPage.jsx` — keranjang belanja ✓ (CR-022)
4. `OrderTrackingPage.jsx` — halaman tracking order ✓ (CR-023a / BUG-011a)
5. `ReceiptPickupPage.jsx` — receipt digital ✓ (BUG-008)
6. `ThermalReceipt.jsx` — print modal kasir ✓ (CR-014)
7. `MockProductDetailPage.jsx` — halaman detail produk ✓ (CR-024 / BUG-011b)

---

## BUG-011b — `/product/:id` Masih Tampilkan Harga Pre-Tax

**Symptom:**  
Halaman detail produk (`/product/:id`) menampilkan harga dengan `formatPrice(product.price)` — harga dasar tanpa pajak — tidak konsisten dengan semua halaman customer lain yang sudah tax-inclusive.

**Root Cause:**  
CR-022 secara eksplisit mengecualikan `ProductDetailPage (/product/:id)` dari scope-nya. Tidak ada CR lain yang menangani halaman ini setelah itu.

**Resolution:**  
Display-only fix pada `MockProductDetailPage.jsx`:
1. Tambah import `usePublicConfig` dari `../../hooks/useAppLogo`
2. Tambah `const ppnRate = parseFloat(config?.ppn_rate) || 0;`
3. Harga tampil: `formatPrice(Math.round(product.price * (1 + ppnRate / 100)))`

`handleAddToCart` tidak diubah — tetap kirim `product.price` (pre-tax) ke CartContext; CartPage bertanggung jawab tampilan tax-inclusive di keranjang.

**Files Changed:**  
- `frontend/src/pages/customer/MockProductDetailPage.jsx`

---

## BUG-011 — VoucherPoll CB-Flood Blocks New Transactions (TXN-20260528-00041 et al.)

**Symptom:**  
New PAID transactions (e.g., `TXN-20260528-00041`) appeared "not synced" to Odoo despite the webhook firing correctly. The integration service's Odoo circuit breaker (CB) was opening repeatedly, blocking all real-time pushes.

**Root Cause (chain of 5 failures):**

| # | Defect | Impact |
|---|---|---|
| 1 | 4 transactions (`TXN-20260519-00010`, `-00013`, `TXN-20260520-00022`, `TXN-20260506-00007`) still had `manualConfirmRequired: true` in `sync_metadata` — a pre-CR-006 flag that was never migrated | ORDER_PUSH polling query only checked `confirmFailed=true`, so these SO drafts were never re-confirmed |
| 2 | VoucherPoll query did not filter out transactions with `confirmFailed` / `manualConfirmRequired` | Voucher service called every 60s, saw SO `state=draft`, re-queued to retry queue |
| 3 | Retry queue accumulated multiple entries per transaction; all fired simultaneously after backoff expired | 10+ concurrent Odoo API calls → CB tripped (threshold 5) → new orders blocked |
| 4 | 3 older transactions (`TXN-20260504-00004`, `TXN-20260506-00005`, `-00006`) had SO ids (62, 83, 84) that no longer exist in Odoo; step `[A]` of voucher service threw silently with no log and re-queued forever | CB trips on every polling cycle restart |
| 5 | Dead-letter path in retry queue did not set `voucher_status = FAILED` in DB | VoucherPoll re-added dead-lettered items as new attempt=1 entries, creating an infinite loop |

**Fixes:**

1. **`scheduler.js` — VoucherPoll query**: Added two filter conditions to exclude unconfirmed SOs:
   ```sql
   AND (x.sync_metadata->>'confirmFailed')::boolean IS NOT TRUE
   AND (x.sync_metadata->>'manualConfirmRequired')::boolean IS NOT TRUE
   ```
   Also changed `NOT IN ('PAID')` → `NOT IN ('PAID', 'FAILED')` so FAILED vouchers requiring manual intervention are excluded from auto-polling.

2. **`scheduler.js` — ORDER_PUSH polling query**: Extended the retry condition to also pick up `manualConfirmRequired` entries (old flag):
   ```sql
   AND (x.odoo_id IS NULL
        OR (x.sync_metadata->>'confirmFailed')::boolean = true
        OR (x.sync_metadata->>'manualConfirmRequired')::boolean = true)
   ```

3. **`scheduler.js` — dead-letter handler**: Registered a `PAYMENT_VOUCHER` dead-letter callback in `processDue`:
   ```js
   PAYMENT_VOUCHER: async ({ transactionId }) => {
     await query(`UPDATE integration_xref SET voucher_status = 'FAILED'...`);
   }
   ```
   When a voucher exhausts all retries, `voucher_status = FAILED` is written to DB immediately, stopping VoucherPoll from re-adding it.

4. **`payment-voucher.service.js` — step [A] SO not found**: Changed from silent re-queue to terminal failure:
   - Added `logger.error(...)` to make the failure visible in logs.
   - Set `voucher_status = FAILED` immediately instead of re-queuing — no SO means voucher is permanently impossible.
   - Also added `logger.error` to the generic catch path for other step [A] Odoo errors.

5. **`retry.queue.js`**: Added optional `onDeadLetter` callback map parameter to `processDue(handlers, onDeadLetter = {})`. Called after `audit.pushDeadLetter` when an item exceeds `RETRY_MAX_ATTEMPTS`.

6. **DB data fix**: Migrated 4 stuck `integration_xref` entries from `manualConfirmRequired: true` → `confirmFailed: true` so the fixed ORDER_PUSH polling immediately picked them up for SO re-confirmation.

**Final State (2026-05-29):**

| Transaction | Result |
|---|---|
| TXN-20260520-00022 | SO id=106 confirmed via `_reConfirmOrder`; invoice INV-250 created, posted, paid (payment id=47) ✓ |
| TXN-20260519-00013 | SO id=120 confirmed; invoice INV-251, payment id=48 ✓ |
| TXN-20260519-00010 | SO id=121 confirmed; invoice INV-252, payment id=49 ✓ |
| TXN-20260506-00007 | SO id=122 confirmed; invoice INV-253, payment id=50 ✓ |
| TXN-20260504-00004 | SO id=62 not found in Odoo → `voucher_status=FAILED` (manual resolution needed) |
| TXN-20260506-00005 | SO id=83 not found in Odoo → `voucher_status=FAILED` (manual resolution needed) |
| TXN-20260506-00006 | SO id=84 not found in Odoo → `voucher_status=FAILED` (manual resolution needed) |
| TXN-20260528-00041 | Successfully synced to Odoo SO id=119, `voucher_status=PAID` ✓ |

VoucherPoll queue = 0 after fix. CB no longer trips on each polling cycle.

**Files Changed:**
- `integration/src/scheduler/scheduler.js`
- `integration/src/queue/retry.queue.js`
- `integration/src/services/payment-voucher.service.js`

**Recurrence Prevention:**
- VoucherPoll will never pick up unconfirmed SOs (`confirmFailed`/`manualConfirmRequired` filtered)
- VoucherPoll will never pick up permanently-failed vouchers (`FAILED` status excluded)
- Dead-letter now writes `FAILED` status to DB, creating a clean stop condition
- "SO not found" is now a terminal, logged failure — no silent infinite retry
- Future use of `manualConfirmRequired` flag is forbidden; use `confirmFailed` only (ORDER_PUSH polling handles both for backward compatibility)

---

## BUG-012 — Concurrent Polling Loops Cause Intermittent CB Trip & Delayed Sync

**Symptom:**  
Transactions (e.g., `TXN-20260528-00042`) occasionally appear "not synced" when checked immediately after payment. They sync after 60–120 seconds via polling fallback rather than instantly via webhook. The pattern recurs on every deployment; CB trips were observed at `16:42`, `16:48`, `16:53`, `16:56` in a single session.

**Root Cause:**  
`ORDER_PUSH polling` and `VoucherPoll` were implemented as two **separate `setInterval` callbacks** with the **same interval and the same start time** (`T=0` from scheduler boot). This guarantees they fire simultaneously on every tick:

```
T=0s   : ORDER_PUSH fires → await orderPush (4+ Odoo calls)
T=0s   : VoucherPoll fires → await pushPaymentVoucher (4+ Odoo calls) ← concurrent!
T=30s  : retry queue fires → concurrent with ongoing ORDER_PUSH/VoucherPoll awaits
T=60s  : all three fire simultaneously again
```

Because Node.js `setInterval` callbacks are dispatched from the event loop between `await` suspensions, both loops run concurrently even though each is internally sequential. Under any backlog (stuck transactions, CB just reset), this produces 8–15 simultaneous Odoo API calls → hits Odoo Online rate limit → 5 failures → CB opens → real-time webhook-triggered pushes are blocked for 2+ minutes → user sees delayed/missing sync.

Additionally, neither the polling loop nor the retry queue had a **cycle-overlap guard**: if one cycle took longer than the interval, the next tick would start a second concurrent instance of the same loop.

**Fix (CR-020):**

Merged ORDER_PUSH polling and VoucherPoll into a **single sequential `setInterval`** with a `_polling` overlap guard. ORDER_PUSH runs first (phase 1), then VoucherPoll (phase 2) — they can never make concurrent Odoo calls:

```js
let _polling = false;
setInterval(async () => {
  if (_polling) { logger.warn('Polling: previous cycle still running — skipping tick'); return; }
  _polling = true;
  try {
    // Phase 1: ORDER_PUSH (sequential)
    for (const row of orderRows) await orderPush.pushOrder(row.transaction_id);
    // Phase 2: VoucherPoll (sequential, runs AFTER ORDER_PUSH completes)
    for (const row of voucherRows) await voucherSvc.pushPaymentVoucher(row.transaction_id);
  } finally { _polling = false; }
}, POLLING_INTERVAL_SEC * 1000);
```

Also added `_retrying` guard to the retry queue processor to prevent two retry cycles from overlapping.

**Files Changed:**
- `integration/src/scheduler/scheduler.js`

**Recurrence Prevention:**
- A single polling loop guarantees ORDER_PUSH and VoucherPoll never make concurrent Odoo calls, regardless of queue depth.
- `_polling` guard ensures a slow cycle (e.g., reconfirming 5 draft SOs) does not launch a second instance before finishing.
- `_retrying` guard prevents retry queue overlap under slow Odoo responses.
- Maximum Odoo API calls per minute is now bounded: `(LIMIT_5 × ~5_calls_per_txn) × 2 = 50 calls/60s` — well within Odoo Online's ~100 req/min limit.

---

## BUG-013 — "Access denied. Required role: CUSTOMER" saat Kasir klik Bayar di POS Langsung

**Date:** 2026-05-30  
**Related CR:** CR-023

**Symptom:**  
Setelah memilih produk di halaman `/cashier/pos` dan menekan tombol `💳 Bayar`, muncul error:
```
Access denied. Required role: CUSTOMER.
```
Pesanan tidak berhasil dibuat.

**Root Cause:**  
`CashierPOSPage.jsx` menggunakan `createOrder()` dari `frontend/src/api/orders.js`, yang memanggil `POST /api/v1/orders`. Endpoint ini dikunci dengan `authorize('CUSTOMER')` di backend dan menggunakan `req.user.customerId` — field yang tidak ada pada JWT token kasir (kasir hanya punya `userId`, bukan `customerId`).

```js
// orders.router.js — endpoint yang salah dipanggil
router.post('/',
  authenticate, authorize('CUSTOMER'),   // ← kasir ditolak di sini
  ...
  async (req, res, next) => {
    const data = await ordersSvc.createOrder(req.user.customerId, ...);  // ← undefined untuk kasir
  }
);
```

**Fix:**

| Layer | Perubahan |
|---|---|
| `backend/orders.service.js` | Tambah `createOrderByCashier(cashierId, items)` — menggunakan Walk-in Customer (`phone: 0000000000`, lazy-create) agar FK `customer_id` terpenuhi tanpa schema change |
| `backend/cashier.router.js` | Tambah `POST /cashier/orders` dengan `authorize('CASHIER', 'LEADER')` yang memanggil `createOrderByCashier` |
| `frontend/api/cashier.js` | Tambah `createCashierOrder(items)` → hit `/cashier/orders` (bukan `/orders`) |
| `frontend/CashierPOSPage.jsx` | Ganti import `createOrder` dari `api/orders` → `createCashierOrder` dari `api/cashier` |

**Walk-in Customer:**  
Karena tabel `transactions` memiliki FK `customer_id NOT NULL` yang merujuk ke tabel `customers`, cashier-created order tetap membutuhkan `customer_id` yang valid. Solusi: reservasi satu record customer khusus dengan `phone_number = '0000000000'` dan `full_name = 'Walk-in Customer'`. Record ini dibuat otomatis pertama kali dibutuhkan (lazy-create) — tidak perlu migrasi DB manual.

**Files Changed:**
- `backend/src/modules/orders/orders.service.js`
- `backend/src/modules/cashier/cashier.router.js`
- `frontend/src/api/cashier.js`
- `frontend/src/pages/cashier/CashierPOSPage.jsx`

**Recurrence Prevention:**
- Endpoint kasir selalu berada di `/cashier/*` dengan guard `authorize('CASHIER', 'LEADER')` — tidak pernah berbagi endpoint dengan customer
- `createOrderByCashier` dan `createOrder` (customer) adalah fungsi terpisah; perubahan pada satu tidak mempengaruhi yang lain

---

## BUG-014 — Limit "Maks Item per Order" Tidak Dienforce (TXN-20260531-00058)

**Date:** 2026-05-31  
**Related CR:** CR-028

**Symptom:**  
Customer berhasil melakukan checkout dengan total lebih dari 20 item (pcs) meskipun setting "Maks Item per Order = 20" telah dikonfigurasi di Admin → Konfigurasi → Aturan Transaksi. Transaksi TXN-20260531-00058 berhasil dibuat dengan quantity melebihi batas.

**Root Cause:**  
`max_items_per_order` adalah **dead config** — nilai tersimpan di `system-config.json` dan tampil di admin UI, tetapi tidak pernah dibaca oleh:
- `orders.service.js` saat membuat order (`createOrder`, `createOrderByCashier`)
- `addItemToTransaction` saat kasir menambah item ke order PENDING
- `/config/public` endpoint (frontend tidak pernah tahu nilai limitnya)
- `CartPage.jsx` (tidak ada validasi sisi client)

Sama seperti `pending_timeout_minutes` yang ditemukan sebagai dead config di CR-027 — pattern ini terjadi karena konfigurasi ditambahkan ke admin UI tanpa menghubungkannya ke logika bisnis.

**Fix (CR-028):**

| Layer | Fix |
|---|---|
| `orders.service.js` | Tambah `_getMaxItemsPerOrder()` + validasi total qty di `createOrder`, `createOrderByCashier`, `addItemToTransaction` |
| `app.js` | Expose `max_items_per_order` di `GET /config/public` |
| `CartPage.jsx` | Tampilkan counter "X / 20 item", banner merah jika over limit, disable tombol Checkout |

**Final State:**
- Backend: throw HTTP 422 dengan pesan jelas jika total qty > limit — berlaku untuk semua path order (customer kiosk, POS langsung, tambah item kasir)
- Frontend: user diberi feedback real-time sebelum checkout, tombol disabled jika melebihi batas
- Admin dapat mengubah limit dari UI → efektif untuk order berikutnya tanpa restart

**Recurrence Prevention:**  
Setiap konfigurasi yang ditambahkan ke `DEFAULT_SYSTEM_CONFIG` harus langsung dihubungkan ke enforcement logic di layer yang relevan. Dead config yang hanya tersimpan di JSON tanpa dibaca oleh business logic tidak memberikan nilai apapun dan dapat membingungkan admin.

---

## BUG-015 — Migration 010 Gagal: FK `customers(id)` Tidak Ditemukan

**Date:** 2026-06-04  
**Related CR:** CR-029

**Symptom:**  
Saat menjalankan `010_voucher_tables.sql`, migration ROLLBACK dengan error:
```
psql:/tmp/010_voucher_tables.sql:50: ERROR: column "id" referenced in foreign key constraint does not exist
```
Tabel `vouchers` berhasil dibuat tapi `voucher_usages` dan semua perintah sesudahnya dibatalkan.

**Root Cause:**  
Migration menulis `REFERENCES customers(id)` padahal primary key tabel `customers` adalah `customer_id`, bukan `id`. Ini berbeda dari konvensi umum PostgreSQL — proyek ini menggunakan nama kolom yang lebih deskriptif.

```sql
-- SALAH (ditulis di spec awal):
customer_id UUID REFERENCES customers(id) ON DELETE SET NULL

-- BENAR (sesuai schema aktual):
customer_id UUID REFERENCES customers(customer_id) ON DELETE SET NULL
```

**Fix:**  
Koreksi nama kolom referensi di `010_voucher_tables.sql` lalu jalankan ulang migration.

**Files Changed:**  
- `backend/migrations/010_voucher_tables.sql`

**Recurrence Prevention:**  
Sebelum menulis FK ke tabel yang sudah ada, verifikasi nama PK:

---

## BUG-016a — Voucher Tenant-Scoped Menerapkan Diskon ke Semua Item (TXN-20260604-00024)

**Date:** 2026-06-04  
**Related CR:** CR-029

**Symptom:**  
Transaksi `TXN-20260604-00024` menggunakan voucher `AMZ50%` yang dikonfigurasi hanya berlaku untuk tenant `T001`. Diskon 50% justru diterapkan ke **semua item** di cart (termasuk item dari tenant lain), bukan hanya item milik T001.

**Root Cause (3 titik):**

| # | File | Defect |
|---|---|---|
| 1 | `backend/src/modules/vouchers/vouchers.service.js:73` | `validateVoucher` menghitung `discountAmount` dari `cartTotal` (total seluruh item), padahal seharusnya dari subtotal item milik tenant yang dibatasi saja. Tenant check (step 5) hanya memvalidasi keberadaan tenant di cart, tetapi tidak mempengaruhi base kalkulasi diskon. |
| 2 | `integration/src/services/order.push.js:25` | `_calcLineDiscount` tidak mengenal `voucher_tenant_id`. Fungsi menerapkan `discount` ke **semua** `sale.order.line` tanpa cek apakah item berasal dari tenant yang dibatasi. |
| 3 | `backend/src/modules/orders/orders.service.js` `getTransaction` | Query tidak JOIN tabel `vouchers`, sehingga `voucher_tenant_id` tidak disertakan dalam response API. Integration service tidak bisa mengetahui batasan tenant voucher. |

**Skenario konkret (AMZ50% untuk T001 saja):**

```
Cart: T001 Rp 100.000 + T002 Rp 100.000 = Rp 200.000

SEBELUM fix:
  discountAmount = 200.000 × 50% = Rp 100.000  ← SALAH (semua item)
  Di Odoo: semua line dapat discount = 50%

SETELAH fix:
  tenantScopedSubtotal = Rp 100.000 (T001 saja)
  discountAmount = 100.000 × 50% = Rp 50.000   ← BENAR
  Di Odoo: T001 line → discount = 50%, T002 line → discount = 0%
```

**Fixes Applied:**

1. **`vouchers.service.js`** — Terima parameter `items: [{price, quantity, tenant_id}]`. Saat `v.tenant_id` ada, hitung `tenantScopedSubtotal` dari item yang cocok dan gunakan sebagai base kalkulasi. Return `voucher_tenant_id` di result untuk downstream.

2. **`vouchers.routes.js`** — Accept field opsional `items` di body `POST /vouchers/validate`, map ke format `{price, quantity, tenant_id}` sebelum diteruskan ke service.

3. **`orders.service.js`** — `createOrder` dan `createOrderByCashier` kini pass `resolvedItems` (dengan `price` dan `tenant_id` dari `productMap`) ke `validateVoucher`. `getTransaction` ditambah `LEFT JOIN vouchers v ON v.code = t.voucher_code` untuk expose `voucher_tenant_id` di response API.

4. **`order.push.js`** — `_calcLineDiscount(txn, item, allItems)`:
   - Jika `txn.voucher_tenant_id` ada dan `item.tenant_id` tidak termasuk → return `0.0`
   - FIXED: distribusi proporsional hanya dalam `eligibleItems` (item dari tenant yang dibatasi)
   - Call site diperbarui: `_calcLineDiscount(txn, item, items)`

5. **`VoucherInput.jsx`** — Terima prop `items` dan sertakan dalam body `POST /vouchers/validate`.

6. **`CartPage.jsx`** — Pass `items` (dari CartContext) ke `VoucherInput`.

**Files Changed:**
- `backend/src/modules/vouchers/vouchers.service.js`
- `backend/src/modules/vouchers/vouchers.routes.js`
- `backend/src/modules/orders/orders.service.js`
- `integration/src/services/order.push.js`
- `frontend/src/components/cart/VoucherInput.jsx`
- `frontend/src/pages/customer/CartPage.jsx`

**Odoo Integration — Tidak Terdampak:**  
Mekanisme CR-015 (payment voucher chain: SO → invoice → payment) tidak berubah. `_calcLineDiscount` hanya mengubah nilai `discount` per baris; `action_confirm`, `action_create_invoices`, dan `account.payment` tetap berjalan normal. Amount total di Odoo akan otomatis mencerminkan diskon yang scoped karena `discount` hanya ada di baris T001.

**Recurrence Prevention:**  
Setiap voucher dengan `tenant_id` harus menggunakan `effectiveSubtotal` (subtotal dari tenant yang dibatasi) sebagai base kalkulasi diskon. Validasi keberadaan tenant di cart (step 5) dan kalkulasi diskon (step 7) harus menggunakan basis yang konsisten.

---
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'target_table' AND column_default LIKE '%uuid%';
-- atau
\d target_table  -- di psql
```
Tabel-tabel di proyek ini menggunakan pola `<table_singular>_id` sebagai PK (misal `customer_id`, `product_id`, `user_id`), bukan kolom generic `id`.

---

## BUG-017a — `FOR UPDATE` Lock Produk Booth Lain di `createHelperOrder` (CR-035)

**Date:** 2026-06-06  
**Related CR:** CR-035

**Symptom:**  
Tidak ada symptom user-facing — validasi booth ownership sudah ada dan menolak request dengan 403. Namun analisis kode menemukan bahwa query `FOR UPDATE` dalam `createHelperOrder` me-lock baris produk milik booth lain sebelum validasi menolak transaksi.

**Root Cause:**  
Query awal di `createHelperOrder` hanya memfilter `product_id` dan `is_active`, tanpa filter `tenant_id`:

```sql
-- SEBELUM:
SELECT ... FROM products
WHERE product_id = ANY($1) AND is_active = TRUE
FOR UPDATE
-- params: [productIds]
```

Jika helper mengirim `product_id` milik booth lain (sengaja maupun tidak), PostgreSQL akan me-lock row tersebut (via `FOR UPDATE`) sebelum validasi per-item di baris berikutnya mendeteksi mismatch dan melempar 403. Pada production dengan traffic tinggi, lock ini dapat menyebabkan contention di tabel `products` untuk operasi yang akhirnya tidak pernah mengubah data.

Validasi post-lock (baris berikutnya) memang sudah benar:
```js
if (p.tenant_id !== helperTenantId) throw new AppError(`...bukan milik booth ini...`, 403);
```
Namun validasi ini terjadi *setelah* lock sudah diperoleh.

**Root Cause Classification:**  
Bukan security bug (validasi ada sebelum stock decrement), tetapi **lock contention risk** — prinsip least-privilege juga berlaku untuk DB locks: hanya lock baris yang memang akan dimodifikasi.

**Fix:**  
Tambah `AND tenant_id = $2` ke query `FOR UPDATE`:

```sql
-- SESUDAH:
SELECT ... FROM products
WHERE product_id = ANY($1) AND tenant_id = $2 AND is_active = TRUE
FOR UPDATE
-- params: [productIds, helperTenantId]
```

Pesan error saat produk tidak ditemukan diperbarui:
```
"Satu atau lebih produk tidak ditemukan, tidak aktif, atau bukan milik booth Anda."
```
Pesan baru mencakup kasus booth mismatch tanpa mengekspos informasi apakah produk dari booth lain itu ada atau tidak.

**Files Changed:**  
- `backend/src/modules/helper/helper.service.js`

**Recurrence Prevention:**  
Query `FOR UPDATE` pada tabel `products` di endpoint HELPER harus selalu menyertakan `AND tenant_id = $tenantId` sehingga lock scope dibatasi pada produk yang memang dimiliki booth tersebut. Defense-in-depth per-item check tetap dipertahankan.

---

## BUG-018 — "Role tidak valid" saat Buat Akun HELPER di Admin → User & Role

**Date:** 2026-06-06  
**Related CR:** CR-035

**Symptom:**  
Admin membuka tab **Helper** di halaman `/admin` → User & Role, mengisi form "Tambah Helper Booth Baru", klik **Buat Akun** — mendapat error:
```
Role tidak valid. Gunakan CASHIER, TENANT, atau LEADER.
```
Akun HELPER tidak berhasil dibuat.

**Root Cause:**  
`createUser` di `backend/src/modules/admin/admin.service.js` memiliki whitelist role hardcoded yang dibuat sebelum CR-035:

```js
// SEBELUM (baris 53):
if (!['CASHIER', 'TENANT', 'LEADER'].includes(role)) {
  throw new AppError('Role tidak valid. Gunakan CASHIER, TENANT, atau LEADER.', 422);
}
if (role === 'TENANT' && !tenant_id) {
  throw new AppError('tenant_id wajib diisi untuk role TENANT.', 422);
}
```

CR-035 menambahkan `HELPER` ke `user_role_enum` di database dan menambahkan tab HELPER di frontend `UserRoleTab.jsx`, tetapi **lupa memperbarui whitelist validasi di service layer**. Dua gap sekaligus:
1. `HELPER` tidak ada di whitelist → selalu 422
2. Validasi `tenant_id` wajib hanya untuk `TENANT`, padahal HELPER juga wajib terikat ke satu booth

**Fix:**

```js
// SESUDAH:
if (!['CASHIER', 'TENANT', 'HELPER', 'LEADER'].includes(role)) {
  throw new AppError('Role tidak valid. Gunakan CASHIER, TENANT, HELPER, atau LEADER.', 422);
}
if ((role === 'TENANT' || role === 'HELPER') && !tenant_id) {
  throw new AppError(`tenant_id wajib diisi untuk role ${role}.`, 422);
}
```

**Files Changed:**  
- `backend/src/modules/admin/admin.service.js`

**Recurrence Prevention:**  
Setiap kali role baru ditambahkan ke `user_role_enum` (migration), wajib periksa dan perbarui tiga lokasi sekaligus:
1. `admin.service.js` `createUser` — whitelist validasi role
2. `admin.service.js` `createUser` — validasi `tenant_id` wajib jika role terikat booth
3. `UserRoleTab.jsx` `ROLE_TABS` — UI tab manajemen

Checklist ini sebaiknya masuk ke migration comment agar tidak terlewat.

---

## CR-036 — QR Delivery Architecture: Three-Layer System

**Date:** 2026-06-07  
**On top of:** CR-035 (Hybrid Model C — HELPER creates RESERVED orders)

**Objective:**  
Setelah Helper membuat order, customer harus menerima QR pembayaran via minimal satu dari tiga kanal:
- **Layer 1 (Primary):** WhatsApp/SMS ke nomor HP customer berisi link publik `/pesanan/:txnId?token=...`
- **Layer 2 (Bonus):** WebSocket push ke customer terdaftar (jika online)
- **Layer 3 (Fallback):** QR selalu tampil di layar Helper (jaring pengaman pasti ada)

Kegagalan Layer 1 atau 2 tidak boleh menggagalkan pembuatan order.

---

### LANGKAH 1 — Migration Database

**File:** `backend/migrations/013_cr036_qr_delivery.sql`

Tambah kolom ke tabel `transactions`:
- `public_token VARCHAR(64) UNIQUE` — UUID publik untuk link tanpa login
- `public_token_exp TIMESTAMPTZ` — waktu kedaluwarsa token
- `wa_sent_at TIMESTAMPTZ` — timestamp pengiriman WA
- `wa_delivery_status VARCHAR(20)` — `PENDING|SENT|DELIVERED|FAILED|SKIPPED`

Seed `system_settings`:
- `wa_gateway_provider`, `wa_gateway_api_key`, `wa_gateway_api_url`
- `wa_message_template`, `public_token_ttl_minutes`, `order_base_url`

---

### LANGKAH 2 — WA Service

**File:** `backend/src/modules/wa/wa.service.js` (baru)

- `sendOrderQR(payload)` — fire-and-forget safe, never throws, returns `{status, messageId?, error?}`
- Adapters: Wablas, Zenziva (userkey:passkey), Twilio WhatsApp (accountSid:authToken)
- `getWaConfig()` — baca TTL dan baseUrl dari system_settings
- `sendTestMessage(phone)` — untuk tombol uji di admin
- **Security**: API key/credential tidak pernah di-log; hanya `provider` + `error.message`

---

### LANGKAH 3 — Helper Service + Router

**Files:** `backend/src/modules/helper/helper.service.js`, `helper.router.js`

- `createHelperOrder` diperluas: generate `publicToken = crypto.randomUUID()`, simpan ke DB, kirim Layer 1 (async/fire-and-forget), push Layer 2 (WebSocket)
- `resendWa(transactionId, helperId, newPhone)` — kirim ulang WA dengan nomor baru (awaited)
- Endpoint baru: `POST /helper/orders/:transactionId/resend-wa`

---

### LANGKAH 4 — Public Order Endpoint

**File:** `backend/src/modules/orders/orders.router.js`

- `GET /orders/:txnId/public?token=` (tanpa JWT)
- Rate limit: 30 req/60s per IP
- Validasi token via parameterized query + cek expiry
- Return: items, booth info, `expiresAt`, `qrData`; tidak ekspos nama/HP customer

---

### LANGKAH 5 — WebSocket Event

**File:** `backend/src/ws/websocket.js`

- Event `ORDER_RESERVED_FOR_CUSTOMER` dikirim via `broadcastToCustomer(customerId, payload)`
- Payload: `{txnId, boothName, totalAmount, publicLink, expiresAt}`

---

### LANGKAH 6 — Frontend: Halaman Sukses Helper

**Files:** `frontend/src/pages/helper/HelperOrderSuccessPage.jsx` (baru), `HelperPage.jsx`, `App.jsx`

- Route `/helper/order-success` menerima state dari `navigate()` setelah order berhasil
- Tampilkan QR (220×220, `QRCodeSVG`), countdown, layer status chips
- Resend WA dengan input nomor baru
- Guard: redirect ke `/helper` jika tidak ada state (direct URL access)

---

### LANGKAH 7 — Frontend: Public Order Tracking

**File:** `frontend/src/pages/customer/OrderTrackingPage.jsx`

- Halaman yang sama (`/pesanan/:transactionId`) mendeteksi `?token=` di URL
- Mode publik (`PublicOrderView`): QR 240×240px, nama+lokasi booth, daftar item, total inklusif PPN, countdown, instruksi "Tunjukkan QR ini ke kasir → kembali ke booth untuk ambil barang"
- Setelah PAID: ganti ke confirmation screen, QR disembunyikan
- Poll setiap 30 detik untuk update status
- **Routing**: `/pesanan/:transactionId` dipindah ke luar `RequireRole` guard — bisa diakses tanpa login

---

### LANGKAH 8 — Admin WA Gateway Tab

**Files:** `frontend/src/pages/admin/tabs/WaGatewayTab.jsx` (baru), `AdminPage.jsx`, `admin.router.js`, `admin.service.js`, `frontend/src/api/admin.js`

- Tab baru "WA Gateway" di Admin Panel
- Provider selector (disabled, wablas, zenziva, twilio), API key masked, API URL, base URL, TTL, template textarea
- Tombol "Kirim Tes" untuk uji coba gateway
- Endpoints: `GET /admin/wa-gateway`, `PUT /admin/wa-gateway`, `POST /admin/wa-gateway/test`
- apiKey disimpan hanya jika diisi ulang (bukan `***` placeholder)

---

### Files Changed

| File | Perubahan |
|---|---|
| `backend/migrations/013_cr036_qr_delivery.sql` | Baru — migrasi kolom + seed |
| `backend/src/modules/wa/wa.service.js` | Baru — WA gateway module |
| `backend/src/modules/helper/helper.service.js` | Diperluas — token, WA, WS |
| `backend/src/modules/helper/helper.router.js` | Tambah endpoint resend-wa |
| `backend/src/modules/orders/orders.router.js` | Tambah public endpoint |
| `backend/src/modules/admin/admin.service.js` | Tambah getWaGatewayConfig, saveWaGatewayConfig |
| `backend/src/modules/admin/admin.router.js` | Tambah 3 route wa-gateway |
| `frontend/src/pages/helper/HelperOrderSuccessPage.jsx` | Baru — halaman sukses |
| `frontend/src/pages/helper/HelperPage.jsx` | Navigate ke order-success |
| `frontend/src/pages/customer/OrderTrackingPage.jsx` | Tambah public mode |
| `frontend/src/pages/admin/tabs/WaGatewayTab.jsx` | Baru — admin WA config |
| `frontend/src/pages/admin/AdminPage.jsx` | Tambah tab WA Gateway |
| `frontend/src/api/helper.js` | Tambah resendWa, getPublicOrder |
| `frontend/src/api/admin.js` | Tambah getWaGatewayConfig, saveWaGatewayConfig, testWaSend |
| `frontend/src/App.jsx` | Route order-success + public tracking |

---

### Design Decisions

| # | Pilihan | Alasan |
|---|---|---|
| WA config storage | `system_settings` DB table | Sama dengan tax_config — bisa diubah runtime tanpa restart |
| Halaman sukses | Halaman terpisah `/helper/order-success` via `navigate(state)` | Lebih clean, state tidak hilang di refresh (guard redirect) |
| Layer 1/2 failure | Fire-and-forget — tidak block order creation | Order harus selalu berhasil; WA adalah bonus, bukan blocker |
| public_token | UUID, UNIQUE, per-order, expire 2 jam | Sekali pakai per link; expired = QR tidak bisa dibuka lagi via link |

---

### Security Constraints (dipenuhi)

- Semua perubahan DB additive (tidak ada drop/rename)
- Odoo integration dan payment processing tidak disentuh
- State machine CR-035 tidak diubah
- public endpoint tidak mengekspos nama/HP customer
- API key tidak pernah di-log
- Semua query parameterized

---

## BUG-019 — Tombol "+ Cart" Masih Bisa Diakses saat `order_mode = HELPER_INPUT`

**Date:** 2026-06-06  
**Related CR:** CR-035

**Symptom:**  
QC mengubah konfigurasi **Mode Penjualan → Helper Input** di `/admin` → Konfigurasi, tetapi customer masih dapat menekan tombol **+ Cart** pada katalog produk, membuka halaman detail produk dan menambahkan item ke keranjang, serta menekan tombol **Checkout** di halaman Cart.

**Root Cause:**  
CR-035 menambahkan konfigurasi `order_mode` dan meng-expose-nya melalui public config endpoint (`app.js` baris 101), namun **tidak ada enforcement di layer manapun**:

1. **Frontend `ProductCard.jsx`** — `handleAddToCart` berjalan tanpa cek `order_mode`. Meskipun `usePublicConfig()` dan `config` sudah ada di komponen, hanya `ppn_rate` yang dibaca.
2. **Frontend `ProductDetailPage.jsx`** — tidak mengimpor `usePublicConfig` sama sekali; tombol "Tambah ke Keranjang" selalu tampil.
3. **Frontend `MockProductDetailPage.jsx`** — `config` tersedia tapi tidak dipakai untuk guard cart button.
4. **Frontend `CartPage.jsx`** — tombol **Checkout** selalu aktif; tidak ada banner peringatan mode.
5. **Backend `orders.service.js` `createOrder`** — tidak ada pengecekan `order_mode`; request checkout dari customer selalu diproses. Komentar di `App.jsx` yang menyatakan "backend enforces mode" tidak benar — enforcement tidak pernah diimplementasikan.

**Fix (two-layer enforcement):**

**Layer 1 — Frontend (UX):**

| File | Perubahan |
|---|---|
| `frontend/src/components/catalogue/ProductCard.jsx` | Tambah `isHelperMode = (config?.order_mode ?? 'HELPER_INPUT') === 'HELPER_INPUT'`. Ketika aktif: tampilkan label "🙋 Pesan via petugas booth" (violet) sebagai pengganti tombol "+ Cart". |
| `frontend/src/pages/customer/ProductDetailPage.jsx` | Import `usePublicConfig`. Tambah `isHelperMode`. Ketika aktif: section CTA diganti banner "Pemesanan dilakukan melalui petugas booth". |
| `frontend/src/pages/customer/MockProductDetailPage.jsx` | Tambah `isHelperMode`. Ketika aktif: sticky CTA diganti panel violet "Pemesanan dilakukan melalui petugas booth". |
| `frontend/src/pages/customer/CartPage.jsx` | Tambah `isHelperMode`. Ketika aktif: tampilkan banner peringatan violet di atas ringkasan; tombol **Checkout** disabled dengan label "Hubungi petugas booth". |

**Layer 2 — Backend (guard):**

Tambah helper `_getOrderMode()` di `orders.service.js` (mengikuti pola `_getCheckoutTimeoutMinutes`):
```js
function _getOrderMode() {
  try {
    const cfg = JSON.parse(fs.readFileSync(_SYSTEM_CONFIG_PATH, 'utf8'));
    return cfg.order_mode || 'HELPER_INPUT';
  } catch {
    return 'HELPER_INPUT';
  }
}
```

Di awal `createOrder`:
```js
if (_getOrderMode() === 'HELPER_INPUT') {
  throw new AppError(
    'Pemesanan mandiri tidak tersedia. Hubungi petugas booth untuk melakukan pesanan.',
    403
  );
}
```

**Files Changed:**  
- `frontend/src/components/catalogue/ProductCard.jsx`
- `frontend/src/pages/customer/ProductDetailPage.jsx`
- `frontend/src/pages/customer/MockProductDetailPage.jsx`
- `frontend/src/pages/customer/CartPage.jsx`
- `backend/src/modules/orders/orders.service.js`

**Recurrence Prevention:**  
Setiap kali fitur konfigurasi mode ditambahkan, wajib enforce di dua lapisan: semua titik UI yang menampilkan aksi dan semua endpoint backend yang melakukan operasi tersebut. Frontend enforcement menyembunyikan aksi; backend enforcement memblokir manipulasi langsung via API.

---

## BUG-020 — WebSocket In-App Notification Tidak Terkirim ke Customer (CR-036 Layer 2)

**Date:** 2026-06-07  
**Related CR:** CR-036 (Three-Layer QR Delivery)

**Symptom:**  
Customer yang sedang login tidak menerima notifikasi in-app saat Helper membuat order untuk mereka. Halaman `/pesanan/:txnId` tidak otomatis terbuka. Layer 2 (WS push) selalu dilewati — dua bug terpisah menyebabkan ini.

---

### Root Cause 1 (PRIMARY) — `helper.service.js`: Tidak ada reverse lookup `phone → customerId`

**Chain of evidence:**

1. `HelperPage.jsx` hanya mengirim `customer_phone` dalam POST body — tidak pernah mengirim `customer_id`.
2. `helper.router.js` line 87: `customerId: req.body.customer_id || null` — selalu `null`.
3. `helper.service.js` line 145 (sebelum fix): `if (customerId)` — dengan `customerId === null`, blok ini tidak pernah dieksekusi.
4. Tidak ada reverse lookup `SELECT customer_id FROM customers WHERE phone_number = $1`.
5. `txResult.customerId` selalu `null` (line 226: `customerId,` adalah parameter input yang masih null).
6. Line 282: `if (txResult.customerId)` — selalu `false`. `broadcastToCustomer()` tidak pernah dipanggil.
7. **Layer 2 adalah dead code dalam praktik** — tidak pernah berjalan untuk order apapun.

**Fix:**

Tambah Step A (reverse lookup) SEBELUM Step B (forward lookup) di `createHelperOrder`:

```js
// Step A — jika hanya phone diberikan, cari customer terdaftar berdasarkan phone
if (!customerId && effectivePhone) {
  const custRow = await client.query(
    'SELECT customer_id FROM customers WHERE phone_number = $1',
    [effectivePhone],
  );
  if (custRow.rows[0]?.customer_id) {
    customerId = custRow.rows[0].customer_id;
  }
}

// Step B — jika customerId diketahui, prefer registered phone
if (customerId) {
  const custRow = await client.query(
    'SELECT phone_number FROM customers WHERE customer_id = $1',
    [customerId],
  );
  if (custRow.rows[0]?.phone_number) {
    effectivePhone = custRow.rows[0].phone_number;
  }
}
```

Setelah fix: `customerId` terisi dari reverse lookup → `txResult.customerId` tidak null → WS push berjalan.

---

### Root Cause 2 (SECONDARY) — `websocket.js`: HELPER close tidak membersihkan `tenantClients`

**Chain of evidence:**

Saat AUTH, HELPER ditambahkan ke `tenantClients` (line 45):
```js
} else if ((payload.role === 'TENANT' || payload.role === 'HELPER') && payload.tenantId) {
  tenantClients.get(payload.tenantId).add(ws);
```

Saat close, hanya TENANT yang dibersihkan (line 65 sebelum fix):
```js
if (role === 'TENANT' && tenantClients.has(tenantId)) {
  tenantClients.get(tenantId).delete(ws);
}
```

HELPER disconnect → socket tidak dihapus dari `tenantClients` → memory leak (Set tumbuh tanpa batas dengan dead WebSocket objects). Heartbeat meng-`terminate` socket dari `wss.clients` tetapi tidak dari `tenantClients` (struktur data terpisah).

**Fix:**
```js
// SEBELUM:
if (role === 'TENANT' && tenantClients.has(tenantId)) {
// SESUDAH:
if ((role === 'TENANT' || role === 'HELPER') && tenantClients.has(tenantId)) {
```

---

### Root Cause 3 (MINOR) — `CustomerShell.jsx`: Progress bar tidak punya `width` base style

Progress bar notification card menggunakan CSS animation `notifProgress` (from: 100% → to: 0%) tanpa menetapkan `width: '100%'` sebagai base style. Sebelum frame pertama animasi di-commit browser, elemen bisa flash sebagai zero-width pada device lambat.

**Fix:** Tambah `width: '100%'` ke inline style progress bar div.

---

**Files Changed:**  
- `backend/src/modules/helper/helper.service.js` — reverse phone→customerId lookup (Primary fix)
- `backend/src/ws/websocket.js` — HELPER cleanup on close (Secondary fix)
- `frontend/src/components/layout/CustomerShell.jsx` — progress bar width (Minor fix)

**Recurrence Prevention:**

| Rule | Context |
|---|---|
| Setiap fitur WS push berbasis `customerId` WAJIB menyertakan reverse lookup `phone → customerId` jika frontend tidak mengirim `customer_id` | Berlaku untuk semua endpoint yang diciptakan oleh non-customer (CASHIER, HELPER, ADMIN) |
| Setiap role yang ditambahkan ke shared map (`tenantClients`, `customerClients`) WAJIB ikut dibersihkan di `ws.on('close')` | Cek simetri: AUTH add → close delete, untuk setiap role |
| CSS animation yang menjadi satu-satunya sumber lebar/dimensi elemen harus dilengkapi base style sebagai fallback | Berlaku untuk semua komponen animasi UI |

---


## BUG-023 — Halaman POS Langsung (/cashier/pos) Tidak Ada / Hilang

**Date:** 2026-06-07
**Related CR:** CR-023

**Symptom:**
- Route `/cashier/pos` menampilkan halaman 404 / redirect ke halaman lain
- Tidak ada nav item "🛒 POS Langsung" di sidebar kasir
- Tidak ada banner shortcut POS di `CashierDashboardPage`
- Kasir tidak bisa membuat order walk-in tanpa kiosk customer

**Root Cause:**
`CashierPOSPage.jsx` hilang dari filesystem (kemungkinan akibat git reset / file deletion / rebuild tanpa file tersebut). Backend dan API layer tetap intact:
- `backend/src/modules/cashier/cashier.router.js` → `POST /cashier/orders` ✓
- `backend/src/modules/orders/orders.service.js` → `createOrderByCashier()` ✓  
- `frontend/src/api/cashier.js` → `createCashierOrder()` ✓

Yang hilang seluruhnya adalah layer frontend:
1. `CashierPOSPage.jsx` — file tidak ada
2. Import + route `/cashier/pos` di `App.jsx` — tidak ada
3. Nav item `🛒 POS Langsung` di `CASHIER_NAV` — tidak ada
4. Banner shortcut di `CashierDashboardPage.jsx` — tidak ada

**Fix:**

| File | Perubahan |
|---|---|
| `frontend/src/pages/cashier/CashierPOSPage.jsx` | Dibuat ulang — 2-panel POS: product browser (kiri) + cart + Bayar (kanan) |
| `frontend/src/App.jsx` | Import `CashierPOSPage`, tambah nav item `🛒 POS Langsung`, tambah route `/cashier/pos` |
| `frontend/src/pages/cashier/CashierDashboardPage.jsx` | Tambah banner shortcut biru ke `/cashier/pos` |

**Files Changed:**
- `frontend/src/pages/cashier/CashierPOSPage.jsx` — recreated
- `frontend/src/App.jsx` — import + nav + route
- `frontend/src/pages/cashier/CashierDashboardPage.jsx` — POS shortcut banner

**Recurrence Prevention:**

| Rule | Context |
|---|---|
| `CashierPOSPage.jsx` merupakan file frontend inti CR-023 — jangan delete tanpa memeriksa dependensinya di `App.jsx` | Perlu ditrack bersama backend endpoint-nya |
| Backend endpoint + service function intact TIDAK berarti fitur frontend berjalan — selalu verifikasi bahwa page component-nya ada | Periksa: file ada di disk, import di App.jsx, route terdaftar |

---

## BUG-024 — POS Langsung Diblokir di Mode HELPER_INPUT + Tidak Ada Input Barcode/Phone

**Date:** 2026-06-07
**Related CR:** CR-023, CR-035

**Symptom:**
Kasir membuka `/cashier/pos`, mengisi keranjang, klik "Bayar" → error 403:
```
Sistem dalam mode HELPER_INPUT — kasir tidak bisa membuat order. Order dibuat oleh Helper di booth.
```
Selain itu, halaman tidak punya input nomor HP customer dan scan barcode.

**Root Cause:**

**Bug 1 — Blokir HELPER_INPUT terlalu agresif:**
`cashier.router.js:70` memblokir semua `CASHIER` role saat `order_mode === 'HELPER_INPUT'`:
```js
// BEFORE (salah — terlalu agresif)
if (_getOrderMode() === 'HELPER_INPUT' && req.user.role === 'CASHIER') {
  throw new AppError('Sistem dalam mode HELPER_INPUT ...');
}
```
Ini salah karena konsep HELPER_INPUT hanya mengatur alur order dari booth (HELPER buat order → kasir proses bayar). Walk-in customer yang langsung datang ke kasir (`/cashier/pos`) adalah flow yang berbeda dan HARUS tetap bisa jalan di mode apapun.

**Bug 2 — Missing features (phone + barcode):**
`CashierPOSPage.jsx` tidak memiliki:
- Input nomor HP customer (untuk identifikasi customer, default Walk-in)
- Input barcode untuk scan produk cepat

**Fix:**

| Layer | File | Perubahan |
|---|---|---|
| Backend | `cashier.router.js` | Hapus blokir HELPER_INPUT; accept optional `customerPhone` & `voucherCode` di body |
| Backend | `orders.service.js` | `createOrderByCashier(cashierId, items, voucherCode, customerPhone)` — jika phone diberikan, lookup/create customer dengan phone tersebut; jika tidak, gunakan Walk-in (0000000000) |
| Frontend | `cashier.js` | `createCashierOrder(items, customerPhone)` — kirim customerPhone ke backend |
| Frontend | `CashierPOSPage.jsx` | Tambah input No. HP customer (opsional) + input scan barcode menggunakan `getProductByBarcode()` |

**Customer Phone Logic (orders.service.js):**
```
customerPhone ada   → cari di DB; jika tidak ada → INSERT (name='Customer 08xx...', gender='PREFER_NOT_TO_SAY')
customerPhone kosong → gunakan Walk-in sentinel (0000000000)
```

**Files Changed:**
- `backend/src/modules/cashier/cashier.router.js`
- `backend/src/modules/orders/orders.service.js`
- `frontend/src/api/cashier.js`
- `frontend/src/pages/cashier/CashierPOSPage.jsx`

**Recurrence Prevention:**

| Rule | Context |
|---|---|
| `order_mode` mengatur alur default, BUKAN memblokir semua cara pembuatan order | POS Langsung (walk-in di kasir) selalu valid di mode apapun |
| Jika ada role-based restriction di router, tambahkan komentar WHY — restriction tanpa komentar jelas rentan dianggap bug | Semua endpoint cashier di `cashier.router.js` |

---

## BUG-025 — Gambar Produk Tidak Tampil di /katalog (Broken Image Icon)

**Date:** 2026-06-07

**Symptom:**
Halaman `/katalog` menampilkan ikon gambar rusak (broken image) pada kartu produk, alih-alih menampilkan emoji fallback 🧸.

**Root Cause:**
Semua komponen yang merender gambar produk menggunakan pola:
```jsx
{product.image_url
  ? <img src={product.image_url} ... />
  : <span>🧸</span>
}
```
Kondisi ini hanya memeriksa apakah `image_url` adalah string yang tidak kosong — bukan apakah gambar berhasil dimuat. Ketika URL valid secara format tetapi file tidak dapat diakses (404, Docker volume reset, URL eksternal tidak aktif, dsb.), browser menampilkan ikon broken image karena tidak ada `onError` handler untuk fallback ke emoji.

**Skenario penyebab file tidak dapat diakses:**
1. Docker container di-rebuild dengan `docker compose down -v` → named volume `hybrid_uploads_data` dihapus → file hilang, tapi `image_url` di DB masih ada
2. Dev mode lokal (Vite + backend lokal) tapi gambar disimpan di Docker volume yang tidak ter-mount
3. Bulk upload menggunakan URL eksternal (CDN/hosting) yang sudah kadaluarsa atau butuh autentikasi
4. Odoo sync tidak menyinkronkan gambar, tapi admin pernah memasukkan URL Odoo secara manual

**Fix:**
Tambahkan `onError` handler + state `imgError` ke semua komponen yang merender gambar produk:

```jsx
const [imgError, setImgError] = useState(false);

{product.image_url && !imgError
  ? <img src={product.image_url} ... onError={() => setImgError(true)} />
  : <span>🧸</span>
}
```

**Files Changed:**
- `frontend/src/components/catalogue/ProductCard.jsx` — state `imgError` + onError
- `frontend/src/components/catalogue/ProductBottomSheet.jsx` — state `imgError` + onError
- `frontend/src/pages/cashier/PaymentPage.jsx` — `AddProductCard`: state `imgError` + onError
- `frontend/src/pages/cashier/CashierPOSPage.jsx` — `ProductCard`: state `imgError` + onError
- `frontend/src/pages/customer/MockProductDetailPage.jsx` — state `imgError` + onError
- `frontend/src/pages/admin/tabs/MasterDataTab.jsx` — inline `onError` hide broken thumbnail

**Recurrence Prevention:**

| Rule | Context |
|---|---|
| Semua `<img>` yang src-nya berasal dari data eksternal (DB/API) WAJIB punya `onError` fallback | Jangan berasumsi URL valid = file ada |
| Pada saat image upload, selalu validasi file dapat diakses setelah disimpan | Khususnya saat Docker volume berbeda antara dev dan prod |

---

## BUG-026 — Fitur Voucher Kasir Hilang dari `/cashier/pos` dan `/cashier/bayar/:txnId`

**Date:** 2026-06-07

**Symptom:**
Halaman `/cashier/pos` dan `/cashier/bayar/:txnId` tidak memiliki input voucher. Kasir tidak bisa menerapkan diskon voucher ke transaksi walk-in maupun transaksi yang sedang dalam antrian pembayaran.

**Root Cause:**
Fitur voucher untuk kasir diimplementasikan pertama kali di CR-029/CR-030. Saat BUG-023 dan BUG-024 diperbaiki, `CashierPOSPage.jsx` ditulis ulang dari awal (karena file hilang), tapi `VoucherInput` tidak dimasukkan kembali. `PaymentPage.jsx` tidak pernah mendapatkan VoucherInput sejak awal.

Detail gap:
1. `CashierPOSPage.jsx` — ditulis ulang saat BUG-023/024, `VoucherInput` tidak di-restore
2. `frontend/src/api/cashier.js` — `createCashierOrder` tidak meneruskan `voucherCode` ke backend (meski backend sudah siap menerimanya)
3. `PaymentPage.jsx` — tidak pernah ada VoucherInput; transaksi PENDING yang sudah dibuat tidak bisa mendapatkan diskon
4. `backend/src/modules/payments/payments.service.js` — `lookupTransaction` tidak mengambil `voucher_code` dan `discount_amount` dari DB, sehingga PaymentPage tidak bisa menampilkan diskon yang sudah ada

**Fix:**

**Backend:**
- `backend/src/modules/orders/orders.service.js` — Tambah fungsi `applyVoucherToTransaction(transactionId, cashierId, voucherCode)`: validasi voucher terhadap customer transaksi, hitung ulang `tax_amount` dan `total_amount`, update kolom `voucher_code` + `discount_amount` pada transaksi, catat pemakaian via `voucherSvc.applyVoucher`, tulis audit log. Diekspor ke `module.exports`.
- `backend/src/modules/cashier/cashier.router.js` — Tambah endpoint `POST /orders/:transactionId/voucher` (auth: CASHIER, LEADER) yang memanggil `applyVoucherToTransaction`.
- `backend/src/modules/payments/payments.service.js` — Tambah `t.voucher_code, t.discount_amount` ke SELECT query `lookupTransaction` agar PaymentPage bisa menampilkan diskon yang sudah diterapkan.

**Frontend:**
- `frontend/src/api/cashier.js` — Update `createCashierOrder(items, customerPhone, voucherCode)` untuk meneruskan `voucherCode`. Tambah `applyVoucherToOrder(transactionId, voucherCode)` yang memanggil endpoint baru.
- `frontend/src/pages/cashier/CashierPOSPage.jsx`:
  - Tambah `tenant_id` ke `normalizeProduct` dan item cart (diperlukan untuk scoping diskon tenant-restricted)
  - Tambah state `appliedVoucher`; reset saat cart berubah (add/remove/qty)
  - Tambah `<VoucherInput>` di footer cart panel — hanya tampil saat cart tidak kosong
  - Tampilkan baris "Diskon voucher" di atas tombol Bayar jika voucher diterapkan
  - Pass `appliedVoucher.code` ke `createCashierOrder` saat checkout
- `frontend/src/pages/cashier/PaymentPage.jsx`:
  - Import `VoucherInput` dan `applyVoucherToOrder`
  - Tambah state `voucherApplying`
  - Tambah handler `handleApplyVoucher(voucher)`: panggil `applyVoucherToOrder`, refresh transaksi, tampilkan toast
  - Tambah card `<VoucherInput>` di antara transaction detail dan payment form — hanya tampil saat `isPending && !txn.voucher_code`
  - Tampilkan baris "Diskon (KODE)" dan "Subtotal" secara kondisional di ringkasan transaksi

**Files Changed:**
- `backend/src/modules/orders/orders.service.js` — tambah `applyVoucherToTransaction`, export
- `backend/src/modules/cashier/cashier.router.js` — tambah `POST /orders/:transactionId/voucher`
- `backend/src/modules/payments/payments.service.js` — tambah kolom voucher di SELECT
- `frontend/src/api/cashier.js` — tambah param voucherCode + fungsi applyVoucherToOrder
- `frontend/src/pages/cashier/CashierPOSPage.jsx` — VoucherInput + tenant_id + state appliedVoucher
- `frontend/src/pages/cashier/PaymentPage.jsx` — VoucherInput card + handleApplyVoucher + tampilan diskon

**Design Notes:**
- Voucher di PaymentPage menggunakan double-validation: VoucherInput frontend call ke `/vouchers/validate` untuk UI feedback, lalu `applyVoucherToOrder` backend call untuk apply atomik dengan customer context yang benar (dari transaksi, bukan dari JWT kasir)
- Sekali voucher diterapkan ke transaksi PENDING, endpoint menolak apply kedua (`409 Conflict`) — cashier hanya bisa apply satu voucher per transaksi
- Jika voucher sudah ada di transaksi (dari POS Langsung), PaymentPage menyembunyikan VoucherInput dan menampilkan diskon yang sudah diterapkan

---

## CR-IMG-001 — Upload Gambar Master Data: Kompresi Otomatis dengan sharp

**Date:** 2026-06-08

**Objective:**
Gambar produk yang di-upload via Admin → Master Data → Foto sebelumnya disimpan as-is tanpa resize/kompresi. Gambar besar (>1 MB) memperlambat halaman katalog dan boros bandwidth. Selain itu batas 2 MB backend tidak akurat karena base64 menambah ~33% overhead.

**Changes:**

| Layer | File | Perubahan |
|---|---|---|
| Backend | `backend/package.json` | Tambah dependency `sharp ^0.33.5` |
| Backend | `backend/Dockerfile` | Tambah `apk add libc6-compat` — diperlukan untuk sharp prebuilt binary di Alpine (musl libc) |
| Backend | `backend/src/modules/admin/admin.service.js` | `saveProductImage`: validasi MIME whitelist (JPG/PNG/WEBP saja), naikkan batas raw ke 5 MB, resize ke max 800×800 (fit inside, tanpa enlarge), output JPEG 80% progressive, log ukuran sebelum/sesudah |
| Frontend | `frontend/src/pages/admin/tabs/MasterDataTab.jsx` | `onFileChange`: validasi MIME type aktual (bukan hanya ekstensi) dan ukuran file ≤ 5 MB sebelum encode base64; error toast jika tidak valid; reset input agar file bisa dipilih ulang; update teks hint di modal |

**Behavior Setelah Fix:**
- File JPG/PNG/WEBP hingga 5 MB dapat di-upload
- Backend secara otomatis mengubah semua output menjadi JPEG progressive, max 800×800 px, quality 80%
- Gambar 2 MB raw biasanya turun ke 30–150 KB setelah kompresi (pengurangan 90–98%)
- GIF dan format lain ditolak dengan pesan error yang jelas
- File yang tidak valid di-reset di input sehingga pengguna bisa langsung memilih ulang

**Deploy:**
Karena ada perubahan `package.json` dan `Dockerfile` backend, perlu rebuild image:
```bash
docker compose build backend
docker compose up -d backend
```

---

## BUG-033 — `approveOrder` selalu gagal dengan "Internal Server Error" (CR-040)

**Date:** 2026-06-08  
**Resolved by:** clavis Development  
**Affected:** `POST /api/v1/helper/orders/:txnId/approve`

### Symptom

Setiap klik tombol "Setujui" di halaman Helper (mode HELPER_APPROVE) mengembalikan **500 Internal Server Error**. Tidak ada perubahan status pada pesanan.

### Log Error

```
FOR UPDATE cannot be applied to the nullable side of an outer join
at helper.service.js:661
```

### Root Cause

Di fungsi `approveOrder` (`helper.service.js`), query pertama untuk mengunci baris transaksi menggunakan:

```sql
SELECT t.*, c.full_name, c.phone_number
FROM transactions t
LEFT JOIN customers c ON c.customer_id = t.customer_id
WHERE t.transaction_id = $1
FOR UPDATE   -- ← SALAH
```

PostgreSQL melarang `FOR UPDATE` ketika query mengandung `LEFT JOIN` (outer join), karena lock tidak bisa diaplikasikan ke sisi nullable dari join. Error ini dilempar **sebelum** business logic apapun dijalankan, sehingga **setiap** percobaan approve selalu gagal 500.

### Fix

Ubah `FOR UPDATE` menjadi `FOR UPDATE OF t` — sintaks ini mengunci **hanya baris dari tabel `transactions`**, mengabaikan tabel `customers` yang di-outer-join:

```sql
-- Before (crash):
FOR UPDATE

-- After (benar):
FOR UPDATE OF t
```

**File:** `backend/src/modules/helper/helper.service.js`, fungsi `approveOrder`.

### Mengapa Tidak Terdeteksi Saat Development?

Query ini baru dijalankan pertama kali saat tombol "Setujui" diklik — tidak ada unit test maupun smoke test yang mencakup path ini sebelum deploy.

### Pencegahan

Pattern yang aman untuk locking dengan JOIN: selalu gunakan `FOR UPDATE OF <alias_tabel_utama>` ketika query mengandung `LEFT JOIN` atau outer join apapun. Inner join (`JOIN`) tidak bermasalah karena semua baris terjamin ada.

### Deploy

```bash
docker compose build backend
docker compose up -d backend
```

---

## BUG-034 — Tab "Antrian Approval" Tidak Muncul di Halaman Helper

**Date:** 2026-06-08  
**Resolved by:** clavis Development  
**Affected:** `frontend/src/pages/helper/HelperPage.jsx`, `frontend/src/hooks/useAppLogo.js`

### Symptom

Setelah backend di-restart (pasca BUG-016 fix), halaman `/helper` hanya menampilkan tiga tab: **Buat Order**, **Riwayat Hari Ini**, **Serah Terima** — tab **Antrian Approval** tidak muncul, padahal ada dua pesanan berstatus `PENDING_APPROVAL` yang terlihat di tab Riwayat.

### Root Cause

**Dua defect berjalan bersamaan:**

#### Defect 1 — Cache keracunan pada `usePublicConfig` (primer)

Fungsi `fetchCached()` di `useAppLogo.js` memiliki handler:

```js
.catch(() => { cached = {}; })
```

Jika fetch `/api/v1/config/public` pernah **gagal sekali** (misalnya karena backend belum siap saat container pertama kali naik), `cached` di-set ke `{}` — sebuah **empty object yang truthy**. Pada pemanggilan berikutnya:

```js
if (cached) return Promise.resolve(cached);  // {} adalah truthy → return langsung
```

Hook mengembalikan `{}` secara permanen tanpa pernah retry ke backend. Akibatnya `config?.order_mode` selalu `undefined`, bukan `'HELPER_APPROVE'`.

#### Defect 2 — Tab bersifat conditional (sekunder)

Tab "Antrian Approval" hanya di-render jika `config?.order_mode === 'HELPER_APPROVE'`:

```js
...(isApproveMode ? [{ id: 'approval', label: 'Antrian Approval' }] : [])
```

Kombinasi kedua defect: cache yang keracunan → `isApproveMode = false` → tab tidak pernah muncul, bahkan setelah page reload.

### Fix

**File 1 — `frontend/src/hooks/useAppLogo.js`**

Ubah catch handler agar tidak meng-cache error (biarkan `cached = null` sehingga mount berikutnya bisa retry):

```js
// Before:
.catch(() => { cached = {}; })

// After:
.catch(() => { /* leave cached=null so next mount retries */ })
```

**File 2 — `frontend/src/pages/helper/HelperPage.jsx`**

Tab "Antrian Approval" selalu ditampilkan tanpa kondisi — antrian hanya akan kosong jika tidak ada pesanan PENDING_APPROVAL:

```js
// Before:
...(isApproveMode ? [{ id: 'approval', label: 'Antrian Approval', badge: approvalCount }] : [])

// After:
{ id: 'approval', label: 'Antrian Approval', badge: approvalCount }
```

WS subscription untuk `PENDING_APPROVAL_CREATED` juga dijadikan tanpa kondisi agar badge selalu terupdate.

### Pencegahan

1. **Cache error = null, bukan `{}`** — sebuah empty object adalah truthy. Handler `.catch` yang men-set nilai non-null ke cache akan memblokir semua retry selamanya.
2. **Fitur navigasi (tab, menu) jangan di-hide berbasis config async** — jika config lambat atau gagal, user kehilangan akses ke fitur yang harusnya tersedia. Tampilkan selalu, kosongkan kontennya jika tidak relevan.

### Deploy

```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

---

## BUG-028 — Barang `is_on_hold` Tidak Masuk "Disimpan untuk Nanti" saat Checkout

**Date:** 2026-06-08  
**Resolved by:** clavis Development  
**Affected:** `CartPage.jsx`, `useCatalogueState.js`, `CartContext.jsx`, `orders.service.js`, `error.middleware.js`

### Symptom

Ketika customer memiliki keranjang campuran — sebagian barang tersedia (tidak on-hold) dan sebagian masih menunggu konfirmasi stok (on-hold) — saat klik **Checkout**:
- Popup pemisahan barang tidak muncul
- Checkout langsung gagal dengan error generik 422 dari backend
- Barang yang on-hold tetap di keranjang sebagai item biasa, **tidak** dipindahkan ke "Disimpan untuk Nanti"
- Customer bingung: "Loh kok barang saya hilang?" (setelah checkout berhasil untuk item approved)

### Root Cause (3 titik)

| # | File | Defect |
|---|---|---|
| 1 | `frontend/src/hooks/useCatalogueState.js` `normalizeProduct()` | **PRIMER** — Field `is_on_hold` dari backend **tidak disertakan** dalam object produk yang dinormalisasi. Akibatnya semua item di cart selalu mendapat `is_on_hold: false`. Variabel `waitingItems` selalu kosong → `StockApprovalModal` tidak pernah muncul. |
| 2 | `backend/src/middlewares/error.middleware.js` + `orders.service.js` | **SEKUNDER** — Saat backend menolak checkout karena produk on-hold (422), response hanya berisi pesan teks berisi nama produk. Frontend tidak dapat mengetahui `product_id` mana yang on-hold untuk mengupdate state cart. |
| 3 | `frontend/src/context/CartContext.jsx` + `CartPage.jsx` | **SEKUNDER** — Tidak ada mekanisme untuk menandai item cart tertentu sebagai `is_on_hold: true` setelah menerima respons 422 dari backend (fallback untuk barang yang sudah ada di cart sebelum fix). |

### Skenario Konkret

```
Cart: Barang A (is_on_hold: false) + Barang B (is_on_hold: true, tapi di cart = false karena normalizeProduct tidak menyertakan field ini)

SEBELUM fix:
  waitingItems = [] (kosong karena semua is_on_hold = false)
  Modal TIDAK muncul
  doCheckout(items) → backend 422 "Barang B belum tersedia"
  Error ditampilkan sebagai teks biasa
  Cart tidak berubah → Barang B TETAP di cart sebagai item biasa

SETELAH fix:
  normalizeProduct menyertakan is_on_hold → Barang B mendapat is_on_hold: true di cart
  waitingItems = [Barang B]
  Modal MUNCUL dengan dua kolom: "Siap Diproses" dan "Menunggu Konfirmasi"
  User klik "Ya, Lanjutkan Checkout"
  Barang B → Disimpan untuk Nanti (sessionStorage + wishlist API)
  Barang B dihapus dari cart
  doCheckout([Barang A]) → berhasil
```

### Fixes

**1. `frontend/src/hooks/useCatalogueState.js`** — Tambah `is_on_hold` ke `normalizeProduct`:
```js
// Sebelum: is_on_hold tidak ada di object
// Sesudah:
is_on_hold: p.is_on_hold || false,
```

**2. `backend/src/middlewares/error.middleware.js`** — Extend `AppError` untuk menerima `meta` dan expose di response:
```js
class AppError extends Error {
  constructor(message, statusCode = 400, meta = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    if (meta) this.meta = meta;
  }
}
// errorHandler: response ditambah ...(err.meta ? { meta: err.meta } : {})
```

**3. `backend/src/modules/orders/orders.service.js`** — Pass `onHoldProductIds` di meta 422:
```js
throw new AppError(
  `Beberapa produk belum tersedia...`,
  422,
  { onHoldProductIds: onHoldCheck.rows.map(r => r.product_id) },
);
```

**4. `frontend/src/context/CartContext.jsx`** — Tambah method `markOnHold(productIds)`:
```js
const markOnHold = useCallback((productIds) => {
  const idSet = new Set(productIds);
  setItems((prev) => {
    const next = prev.map((i) => idSet.has(i.product_id) ? { ...i, is_on_hold: true } : i);
    saveCart(next);
    return next;
  });
}, []);
```

**5. `frontend/src/pages/customer/CartPage.jsx`** — Handle 422 dengan `onHoldProductIds` di `doCheckout`:
```js
} catch (err) {
  const onHoldIds = err.response?.data?.meta?.onHoldProductIds;
  if (onHoldIds?.length > 0) {
    markOnHold(onHoldIds);      // tandai item di cart sebagai on-hold
    setShowApprovalModal(true); // tampilkan modal pemisahan
    return;
  }
  // error biasa
}
```

### Alur Setelah Fix

```
Scenario A: Barang on-hold saat ditambahkan ke cart
  → normalizeProduct fix → is_on_hold: true di cart
  → waitingItems.length > 0 → modal muncul otomatis saat klik Checkout

Scenario B: Barang sudah di cart, lalu booth men-hold produk (race condition)
  → Cart masih is_on_hold: false (stale)
  → Checkout → backend 422 + onHoldProductIds
  → markOnHold() → is_on_hold: true di cart
  → modal muncul
  → user konfirmasi → waiting items → Disimpan untuk Nanti
```

### Files Changed

- `frontend/src/hooks/useCatalogueState.js`
- `backend/src/middlewares/error.middleware.js`
- `backend/src/modules/orders/orders.service.js`
- `frontend/src/context/CartContext.jsx`
- `frontend/src/pages/customer/CartPage.jsx`

### Recurrence Prevention

| Rule | Context |
|---|---|
| Setiap field dari backend product API yang digunakan di cart/UI **wajib** disertakan di `normalizeProduct()` | `is_on_hold`, `is_display_only`, `max_per_customer` — semua harus ada |
| Error 422 yang merujuk entity spesifik harus return ID, bukan hanya nama | Gunakan `meta: { entityIds: [...] }` pattern via `AppError(msg, 422, meta)` |
| Setiap fitur UX yang bergantung pada status produk harus handle stale-cart scenario (produk berubah setelah ditambahkan ke cart) | Kombinasi: fetch terbaru saat buka cart + 422 handler sebagai fallback |

### Deploy

```bash
docker compose build --no-cache frontend backend
docker compose up -d frontend backend
```

---

## BUG-027 — Tombol "Setuju" di Antrian Approval Tidak Menghilangkan Item dari Antrian

**Date:** 2026-06-09
**Related CR:** CR-040 (HELPER_APPROVE Model D)

**Symptom:**
Pada halaman `/helper` tab "Antrian Approval", setelah Helper mengklik tombol "✓ Setujui", order tetap tampil di antrian. Item tidak hilang dari daftar meskipun proses approval berhasil (backend return 200).

**Root Cause (2 lapisan):**

### Root Cause 1 (PRIMARY) — SQL `getApprovalQueue` tidak filter `approval_status`

Query di `helper.service.js`:
```sql
-- SEBELUM (salah):
WHERE ti.tenant_id = $1
  AND t.status = 'PENDING_APPROVAL'
-- Missing: AND ti.approval_status = 'PENDING'
```

**Skenario bug (multi-booth):**
1. Customer order item dari **Booth A dan Booth B** → 1 transaksi `PENDING_APPROVAL`
2. Kedua `transaction_items` punya `approval_status = 'PENDING'`
3. Helper A klik "Setuju" → `approveOrder()`:
   - Mark item Booth A sebagai `approval_status = 'APPROVED'`
   - `pendingCheck` → Booth B masih `PENDING` → `allApproved = false`
   - `transactions.status` tetap `PENDING_APPROVAL`
4. Frontend `fetchQueue()` → query berjalan:
   - `t.status = 'PENDING_APPROVAL'` ✓ masih true
   - `ti.tenant_id = 'BoothA'` ✓ masih ada baris (meski approval_status = APPROVED)
5. **Transaksi masih dikembalikan → item tidak hilang dari antrian**

### Root Cause 2 (SECONDARY) — Frontend tidak subscribe `APPROVAL_QUEUE_UPDATE` WS event

Backend sudah broadcast `APPROVAL_QUEUE_UPDATE` via WebSocket setelah approve/reject, tapi `ApprovalQueueTab` tidak subscribe event ini. Antrian hanya refresh via auto-poll 20 detik — artinya tampilan tertinggal sampai poll berikutnya.

**Fixes:**

### Fix 1 — Backend: `getApprovalQueue` query (helper.service.js)

Tambah `AND ti.approval_status = 'PENDING'` ke WHERE clause:

```sql
-- SESUDAH (benar):
WHERE ti.tenant_id = $1
  AND t.status = 'PENDING_APPROVAL'
  AND ti.approval_status = 'PENDING'
```

Logika: Tampilkan transaksi hanya jika booth ini masih punya item yang **belum disetujui**. Karena `approveOrder` menyetujui semua item dari satu booth sekaligus (`UPDATE ... WHERE tenant_id = $2`), filter ini selalu all-or-nothing per booth — tidak ada partial-within-booth.

### Fix 2 — Frontend: Optimistic remove + WS subscriber (ApprovalQueueTab.jsx)

1. **`removeFromQueue(txnId)`** — helper function untuk remove item dari local state + update counter segera setelah API berhasil (sebelum `fetchQueue()` selesai)
2. **WS subscriber** — subscribe `APPROVAL_QUEUE_UPDATE` event untuk sync real-time ketika booth lain juga act on an order
3. **Konsisten** — `handleReject` juga pakai `removeFromQueue` agar perilaku sama

```js
// Tambah import
import { useWebSocket } from '../../hooks/useWebSocket';

// Tambah di dalam komponen
const { subscribe } = useWebSocket();

// Subscribe WS event
useEffect(() => {
  return subscribe('APPROVAL_QUEUE_UPDATE', fetchQueue);
}, [subscribe, fetchQueue]);

// Optimistic remove
function removeFromQueue(txnId) {
  setQueue((prev) => {
    const updated = prev.filter((t) => t.transaction_id !== txnId);
    onCountChange?.(updated.length);
    return updated;
  });
}

// handleApprove dan handleReject memanggil removeFromQueue() sebelum fetchQueue()
```

**Files Changed:**
- `backend/src/modules/helper/helper.service.js` — tambah `AND ti.approval_status = 'PENDING'` di `getApprovalQueue`
- `frontend/src/components/helper/ApprovalQueueTab.jsx` — import `useWebSocket`, tambah `removeFromQueue`, subscribe `APPROVAL_QUEUE_UPDATE`

**Recurrence Prevention:**

| Rule | Context |
|---|---|
| Query `getApprovalQueue` harus selalu memfilter berdasarkan `approval_status` dari booth yang sedang aktif | Setiap query yang membaca antrian approval WAJIB menyertakan `AND ti.approval_status = 'PENDING'` |
| Setiap endpoint yang mengubah state antrian (approve/reject) WAJIB memiliki WS event yang dikonsumsi oleh semua listener antrian | Lihat `broadcastToTenant(helperTenantId, { event: 'APPROVAL_QUEUE_UPDATE', ... })` di `approveOrder` dan `rejectOrder` |
| Setelah aksi berhasil di frontend, langsung hapus item dari local state (optimistic) sebelum menunggu re-fetch | Pola ini mencegah UX gap antara API sukses dan tampilan terupdate |

**Standardisasi Approval (Rekomendasi):**

| Aspek | Standar |
|---|---|
| Status transaksi | `PENDING_APPROVAL` → `PENDING` (approve) atau `CANCELLED` (reject) |
| Status per-item | `transaction_items.approval_status` = `PENDING` → `APPROVED` / `REJECTED` |
| Granularitas | Per-booth: satu helper menyetujui/menolak semua item dari booth-nya sekaligus |
| Query antrian | Selalu filter `AND ti.approval_status = 'PENDING'` untuk menghindari double-show pada multi-booth order |
| WS event | Backend wajib broadcast `APPROVAL_QUEUE_UPDATE` setelah setiap aksi; frontend wajib subscribe untuk sync real-time |
| Optimistic UI | Frontend menghapus item dari local state segera setelah API sukses, lalu re-fetch sebagai fallback sync |

---


## BUG-029 — "Registration failed. Please try again." di Halaman `/daftar`

**Date:** 2026-06-09  
**Resolved by:** clavis Development  
**Affected:** `backend/.env`, `backend/node_modules` (sharp missing), Vite dev mode

### Symptom

Customer membuka halaman `/daftar` (`http://localhost:5175/daftar`), mengisi form registrasi, klik **Daftar Sekarang** → muncul error banner:
> "Registration failed. Please try again."

API registrasi tidak pernah mencapai backend.

### Root Cause (2 lapisan)

#### Root Cause 1 (PRIMER) — Backend crash saat startup: `sharp` tidak terpasang

`backend/src/modules/admin/admin.service.js` baris 6 melakukan `require('sharp')`. Package `sharp` ada di `package.json` tapi **tidak terpasang** di `node_modules` lokal (dev machine). Akibatnya backend langsung crash:

```
Error: Cannot find module 'sharp'
  at admin.service.js:6
```

Backend tidak pernah berhasil listen — semua API call gagal dengan network error, dan `err.response` di frontend selalu `undefined`.

#### Root Cause 2 (SEKUNDER) — PORT mismatch antara `backend/.env` dan Vite proxy

| Setting | Value |
|---|---|
| `vite.config.js` proxy target | `http://localhost:3002` |
| `backend/.env` PORT (sebelum fix) | `3001` |

Ketika backend berhasil distart, ia mendengarkan di port **3001** — bukan port **3002** yang dituju Vite proxy. Seluruh API call dari dev frontend mendapat **connection refused** dari proxy.

### Chain of Failure

```
User klik "Daftar Sekarang"
→ Browser: POST http://localhost:5175/api/v1/auth/register (via Vite proxy)
→ Vite proxy: forward ke http://localhost:3002/api/v1/auth/register
→ Proxy: "Connection refused" (nothing listening at port 3002)
→ Axios: network error, err.response = undefined
→ Frontend catch: err.response?.data?.message ?? t('register.error')
→ Shows: "Registration failed. Please try again."
```

### Fixes Applied

**1. Install `sharp` package:**
```bash
cd backend && npm install
```

**2. `backend/.env` — ubah PORT dari 3001 → 3002:**
```diff
-PORT=3001
+PORT=3002
```

**3. `backend/.env` — tambah port 5175 ke CORS_ORIGIN, hapus 3001:**
```diff
-CORS_ORIGIN=http://localhost:8080,http://localhost:5173,...,http://localhost:3001,...
+CORS_ORIGIN=http://localhost:8080,http://localhost:5175,http://localhost:5173,...,http://localhost:3002,...
```

### Cara Start Backend (Dev Mode) Setelah Fix

```bash
cd backend
npm install       # pastikan sharp dan semua dependencies terpasang
node src/app.js   # backend start di port 3002
```

Frontend Vite di port 5175 → proxy ke backend port 3002 → semua API berjalan normal.

### Files Changed

- `backend/.env` — PORT 3001 → 3002; CORS_ORIGIN tambah 5175, ganti 3001 → 3002

### Recurrence Prevention

| Rule | Context |
|---|---|
| `backend/.env` PORT **harus selalu cocok** dengan target di `vite.config.js` proxy (`3002`) | Cek setiap kali ada perubahan port konfigurasi di kedua file |
| Sebelum dev mode, selalu `npm install` di `backend/` untuk pastikan native modules (sharp, bcrypt) terpasang | Platform-specific modules tidak selalu ada setelah clone baru atau OS reinstall |
| `sharp` adalah native module — setelah upgrade Node.js, jalankan `npm rebuild sharp` | Di Docker Alpine, sudah di-handle lewat `apk add libc6-compat` di Dockerfile (CR-IMG-001) |

---

## BUG-030 — `/katalog` Produk Tidak Ter-load ("barang korang tidak ter load")

**Date:** 2026-06-09  
**Page:** `/katalog`  
**Symptom:** Halaman katalog menampilkan loading terus atau daftar produk kosong. Console menunjukkan `401 Authentication token required.` dari `GET /api/v1/products`.

### Root Cause

Dua masalah terpisah yang terjadi bersamaan:

**1. `authenticate` middleware dipasang di endpoint publik (`products.router.js`)**  
Route `GET /api/v1/products` dan `GET /api/v1/products/categories` memiliki komentar "public browse (Customer)" namun middleware `authenticate` tetap dipasang — artinya setiap request tanpa Bearer token (termasuk customer yang belum login) langsung ditolak dengan 401.

**2. Migrasi 011–016 belum diaplikasikan ke local dev database**  
Setelah 401 diperbaiki, endpoint masih error: `column p.is_on_hold does not exist`. Migration `011_cr035_hybrid_model_c.sql` menambahkan kolom `is_on_hold`, `is_display_only`, `max_per_customer`, `bundle_group` ke tabel `products` — tetapi kolom-kolom tersebut belum ada di local dev database (`amazing_toys_sos` di PostgreSQL lokal), menyebabkan query gagal dengan `Internal server error.`

### Chain of Failure

```
Customer buka /katalog
  → useCatalogueState: getProducts({ limit: 500 })
  → GET /api/v1/products (tanpa Bearer token)
  → authenticate middleware → 401 Authentication token required
  → Frontend: catch(console.error) → products tetap []
  → UI: loading spinner tidak berhenti / produk kosong

Setelah fix #1 (hapus authenticate):
  → Query SQL: SELECT p.is_on_hold FROM products ...
  → PostgreSQL: ERROR column p.is_on_hold does not exist
  → Backend: 500 Internal server error
  → Frontend: sama — produk tidak ter-load
```

### Fix

**Fix #1 — Hapus `authenticate` dari endpoint publik** (`backend/src/modules/products/products.router.js`):
- `GET /` — hapus `authenticate` (customer browse tidak butuh login)
- `GET /categories` — hapus `authenticate` (dropdown kategori harus publik)
- `GET /barcode/:barcode`, `GET /:productId`, semua PATCH/POST — tetap `authenticate` (cashier & admin only)

**Fix #2 — Aplikasikan migrasi yang pending ke local dev database**:
```bash
psql -U postgres -d amazing_toys_sos -f backend/migrations/011_cr035_hybrid_model_c.sql
psql -U postgres -d amazing_toys_sos -f backend/migrations/012_cr035_seed_helper.sql
psql -U postgres -d amazing_toys_sos -f backend/migrations/013_cr036_qr_delivery.sql
psql -U postgres -d amazing_toys_sos -f backend/migrations/014_cr036_waha_session.sql
psql -U postgres -d amazing_toys_sos -f backend/migrations/015_cr040_helper_approve.sql
psql -U postgres -d amazing_toys_sos -f backend/migrations/016_drop_expires_at_not_null.sql
```

### Files Changed

- `backend/src/modules/products/products.router.js` — hapus `authenticate` dari `GET /` dan `GET /categories`
- Local dev database `amazing_toys_sos` — migrasi 011–016 diaplikasikan

### Recurrence Prevention

| Rule | Context |
|---|---|
| Endpoint publik (customer-facing browse) **tidak boleh** punya `authenticate` middleware | Cek komentar di router; jika ada "public" maka tidak boleh ada `authenticate` |
| Setiap migrasi baru di `backend/migrations/` **harus diaplikasikan** ke local dev DB setelah pull | Jalankan: `psql -U postgres -d amazing_toys_sos -f backend/migrations/<file>.sql` |
| Semua kolom yang direferensikan di `products.service.js` harus ada di semua environment (local, Docker, prod) | Saat menambah kolom via migration, pastikan local dev DB juga di-update |

---

## BUG-031 — QR Scanner Kamera Tidak Bisa Mendeteksi QR Code

**Date:** 2026-06-09  
**Component:** `frontend/src/components/ui/QrScannerModal.jsx`  
**Symptom:** Kamera terbuka tapi QR code tidak pernah terdeteksi — scanner tidak merespons meski QR code jelas terlihat di kamera.

### Root Cause

Dua masalah terpisah yang terjadi bersamaan:

**1. Callback instability — `useEffect` restart loop**  
`QrScannerModal` punya `useEffect([onResult])` yang bergantung pada prop `onResult`. Di BrowsePage dan CustomerShell, `handleQrResult` adalah fungsi biasa (bukan `useCallback`) yang didefinisikan ulang setiap render. Setiap kali komponen induk re-render (contoh: saat `config`/`usePublicConfig()` selesai fetch), referensi `handleQrResult` berubah → `QrScannerModal` cleanup dipicu (kamera stop) → effect jalan ulang (kamera restart). Scanner terus restart sebelum sempat mendeteksi QR apapun.

**2. `inversionAttempts: 'dontInvert'` — jsQR terlalu ketat**  
jsQR dengan setting `dontInvert` hanya mencoba mendeteksi QR hitam-di-putih (normal). QR yang ditampilkan di layar atau hasil print sering memiliki kontras berbeda karena auto-exposure kamera, pencahayaan ruangan, atau warna latar belakang. Setting ini menyebabkan banyak QR code yang valid di dunia nyata tidak terdeteksi.

### Chain of Failure

```
Komponen induk (BrowsePage) render
  → config/usePublicConfig() selesai fetch → state berubah → re-render
  → handleQrResult = new function reference (bukan useCallback)
  → QrScannerModal: useEffect cleanup → kamera stop
  → QrScannerModal: useEffect re-run → kamera restart
  → [loop restart terus sebelum QR sempat terdeteksi]

Bahkan jika restart berhenti:
  → jsQR({ inversionAttempts: 'dontInvert' }) — skip inverted QR
  → QR dari layar/print kondisi cahaya tertentu tidak terdeteksi
```

### Fix

**Fix #1 — Stabilisasi callback dengan `useRef` + `useLayoutEffect`** (`QrScannerModal.jsx`):
- Tambah `onResultRef` dan `resultParserRef` yang selalu menunjuk ke versi terbaru prop
- `useLayoutEffect` (tanpa deps) update ref setiap render tanpa restart effect
- `useEffect` diubah ke deps `[]` — camera hanya start **sekali** saat modal mount
- `scanLoop` menggunakan `onResultRef.current` dan `resultParserRef.current`

**Fix #2 — Ubah `inversionAttempts`** (`QrScannerModal.jsx`):
- `'dontInvert'` → `'attemptBoth'` — jsQR mencoba QR normal DAN inverted per frame

**Fix #3 — Frame skip** (`QrScannerModal.jsx`):
- Tambah `frameCount % 3 !== 0` skip — proses setiap frame ke-3 (~20 fps)
- Mengurangi CPU load tanpa mengorbangi responsivitas

### Files Changed

- `frontend/src/components/ui/QrScannerModal.jsx`
  - Import: tambah `useLayoutEffect`
  - Tambah `onResultRef`, `resultParserRef` (refs untuk callbacks)
  - Tambah `useLayoutEffect` tanpa deps untuk sync refs tiap render
  - `useEffect` deps: `[onResult]` → `[]`
  - `scanLoop`: tambah `frameCount++` dan `frameCount % 3 !== 0` guard
  - `inversionAttempts`: `'dontInvert'` → `'attemptBoth'`

### Recurrence Prevention

| Rule | Context |
|---|---|
| `QrScannerModal` menggunakan refs untuk callbacks — tidak perlu `useCallback` di komponen pemanggil | Perbaikan bersifat permanen di modal; tambahan `useCallback` di luar boleh tapi tidak wajib |
| Jangan pernah jadikan function prop sebagai deps `useEffect` yang mengelola hardware (camera, mic) | Hardware effect harus `[]` deps + callback via ref |
| `inversionAttempts: 'attemptBoth'` default untuk deteksi lebih baik | `dontInvert` terlalu ketat untuk kondisi real-world |

---

## BUG-032 — Scan QR di /katalog: "Produk tidak ditemukan"

**Date:** 2026-06-09  
**Page:** `/katalog` → `/product/:barcode`  
**Component:** `frontend/src/pages/customer/MockProductDetailPage.jsx`  
**Symptom:** Setelah scan QR barcode produk di halaman `/katalog`, halaman `/product/:id` menampilkan "Produk tidak ditemukan" meski produk ada di database.

### Root Cause

**Field mismatch: barcode vs product_id**

QR code yang di-generate admin panel (CR-043) meng-encode nilai field `barcode` (contoh: `"6016478556530"`). Saat di-scan, `handleQrResult` meneruskan nilai barcode ini ke navigasi `/product/${barcode}`.

`MockProductDetailPage` membaca URL param `id = "6016478556530"` dan memanggil:
```js
getProduct("6016478556530")
// → GET /api/v1/products/6016478556530
// → query: WHERE p.product_id = '6016478556530'
```

Tidak ada produk dengan `product_id = "6016478556530"` karena `product_id` punya format berbeda (contoh: `P3293-T001`). Query mengembalikan 0 baris → backend 404 → halaman tampilkan "Produk tidak ditemukan".

### Chain of Failure

```
Admin cetak QR barcode produk (CR-043):
  → QRCodeCanvas value = p.barcode = "6016478556530"

Customer scan QR di /katalog:
  → jsQR decode → code.data = "6016478556530"
  → handleQrResult("6016478556530")
  → navigate('/product/6016478556530')

MockProductDetailPage:
  → useParams id = "6016478556530"
  → getProduct("6016478556530")
  → GET /api/v1/products/6016478556530
  → getProductById: WHERE p.product_id = '6016478556530' → 0 rows → 404
  → setProduct(null)
  → render: "Produk tidak ditemukan"
```

### Fix

Tambah fallback di `MockProductDetailPage` — jika `getProduct(id)` gagal (404), otomatis coba `getProductByBarcode(id)`:

```js
getProduct(id)
  .then((r) => setProduct(r.data.data))
  .catch(() =>
    getProductByBarcode(id)         // ← fallback: id is a barcode value from QR scan
      .then((r) => setProduct(r.data.data))
      .catch(() => setProduct(null))
  )
  .finally(() => setLoading(false));
```

Dengan ini:
- Navigate dari katalog dengan `product_id` → `getProduct` sukses, tidak perlu fallback
- Navigate dari QR scanner dengan `barcode` → `getProduct` 404 → fallback ke `getProductByBarcode` → sukses

### Files Changed

- `frontend/src/pages/customer/MockProductDetailPage.jsx`
  - Import: tambah `getProductByBarcode`
  - `useEffect`: tambah fallback `.catch(() => getProductByBarcode(id).then(...).catch(...))`

### Recurrence Prevention

| Rule | Context |
|---|---|
| QR code encode **barcode**, bukan product_id — dua field yang berbeda | Setiap fitur yang menerima input dari QR scanner harus support lookup by barcode |
| `MockProductDetailPage` dan `ProductDetailPage` sekarang support dual-lookup (product_id + barcode) | Tidak perlu ubah handler QR di BrowsePage/CustomerShell |

---

## BUG-035 — `<button>` Nested di Dalam `<button>` di ProductCard

**Tanggal:** 2026-06-10  
**Layer:** Frontend  
**CR Terkait:** CR-056 (i18n audit)  
**Status:** ✅ Resolved

### Symptom

Browser console menampilkan React DOM warning saat render katalog produk:

```
Warning: validateDOMNesting(...): <button> cannot appear as a descendant of <button>.
    at button
    at button
    at div
    at ProductCard
```

### Root Cause

`ProductCard.jsx` mempunyai dua elemen `<button>` bersarang:
- **Outer button** (baris 99): image area yang navigate ke detail page saat diklik
- **Inner button** (baris 106): wishlist heart icon yang toggle wish status

HTML spec melarang `<button>` di dalam `<button>`. React meneruskan peringatan ini dari browser's DOM validation.

### Fix

Ganti outer image-area `<button>` menjadi `<div>` sambil menjaga aksesibilitas:

```jsx
// BEFORE
<button onClick={goToDetail} className="text-left w-full relative" ...>
  ...
  <button onClick={handleWish} ...>   {/* ← INVALID */}
    <HeartIcon />
  </button>
</button>

// AFTER
<div
  onClick={goToDetail}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && goToDetail()}
  className="text-left w-full relative cursor-pointer"
  ...
>
  ...
  <button onClick={handleWish} ...>   {/* ← valid: button inside div */}
    <HeartIcon />
  </button>
</div>
```

### Files Changed

- `frontend/src/components/catalogue/ProductCard.jsx`
  - Baris 98-134: ganti outer `<button>` → `<div role="button" tabIndex={0} onKeyDown={...}>`
  - Tambah `cursor-pointer` ke className

### Recurrence Prevention

| Rule | Context |
|---|---|
| Interactive area yang wrap element lain gunakan `<div role="button">`, bukan `<button>` | Terutama saat area tersebut berisi tombol-tombol lain |
| `e.stopPropagation()` di child button tetap bekerja saat parent adalah `<div>` | Tidak ada perubahan fungsional |

---

## BUG-036 — `LangDropdown is not defined` di CustomerShell (HMR Stale)

**Tanggal:** 2026-06-10  
**Layer:** Frontend / Dev Environment  
**CR Terkait:** CR-057  
**Status:** ✅ Resolved

### Symptom

Console error saat hot-reload:

```
CustomerShell.jsx?t=1781057319928:374 Uncaught ReferenceError: LangDropdown is not defined
CustomerShell.jsx?t=1781057331098:374 Uncaught ReferenceError: LangDropdown is not defined
```

### Root Cause

Bukan bug pada source code. Error terjadi karena **Vite HMR menyajikan versi lama** dari `CustomerShell.jsx` (sebelum `LangDropdown` component ditambahkan di sesi sebelumnya). Timestamp `t=1781057319928` dan `t=1781057331098` menunjukkan dua upaya HMR reload dalam 12 detik — keduanya masih menggunakan bundle yang belum diperbarui.

File di disk (`CustomerShell.jsx`) sudah benar: `LangDropdown` didefinisikan di baris 18, digunakan di baris 311.

### Fix

Hard browser refresh (`Ctrl + Shift + R`) atau restart Vite dev server untuk membersihkan HMR cache.

Tidak ada perubahan kode diperlukan.

### Recurrence Prevention

| Rule | Context |
|---|---|
| Jika error console menunjukkan baris yang tidak cocok dengan source, cek timestamp `?t=` di stack trace | Timestamp berbeda dari mtime file saat ini = HMR stale |
| Hard refresh (`Ctrl+Shift+R`) atau restart `npm run dev` membersihkan state HMR | Jangan langsung edit file berdasarkan stale error |

---

## BUG-037 — `Download the React DevTools` Muncul di Console

**Tanggal:** 2026-06-10  
**Layer:** Frontend / Infra  
**CR Terkait:** —  
**Status:** ✅ Resolved (non-bug + Dockerfile hardening)

### Symptom

```
chunk-TDH2IRYZ.js?v=67049413:21551 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
```

### Root Cause Analysis

**Bukan error** — ini pesan informasional dari React development build. Ada dua skenario berbeda:

| Skenario | Penyebab | Apakah Bug? |
|---|---|---|
| `npm run dev` (local) | Vite dev server selalu menjalankan React dalam dev mode; pesan ini **selalu muncul** | ❌ Bukan bug |
| Docker production | Dockerfile tidak eksplisit set `NODE_ENV=production` sebelum `vite build` | ⚠️ Potensi risiko |

Identifikasi skenario: chunk filename `chunk-TDH2IRYZ.js?v=HASH` (bukan `?t=TIMESTAMP`) menunjukkan ini dari Vite's **pre-bundled dependency cache** → user sedang menjalankan `npm run dev`.

Dalam production Docker build, `vite build` secara otomatis set `NODE_ENV=production`, tapi jika ada tooling upstream yang set `NODE_ENV=development` lebih awal, Vite tidak override (`process.env.NODE_ENV = process.env.NODE_ENV || 'production'`).

### Fix

**Local dev (npm run dev):** Tidak perlu diperbaiki. Instal [React DevTools extension](https://react.dev/learn/react-developer-tools) agar pesan hilang secara otomatis.

**Dockerfile — hardening eksplisit:**

```dockerfile
# BEFORE
COPY . .
RUN npm run build

# AFTER
COPY . .
ENV NODE_ENV=production   ← tambahan
RUN npm run build
```

`ENV NODE_ENV=production` diletakkan SETELAH `npm ci` (bukan sebelumnya) agar devDependencies (vite, @vitejs/plugin-react) tetap terinstall untuk keperluan build.

### Files Changed

- `frontend/Dockerfile`
  - Tambah `ENV NODE_ENV=production` antara `COPY . .` dan `RUN npm run build`

### Recurrence Prevention

| Rule | Context |
|---|---|
| `chunk-NAME.js?v=HASH` = Vite pre-bundled dep (dev mode) | Bukan error — pesan muncul setiap `npm run dev` |
| `chunk-NAME.js?v=HASH` berbeda dari `source.jsx?t=TIMESTAMP` | `?t=` = HMR module, `?v=` = static asset/pre-bundle |
| Selalu letakkan `ENV NODE_ENV=production` setelah `npm ci` di Dockerfile multi-stage build | Mencegah NODE_ENV upstream membatalkan produksi build |
| React DevTools extension menghilangkan pesan ini di dev mode | Instal di semua browser yang digunakan untuk development |

---

## BUG-038 — Klik "-" pada Qty Pill Langsung Menghapus Item (qty=5 → 0)

**Tanggal:** 2026-06-10
**Layer:** Frontend
**CR Terkait:** —
**Status:** ✅ Resolved

### Symptom

Di halaman `/keranjang` (`CartPage`), ketika customer menekan tombol "−" pada item dengan qty > 1 (contoh: qty=5), item langsung **hilang dari keranjang** alih-alih qty turun 1 menjadi 4.

```
Existing: Barang A qty=5 → klik "−" → item terhapus (qty=0/hilang)
Expected: Barang A qty=5 → klik "−" → qty=4
```

### Root Cause

`CartPage.jsx` baris 425 (sebelum fix) — tombol "−" **selalu** memanggil `removeItem(item.product_id)` tanpa mempertimbangkan `item.quantity` saat ini:

```jsx
// SEBELUM (salah):
<button onClick={() => removeItem(item.product_id)}>
  {item.quantity === 1 ? '🗑' : '−'}
</button>
```

`removeItem` di `CartContext.jsx` langsung memfilter item keluar dari array — tanpa pengecekan qty sama sekali. Meskipun icon tombol memang menampilkan '−' saat qty > 1 (hanya ikon '🗑' saat qty=1), **onClick-nya tetap sama**: `removeItem`. Akibatnya klik "−" pada qty=5, 4, 3, atau 2 semuanya menghapus item sepenuhnya.

Inkonsistensi terjadi karena:
- Tombol "+" sudah benar menggunakan `updateQty(item.product_id, item.quantity + 1)`
- Tombol "−" tidak pernah diupdate ke pola yang sama — hanya salinan tombol hapus dengan ikon kondisional

### Analisis Semua Halaman (qty pill audit)

| Halaman / File | "-" Button Behavior | Bug? |
|---|---|---|
| `CartPage.jsx` | Selalu `removeItem` → hapus item | ✅ **BUG** |
| `CashierPOSPage.jsx` | `setQty(id, qty-1)` → hapus jika qty<1 | ✅ Benar |
| `HelperPage.jsx` | `setQty(productId, -1)` + Math.max(0,...) → hapus dari cart-obj jika 0 | ✅ Benar |
| `OrderTrackingPage.jsx` | Decrement, delete modal saat qty=1 | ✅ Benar |
| `ProductDetailPage.jsx` | `Math.max(1, qty-1)` — pre-cart selector | ✅ Benar |
| `MockProductDetailPage.jsx` | `Math.max(1, qty-1)` — pre-cart selector | ✅ Benar |

### Fix

**File:** `frontend/src/pages/customer/CartPage.jsx`

```jsx
// SEBELUM:
<button onClick={() => removeItem(item.product_id)}>
  {item.quantity === 1 ? '🗑' : '−'}
</button>

// SESUDAH:
<button
  onClick={() =>
    item.quantity > 1
      ? updateQty(item.product_id, item.quantity - 1)
      : removeItem(item.product_id)
  }
>
  {item.quantity === 1 ? '🗑' : '−'}
</button>
```

Logika setelah fix:
- `qty > 1` → panggil `updateQty(id, qty-1)` — turunkan 1, item tetap ada
- `qty = 1` → panggil `removeItem(id)` — hapus item (sesuai ikon 🗑 yang sudah ada)

`updateQty` sudah tersedia di CartContext dan sudah di-destructure di CartPage line 160 — tidak ada perubahan backend atau context yang diperlukan.

### Files Changed

- `frontend/src/pages/customer/CartPage.jsx`

### Recurrence Prevention

| Rule | Context |
|---|---|
| Tombol "−" pada qty pill HARUS menggunakan `updateQty(id, qty-1)` saat qty > 1 | Hanya gunakan `removeItem` saat qty=1 atau sebagai tombol hapus eksplisit |
| Icon kondisional (🗑 vs −) harus diikuti oleh onClick yang kondisional pula | Icon dan handler harus sinkron — jangan biarkan icon berubah tapi handler tetap sama |
| Audit semua qty pill saat menambah fitur keranjang baru | Semua page/component yang render qty controls wajib dicek konsistensinya |

---

## BUG-039 — `/pesanan/:id` Tidak Auto-Refresh Setelah Kasir Proses Pembayaran

**Tanggal:** 2026-06-10
**Layer:** Frontend
**CR Terkait:** CR-038 (payments), CR-036 (WS architecture)
**Status:** ✅ Resolved

### Symptom

Setelah kasir memproses pembayaran, halaman `/pesanan/:id` (OrderTrackingPage) tetap menampilkan status lama (PENDING / RESERVED) dan **tidak berubah otomatis** ke PAID. Customer harus menekan tombol Refresh secara manual atau melakukan hard-refresh browser.

Contoh kasus: TXN-20260610-00081 — kasir sudah proses bayar, status di database berubah ke PAID, tapi halaman customer tidak berubah sampai di-refresh.

### Root Cause Analysis

Backend di `payments.service.js` sudah mengirim WebSocket event ke customer segera setelah pembayaran diproses:

```javascript
// payments.service.js line 181
broadcastToCustomer(txn.customer_id, { event: 'ORDER_PAID', transactionId });
```

Namun `AuthenticatedOrderView` di `OrderTrackingPage.jsx` **tidak memiliki subscriber** untuk event `ORDER_PAID`. Semua event lain sudah terdaftar dengan benar:

| WebSocket Event | Subscriber ada? | Keterangan |
|---|---|---|
| `PICKUP_DONE` | ✅ Ya | Tenant selesai handover |
| `ORDER_RESERVED_FOR_CUSTOMER` | ✅ Ya | CR-036 |
| `ORDER_APPROVED` | ✅ Ya | CR-040 |
| `ORDER_REJECTED` | ✅ Ya | CR-040 |
| `ORDER_PARTIAL_APPROVED` | ✅ Ya | CR-040 |
| **`ORDER_PAID`** | ❌ **Tidak ada** | **← Root cause** |

Event `ORDER_PAID` dikirim oleh backend tapi tidak pernah didengarkan oleh halaman customer — event diabaikan begitu saja.

**Secondary gap:** Tidak ada polling fallback untuk status payment-pending. Jika koneksi WS terputus (network drop, tab resume dari sleep, dll.), page tidak akan pernah auto-update meski WS kemudian tersambung kembali.

### Fix

**File:** `frontend/src/pages/customer/OrderTrackingPage.jsx`

**1. Tambah subscriber `ORDER_PAID`:**
```javascript
useEffect(() => {
  return subscribe('ORDER_PAID', (data) => {
    if (data?.transactionId === transactionId) fetchOrder();
  });
}, [transactionId, subscribe, fetchOrder]);
```

Ini memastikan segera setelah kasir klik "Bayar", event WS diterima dan halaman customer langsung melakukan `fetchOrder()` → status berubah dari PENDING/RESERVED ke PAID secara instan.

**2. Tambah polling fallback (15 detik) untuk status payment-pending:**
```javascript
useEffect(() => {
  const awaitingPayment = order?.status
    && ['PENDING', 'RESERVED', 'WAITING_PAYMENT'].includes(order.status);
  if (!awaitingPayment) return;
  const id = setInterval(fetchOrder, 15_000);
  return () => clearInterval(id);
}, [order?.status, fetchOrder]);
```

Polling hanya aktif selama order berada di status yang menunggu pembayaran. Begitu status berubah (PAID / CANCELLED / EXPIRED), `order.status` berubah → `useEffect` re-runs → polling tidak dilanjutkan (`awaitingPayment = false`). Ini memastikan:
- Jika WS delivery gagal → halaman tetap update dalam ≤15 detik
- Jika customer buka tab dari background/sleep → fetch langsung terjadi saat effect re-run
- Tidak ada polling overhead untuk order yang sudah PAID/COMPLETED

### Alur Setelah Fix

```
Kasir klik Bayar
  → backend: UPDATE transactions SET status='PAID'
  → backend: broadcastToCustomer(customer_id, { event: 'ORDER_PAID', transactionId })
  → frontend: subscribe handler menerima event (instant)
  → frontend: fetchOrder() → status refresh ke PAID
  → UI: badge berubah, QR disembunyikan, tampil pesan konfirmasi pembayaran
  
(Jika WS tidak tersampaikan → polling 15s sebagai fallback)
```

### Files Changed

- `frontend/src/pages/customer/OrderTrackingPage.jsx`
  - Tambah `useEffect` subscriber `ORDER_PAID`
  - Tambah `useEffect` polling fallback untuk status `PENDING | RESERVED | WAITING_PAYMENT`

### Recurrence Prevention

| Rule | Context |
|---|---|
| Setiap event WebSocket baru yang dibroadcast backend WAJIB ada pasangannya di subscriber frontend | Sebelum deploy fitur yang mengirim WS event baru, cek semua halaman yang relevan sudah subscribe |
| Halaman yang menunggu status change HARUS memiliki polling fallback | WS adalah primary; polling adalah safety net — keduanya diperlukan untuk UX yang robust |
| Audit `broadcastToCustomer` dan `broadcastToTenant` calls setiap CR yang menyentuh payments/status | Pastikan setiap broadcast punya consumer yang terdaftar di frontend |

---

## BUG-040 — `approveItem` (Per-Item Approval) Selalu Gagal dengan "Internal Server Error"

**Tanggal:** 2026-06-11
**Layer:** Backend
**Page:** `/helper` → sub-menu Antrian Approval → item-level approve modal
**CR Terkait:** CR-040 (HELPER_APPROVE Model D), Migration 017
**Status:** ✅ Resolved

### Symptom

Helper membuka sub-menu **Antrian Approval**, menemukan transaksi `TXN-20260610-00084` dengan item **Acoustic Bloc Screens**, membuka modal persetujuan per-item, mengubah jumlah yang disetujui (mengurangi dari jumlah asli), lalu menekan tombol hijau emerald **"Setujui"** — halaman menampilkan toast error:

> "Internal server error."

Endpoint: `POST /api/v1/helper/orders/:transactionId/items/:itemId/approve`

### Root Cause

**`FOR UPDATE` pada INNER JOIN yang mengunci dua tabel sekaligus di `approveItem`**

Di fungsi `approveItem` (`helper.service.js` baris ~1026), query awal menggunakan:

```sql
SELECT ti.item_id, ti.product_id, ti.quantity, ti.approval_status, p.product_name, p.stock_quantity
FROM transaction_items ti
JOIN products p ON p.product_id = ti.product_id
WHERE ti.item_id = $1 AND ti.transaction_id = $2 AND ti.tenant_id = $3
FOR UPDATE
```

`FOR UPDATE` pada INNER JOIN ini mencoba mengunci baris dari **kedua tabel** (`transaction_items` DAN `products`) secara **simultan** dalam satu query. Ini berbeda dengan pola yang sudah terbukti benar di `approveOrder` (yang berfungsi normal), di mana lock dilakukan secara **sequential**:

| Fungsi | Urutan Lock |
|---|---|
| `approveOrder` (benar) | `transactions` → `transaction_items` → `products` (satu per satu, terpisah) |
| `approveItem` (buggy) | `transactions` → `transaction_items + products` (simultan via JOIN FOR UPDATE) |

**Masalah yang ditimbulkan:**

1. **Lock ordering violation / deadlock**: Fungsi `createHelperOrder` mengunci `products` lebih dulu (step 1), kemudian `INSERT transactions`. Jika `approveItem` berjalan bersamaan — memegang lock `transactions` dan menunggu lock `products` — terjadi deadlock. PostgreSQL mendeteksi deadlock dan membatalkan salah satu transaksi dengan error yang tidak di-wrap sebagai `AppError`, sehingga error middleware mengembalikan 500.

2. **Lock contention**: Bahkan tanpa concurrent request, `FOR UPDATE` pada JOIN membuat PostgreSQL harus memperoleh row lock dari kedua tabel sekaligus. Ini rentan terhadap contention dan bisa menyebabkan "could not obtain lock on row" error (juga bukan `AppError` → 500).

Perbandingan dengan **BUG-033** (RESOLUTION.md): BUG-033 memperbaiki `FOR UPDATE` pada LEFT JOIN (`FOR UPDATE` → `FOR UPDATE OF t`). BUG-040 adalah masalah serupa pada INNER JOIN di fungsi yang berbeda.

**Mengapa hanya `approveItem` yang terpengaruh (bukan `approveOrder`)?**

`approveOrder` sudah menggunakan pola yang benar — lock terpisah dengan urutan konsisten. `approveItem` ditulis dengan pola yang berbeda (JOIN + FOR UPDATE) yang melanggar urutan lock yang sama.

### Fix

**File:** `backend/src/modules/helper/helper.service.js`

**Sebelum** (buggy — JOIN + FOR UPDATE):
```js
const itemRes = await client.query(
  `SELECT ti.item_id, ti.product_id, ti.quantity, ti.approval_status, p.product_name, p.stock_quantity
   FROM transaction_items ti
   JOIN products p ON p.product_id = ti.product_id
   WHERE ti.item_id = $1 AND ti.transaction_id = $2 AND ti.tenant_id = $3
   FOR UPDATE`,
  [itemId, transactionId, helperTenantId],
);
// ... effectiveQty ...
if (item.stock_quantity < effectiveQty) {
  throw new AppError(`Stok "${item.product_name}" tidak mencukupi ...`, 409);
}
```

**Sesudah** (fixed — dua query terpisah, urutan lock konsisten):
```js
// Lock hanya transaction_items (tanpa JOIN)
const itemRes = await client.query(
  `SELECT ti.item_id, ti.product_id, ti.quantity, ti.approval_status
   FROM transaction_items ti
   WHERE ti.item_id = $1 AND ti.transaction_id = $2 AND ti.tenant_id = $3
   FOR UPDATE`,
  [itemId, transactionId, helperTenantId],
);
// ... effectiveQty ...

// Lock products secara terpisah (mirrors approveOrder)
const prodRes = await client.query(
  `SELECT product_name, stock_quantity FROM products WHERE product_id = $1 FOR UPDATE`,
  [item.product_id],
);
const prod = prodRes.rows[0];
if (!prod || prod.stock_quantity < effectiveQty) {
  throw new AppError(`Stok "${prod?.product_name || item.product_id}" tidak mencukupi ...`, 409);
}
```

Urutan lock setelah fix: `transactions` → `transaction_items` → `products` — identik dengan `approveOrder`.

### Files Changed

- `backend/src/modules/helper/helper.service.js`
  - Fungsi `approveItem` (~baris 1025): Pisahkan JOIN query menjadi dua query terpisah
  - Query 1: `SELECT ... FROM transaction_items WHERE ... FOR UPDATE` (tanpa JOIN products)
  - Query 2: `SELECT product_name, stock_quantity FROM products WHERE product_id = $1 FOR UPDATE`
  - Pengecekan stok menggunakan `prod.stock_quantity` dan `prod.product_name` (dari query 2)

### Deployment

```bash
# Copy file yang diupdate ke container backend
docker cp backend/src/modules/helper/helper.service.js hybrid_backend:/app/src/modules/helper/helper.service.js
docker restart hybrid_backend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| `FOR UPDATE` **tidak boleh** digabung dengan JOIN ke tabel lain dalam satu query | Gunakan query terpisah; lock satu tabel dulu, kemudian tabel lain, sesuai urutan lock yang konsisten di seluruh codebase |
| Urutan lock wajib konsisten di semua fungsi: `transactions` → `transaction_items` → `products` | Jika ada fungsi baru yang menyentuh ketiga tabel ini, ikuti urutan yang sama |
| Semua error PostgreSQL yang tidak di-wrap `AppError` akan menjadi 500 di frontend | Setiap raw DB error (deadlock, lock timeout, constraint violation) WAJIB di-catch dan dikonversi ke `AppError` bila diharapkan |
| Cross-reference dengan BUG-033: `FOR UPDATE` pada JOIN (LEFT atau INNER) selalu berpotensi masalah | Selalu lock tabel satu per satu, bukan sekaligus via JOIN |

---

## BUG-041 — Antrian Approval Kosong di Halaman Helper (`/helper`)

**Tanggal:** 2026-06-11
**Layer:** Database (migration) + Backend (scheduler)
**Page:** `/helper` → sub-menu Antrian Approval
**CR Terkait:** Migration 017 (per-item approval), CR-040 (HELPER_APPROVE)
**Status:** ✅ Resolved

### Symptom

Helper membuka halaman `/helper`, tab **Antrian Approval** tidak menampilkan list apapun — hanya "Antrian kosong" meskipun ada transaksi dengan status `PENDING_APPROVAL` di database.

Backend log menunjukkan error berulang setiap kali helper mengakses halaman:
```
error: column ti.approved_quantity does not exist
  at getApprovalQueue (/app/src/modules/helper/helper.service.js:638)
  path: /api/v1/helper/approval-queue
```

Dan error sekunder dari scheduler:
```
[txn.expire.sweep] DB update failed: column "updated_at" of relation "transactions" does not exist
```

### Root Cause

**Root Cause 1 (PRIMER) — Migration 017 belum diaplikasikan ke database Docker**

`backend/migrations/017_per_item_approval.sql` menambahkan dua kolom ke `transaction_items`:
```sql
ADD COLUMN IF NOT EXISTS approved_quantity INTEGER,
ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;
```

Namun migration ini **tidak pernah dijalankan** di database Docker (`amazing_toys_hybrid`). Akibatnya, `getApprovalQueue` di `helper.service.js:638` yang men-SELECT `ti.approved_quantity` langsung gagal dengan PostgreSQL error mentah (bukan `AppError`) → backend return 500 → frontend catch tanpa error message → `queue` tetap `[]` → UI tampil "Antrian kosong".

Verifikasi:
```sql
-- Sebelum fix: hanya 11 kolom, tidak ada approved_quantity/rejection_reason
SELECT column_name FROM information_schema.columns WHERE table_name='transaction_items';
```

**Root Cause 2 (SEKUNDER) — `TxnExpireJob.js` update kolom `updated_at` yang tidak ada**

`backend/src/modules/scheduler/jobs/TxnExpireJob.js` menjalankan:
```sql
UPDATE transactions SET status = 'EXPIRED', updated_at = NOW() WHERE ...
```

Tabel `transactions` tidak memiliki kolom `updated_at` — kolom tersebut ada di `products` (via trigger) tapi tidak pernah ditambahkan ke `transactions`. Setiap 5 menit sweep job ini gagal. Meskipun non-fatal (error di-catch dan di-log), ini menyebabkan transaksi yang sudah expired tidak pernah otomatis diubah ke status `EXPIRED`.

### Fix

**Fix 1 — Apply migration 017 ke database Docker:**
```sql
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS approved_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;
```

Dijalankan via:
```bash
docker exec hybrid_postgres psql -U postgres -d amazing_toys_hybrid -c "
  ALTER TABLE transaction_items
    ADD COLUMN IF NOT EXISTS approved_quantity INTEGER,
    ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;"
```

**Fix 2 — Hapus `updated_at` dari `TxnExpireJob.js`:**

```diff
- SET status     = 'EXPIRED',
-     updated_at = NOW()
+ SET status = 'EXPIRED'
```

File: `backend/src/modules/scheduler/jobs/TxnExpireJob.js`

### Chain of Failure

```
Helper buka /helper → tab Antrian Approval
  → fetchQueue() → GET /api/v1/helper/approval-queue
  → getApprovalQueue() → SELECT ti.approved_quantity FROM transaction_items
  → PostgreSQL: ERROR column ti.approved_quantity does not exist
  → withTransaction: ROLLBACK + rethrow
  → Error middleware: 500 Internal server error
  → Frontend: catch(() => {}) → queue tetap []
  → UI: "Antrian kosong" (padahal ada data)
```

### Files Changed

- Database `amazing_toys_hybrid`: Migration 017 diaplikasikan (kolom `approved_quantity` + `rejection_reason`)
- `backend/src/modules/scheduler/jobs/TxnExpireJob.js`: Hapus `updated_at = NOW()` dari UPDATE `transactions`

### Deployment

```bash
# Migration sudah dijalankan langsung via docker exec (tidak perlu rebuild)

# Deploy TxnExpireJob fix
docker cp backend/src/modules/scheduler/jobs/TxnExpireJob.js hybrid_backend:/app/src/modules/scheduler/jobs/TxnExpireJob.js
docker restart hybrid_backend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| Setiap migration baru di `backend/migrations/` **wajib langsung diaplikasikan** ke semua environment (local dev, Docker) | Setelah push migration baru, jalankan: `docker exec hybrid_postgres psql -U postgres -d amazing_toys_hybrid -f /tmp/<file>.sql` |
| Saat menulis query yang me-reference kolom dari migration baru, cek apakah migration sudah dijalankan di target env | Gunakan `\d table_name` di psql untuk verifikasi kolom sebelum deploy code yang bergantung padanya |
| Column references di UPDATE/SELECT harus diverifikasi terhadap schema aktual | `transactions` tidak punya `updated_at`; jangan tambahkan ke UPDATE tanpa menambahkan kolom via migration terlebih dahulu |
| Setiap error PostgreSQL dari scheduler/background job harus di-alert, bukan hanya di-log | Error `updated_at does not exist` di sweep job menghentikan expiry otomatis selama berhari-hari tanpa disadari |

---

## BUG-042 — Input Qty di Modal Approve Item Tidak Bisa Diketik (Snap ke 1)

**Tanggal:** 2026-06-11
**Layer:** Frontend
**Page:** `/helper` → tab Antrian Approval → tombol "✓" per item → modal "Setujui Item"
**Component:** `frontend/src/components/helper/ApprovalQueueTab.jsx` — `ItemRow`
**CR Terkait:** CR-040 (HELPER_APPROVE, per-item approval)
**Status:** ✅ Resolved

### Symptom

Helper membuka modal setujui item dan mencoba mengubah qty (contoh: customer order 7 pcs, stok hanya 5, helper ingin setujui 5 pcs). Saat mengetik angka baru di input field:

- Bug 1: Ketik "5" → yang muncul "1" (field snap kembali ke nilai minimum)
- Bug 2: Tidak bisa clear input lalu ketik angka baru — setiap kali field dikosongkan, nilai langsung kembali ke 1

### Root Cause

`onChange` handler di `ItemRow` menggunakan pola:

```jsx
onChange={(e) => setApprovedQty(Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
```

Urutan kejadian saat user mencoba clear dan ketik "5":

1. User select-all + Backspace → `e.target.value = ""` (empty string)
2. `parseInt("") = NaN`
3. `NaN || 1 = 1` → state menjadi `1`
4. React re-render: controlled input dikembalikan ke `value={1}`
5. User ketik "5" → field menunjukkan "15" (bukan "5") karena append ke "1"
6. `Math.min(item.quantity, 15) = item.quantity` → field snap ke max

State `approvedQty` adalah `number`. Setiap kali field berada dalam intermediate state (kosong, atau saat user sedang mengetik), `|| 1` fallback memaksa snap ke 1, menutup kemungkinan intermediate state yang dibutuhkan saat mengetik.

### Fix

Pisahkan state string (untuk input typing) dari nilai numerik (untuk logika):

**Before:**
```jsx
const [approvedQty, setApprovedQty] = useState(item.quantity);
// ...
onChange={(e) => setApprovedQty(Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
```

**After:**
```jsx
const [approvedQty, setApprovedQty] = useState(String(item.quantity));
const approvedQtyNum = Math.min(item.quantity, Math.max(1, parseInt(approvedQty, 10) || 1));
// ...
onChange={(e) => setApprovedQty(e.target.value)}
onBlur={() => setApprovedQty(String(approvedQtyNum))}
```

- `approvedQty` (string): nilai mentah dari input — bebas berubah saat user mengetik, termasuk saat kosong
- `approvedQtyNum` (number): selalu valid (1–item.quantity) — digunakan untuk logika submit, warning text, button label
- `onBlur`: normalisasi string kembali ke angka valid setelah user selesai mengetik
- `handleApproveConfirm`, warning, dan button label semua diubah menggunakan `approvedQtyNum`

### Files Changed

- `frontend/src/components/helper/ApprovalQueueTab.jsx`: Refactor `ItemRow` qty state (string + computed number)

### Deployment

```bash
docker cp frontend/src/components/helper/ApprovalQueueTab.jsx hybrid_frontend_dev:/app/src/components/helper/ApprovalQueueTab.jsx
# atau rebuild container frontend jika tidak menggunakan volume mount
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| React `<input type="number">` dengan `value` controlled: **jangan clamp di `onChange`** | Clamping saat `onChange` menutup intermediate state yang diperlukan untuk mengetik angka multi-digit. Selalu gunakan string state untuk input, hitung nilai valid terpisah, clamp di `onBlur` |
| Hindari pola `parseInt(str) \|\| fallback` pada controlled input | `"" \|\| 1` dan `"0" \|\| 1` menghasilkan `1` keduanya — fallback tidak bisa membedakan "user sedang mengetik" dari "nilai memang 0" |
| Untuk number input, gunakan dua variabel: raw string (untuk input DOM) + computed number (untuk logika) | Pattern: `const [raw, setRaw] = useState(String(init)); const num = parseInt(raw, 10) \|\| 1; onBlur={() => setRaw(String(num))}` |

---

## BUG-043 — Route `POST .../items/:itemId/approve` Not Found (404)

**Tanggal:** 2026-06-11
**Layer:** Backend / Deployment
**Page:** `/helper` → modal approve item → klik "✓ Setujui X pcs"
**CR Terkait:** CR-040 (HELPER_APPROVE, per-item approval)
**Status:** ✅ Resolved

### Symptom

Helper mengisi qty di modal approve item (BUG-042 sudah di-fix) lalu klik tombol konfirmasi. Frontend error:

```
Route POST /api/v1/helper/orders/TXN-20260611-00050/items/fb758858-56e3-4b31-869c-1f2c1c0575b9/approve not found.
```

HTTP 404 — bukan 500. Artinya Express tidak menemukan matching route.

### Root Cause

`docker restart hybrid_backend` hanya me-restart container dengan image yang sama. Image di-build **sebelum** route per-item approval (`/orders/:transactionId/items/:itemId/approve` dan `.../reject`) ditambahkan ke `helper.router.js`.

Verifikasi:
```bash
docker exec hybrid_backend grep "items.*approve" /app/src/modules/helper/helper.router.js
# → no output (exit code 1 = not found)
```

File lokal (`backend/src/modules/helper/helper.router.js`) sudah memiliki route di baris 226–275, namun container masih running versi lama yang tidak memiliki kedua route tersebut.

### Fix

Copy file router yang sudah diupdate ke dalam container yang sedang berjalan, lalu restart:

```bash
docker cp backend/src/modules/helper/helper.router.js hybrid_backend:/app/src/modules/helper/helper.router.js
docker restart hybrid_backend
```

Verifikasi setelah fix:
```bash
docker exec hybrid_backend grep -n "items.*approve" /app/src/modules/helper/helper.router.js
# → 222: * POST /api/v1/helper/orders/:transactionId/items/:itemId/approve
# → 226: router.post('/orders/:transactionId/items/:itemId/approve', ...)
```

### Files Changed

- `hybrid_backend` container: `/app/src/modules/helper/helper.router.js` diperbarui via `docker cp`

### Recurrence Prevention

| Rule | Context |
|---|---|
| Setelah menambah route baru ke router, **wajib `docker cp`** file router ke container yang running (atau rebuild image) | `docker restart` tidak memuat perubahan file lokal — hanya menggunakan image yang sudah ada |
| Setelah setiap sesi development yang mengubah backend file, jalankan `docker cp` + `docker restart` untuk semua file yang diubah | Urutan minimal: `docker cp <local> <container>:<path>` → `docker restart <container>` |
| Saat ada error 404 "Route not found" padahal route sudah ada di file lokal, pertama cek apakah container running file yang sama: `docker exec <c> grep "pattern" <file>` | 404 ≠ bug di code; bisa jadi deployment gap antara local dan container |

---

## BUG-044 — `approveItem` 500: `inconsistent types deduced for parameter $1`

**Tanggal:** 2026-06-11
**Layer:** Backend
**Page:** `/helper` → modal approve item → konfirmasi approve dengan qty dikurangi
**CR Terkait:** CR-040 (HELPER_APPROVE, per-item approval)
**Status:** ✅ Resolved

### Symptom

Setelah BUG-043 (route) diperbaiki, approve item masih gagal 500:

```
error: inconsistent types deduced for parameter $1
  at helper.service.js:1066:5
  at approveItem (helper.service.js:1014:21)
```

### Root Cause

Query UPDATE di `approveItem` menggunakan `$1` dalam dua konteks berbeda:

```sql
UPDATE transaction_items
   SET approval_status   = 'APPROVED',
       approved_quantity = $1,          -- PostgreSQL infers: INTEGER
       subtotal          = unit_price * $1   -- PostgreSQL infers: NUMERIC (operand dari unit_price NUMERIC)
 WHERE item_id = $2
```

PostgreSQL menggunakan *type inference* untuk menentukan tipe setiap parameter placeholder. Karena `approved_quantity` adalah kolom `INTEGER`, PostgreSQL menyimpulkan `$1 = INTEGER`. Namun `unit_price * $1` merupakan ekspresi numerik di mana `unit_price` bertipe `NUMERIC`, sehingga PostgreSQL menyimpulkan `$1 = NUMERIC` untuk konteks ini.

Dua inferensi berbeda untuk parameter yang sama → error `inconsistent types deduced for parameter $1`.

### Fix

Tambahkan explicit cast `::integer` pada penggunaan `$1` di ekspresi aritmetika:

```diff
- subtotal = unit_price * $1
+ subtotal = unit_price * $1::integer
```

File: `backend/src/modules/helper/helper.service.js` baris 1070.

Dengan cast eksplisit, PostgreSQL tahu bahwa `$1` adalah `INTEGER` di kedua konteks. PostgreSQL kemudian secara otomatis mempromosikan `integer → numeric` saat mengalikan dengan `unit_price NUMERIC`.

### Files Changed

- `backend/src/modules/helper/helper.service.js` baris 1070: `unit_price * $1` → `unit_price * $1::integer`

### Deployment

```bash
docker cp backend/src/modules/helper/helper.service.js hybrid_backend:/app/src/modules/helper/helper.service.js
docker restart hybrid_backend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| Jika parameter `$N` dipakai di lebih dari satu SET clause dalam satu UPDATE, dan salah satunya melibatkan ekspresi aritmetika dengan kolom bertipe NUMERIC, tambahkan explicit cast: `$N::integer` atau `$N::numeric` | PostgreSQL tidak bisa deduce type tunggal jika inference dari berbagai clause bertentangan |
| Saat menulis `SET col_integer = $1, col_numeric = expr * $1`, selalu gunakan `$1::integer` di ekspresi untuk memaksa konsistensi | Pola `approved_quantity = $1, subtotal = unit_price * $1` adalah trigger klasik untuk error ini |

---

## BUG-045 — Kasir & Customer Tracking Tampilkan Qty Original, Bukan Qty Approved

**Tanggal:** 2026-06-11
**Layer:** Frontend + Backend
**Page:** 
- `/cashier/bayar/:txnId` (kasir — PaymentPage)
- Struk thermal (ThermalReceipt)
- `/pesanan/:txnId` (customer — OrderTrackingPage)
- `GET /api/v1/orders/:txnId/public` (public token endpoint)
**CR Terkait:** CR-040 (HELPER_APPROVE, per-item approval)
**Status:** ✅ Resolved

### Symptom

Setelah helper approve item dengan qty dikurangi (contoh: customer order 5 pcs → disetujui 3 pcs, TXN-20260611-00052):
- Halaman kasir (`/cashier/bayar/...`) menampilkan "Nama Produk × 5" dan harga `unit_price × 5`
- Struk thermal mencetak qty 5 dan harga dihitung dari qty 5
- Halaman tracking order customer menampilkan qty 5

Data yang benar (`approved_quantity = 3`, `subtotal = unit_price × 3`) sudah ada di database dan dikembalikan oleh API, namun tidak dipakai di frontend.

### Root Cause

**Root Cause 1 — `lookupPayment` API tidak return `approved_quantity`**

`backend/src/modules/payments/payments.service.js` SELECT items hanya mengambil `ti.quantity, ti.unit_price, ti.subtotal`, tanpa `ti.approved_quantity` dan `ti.approval_status`. Frontend tidak bisa tau qty mana yang digunakan.

**Root Cause 2 — Frontend mengabaikan `approved_quantity` dan `subtotal`**

Di tiga tempat frontend, qty dan harga di-compute ulang dari `item.quantity` (original) bukan dari `approved_quantity` dan `subtotal`:

| File | Baris | Kode lama (salah) |
|---|---|---|
| `PaymentPage.jsx` | ~329-330 | `item.quantity`, `item.unit_price * item.quantity` |
| `ThermalReceipt.jsx` | ~181, 238, 241 | `i.quantity`, `item.unit_price * item.quantity * (1 + tax)`, `x${item.quantity}` |
| `OrderTrackingPage.jsx` | ~449, 458 | `item.quantity`, `item.unit_price * item.quantity * (1 + ppnRate)` |

**Root Cause 3 — Public token endpoint tidak return `approved_quantity`**

`GET /api/v1/orders/:txnId/public` (orders.router.js) hanya return `{ qty: r.quantity, unitPrice }`, tanpa `approved_quantity` atau `subtotal`.

### Fix

**Backend `payments.service.js`** — tambah `approved_quantity, approval_status` ke SELECT:
```diff
- SELECT ti.quantity, ti.unit_price, ti.subtotal,
+ SELECT ti.quantity, ti.approved_quantity, ti.approval_status,
+        ti.unit_price, ti.subtotal,
```

**Frontend `PaymentPage.jsx`** — pakai effective qty + filter rejected:
```diff
- {(txn.items ?? []).map((item, i) => (
+ {(txn.items ?? []).filter(item => item.approval_status !== 'REJECTED').map((item, i) => (
-   <span>{item.product_name} × {item.quantity}</span>
+   <span>{item.product_name} × {item.approved_quantity ?? item.quantity}</span>
-   <span>{formatRupiah(item.unit_price * item.quantity)}</span>
+   <span>{formatRupiah(item.subtotal)}</span>
```

**Frontend `ThermalReceipt.jsx`**:
```diff
- items.reduce((sum, i) => sum + (i.quantity || 1), 0)
+ items.filter(i => i.approval_status !== 'REJECTED').reduce((sum, i) => sum + (i.approved_quantity ?? i.quantity ?? 1), 0)
- {items.map(...
+ {items.filter(item => item.approval_status !== 'REJECTED').map(...
- item.unit_price * item.quantity * (1 + taxRate / 100)
+ item.subtotal * (1 + taxRate / 100)
- x${item.quantity}
+ x${item.approved_quantity ?? item.quantity}
```

**Frontend `OrderTrackingPage.jsx`**:
```diff
- {item.product_name} × {item.quantity}
+ {item.product_name} × {item.approved_quantity ?? item.quantity}
- {formatRupiah(Math.round(item.unit_price * item.quantity * (1 + ppnRate / 100)))}
+ {formatRupiah(Math.round(item.subtotal * (1 + ppnRate / 100)))}
```

**Backend `orders.router.js`** (public endpoint) — tambah `approved_quantity, subtotal, approval_status` ke SELECT dan response:
```diff
- SELECT p.product_name, ti.quantity, ti.unit_price
+ SELECT p.product_name, ti.quantity, ti.approved_quantity,
+        ti.unit_price, ti.subtotal, ti.approval_status
# response:
- { name, qty: r.quantity, unitPrice }
+ { name, qty: r.approved_quantity ?? r.quantity, unitPrice, subtotal, approvedQuantity, originalQty }
# filter:
+ .filter(r => r.approval_status !== 'REJECTED')
```

### Files Changed

- `backend/src/modules/payments/payments.service.js`
- `backend/src/modules/orders/orders.router.js`
- `frontend/src/pages/cashier/PaymentPage.jsx`
- `frontend/src/components/cashier/ThermalReceipt.jsx`
- `frontend/src/pages/customer/OrderTrackingPage.jsx`

### Deployment

```bash
# Backend
docker cp backend/src/modules/payments/payments.service.js hybrid_backend:/app/src/modules/payments/payments.service.js
docker cp backend/src/modules/orders/orders.router.js hybrid_backend:/app/src/modules/orders/orders.router.js
docker restart hybrid_backend

# Frontend — perlu rebuild image (static Nginx build, bukan volume mount)
docker compose build frontend
docker compose up -d --no-deps frontend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| Setiap endpoint yang return `transaction_items` ke sisi display **wajib include `approved_quantity`, `approval_status`, `subtotal`** | Jika salah satu kolom ini tidak di-return, frontend akan fallback ke `quantity` (original) yang salah setelah per-item approval |
| Frontend yang menampilkan qty dan harga item WAJIB pakai `approved_quantity ?? quantity` (qty) dan `item.subtotal` (harga), BUKAN menghitung ulang `unit_price * quantity` | Menghitung ulang dari `quantity` mengabaikan keputusan approval helper |
| Item dengan `approval_status = 'REJECTED'` harus difilter dari tampilan kasir dan customer (bukan ditampilkan dengan qty 0) | Rejected items tidak berkontribusi ke total; menampilkannya akan membingungkan dan salah perhitungan |
| Setelah menambah fitur baru yang memutasi data (per-item approval), audit semua endpoint yang membaca data tersebut dan semua halaman yang menampilkannya | BUG-045 terjadi karena endpoint dan tampilan dibuat sebelum fitur `approved_quantity` ada |

---

## BUG-046 — Voucher `usage_limit=2` Hanya Bisa Dipakai 1 Kali

**Tanggal:** 2026-06-11
**Layer:** Backend
**Page:** Admin → `/admin` tab Voucher (voucher AMZ70)
**File:** `backend/src/modules/vouchers/vouchers.service.js`
**Status:** ✅ Resolved

### Symptom

Voucher AMZ70 memiliki `usage_limit = 2` (batas pemakaian 2 kali). Setelah dipakai 1 kali, percobaan pemakaian kedua gagal meskipun `usage_count = 1 < usage_limit = 2`.

State DB saat bug dilaporkan:
```
code  | usage_limit | usage_count | is_active
AMZ70 |           2 |           1 | true
```
`voucher_usages`: 1 row — customer `089620033308`, TXN-20260611-00056.

### Root Cause

**Root Cause 1 (PRIMER) — Per-customer duplicate check mengabaikan `usage_limit`**

`validateVoucher` Step 6 melakukan pengecekan:
```js
// SELECT 1 FROM voucher_usages WHERE voucher_code = $1 AND customer_id = $2
if (usedRes.rows.length > 0) throw new AppError('ALREADY_USED', 400);
```

Jika customer yang SAMA mencoba memakai voucher lagi, langsung diblokir (`ALREADY_USED`) terlepas dari nilai `usage_limit`. Dengan demikian, semantik `usage_limit = 2` menjadi "2 customer berbeda masing-masing sekali", bukan "2 pemakaian total".

Admin yang menetapkan `usage_limit = 2` mengharapkan voucher bisa dipakai 2 kali total — oleh customer yang sama atau berbeda. Per-customer check mengubah arti `usage_limit` secara tak terduga.

**Root Cause 2 (SEKUNDER) — `applyVoucher` non-atomic: INSERT idempotent tapi UPDATE tidak**

```js
// INSERT ... ON CONFLICT (voucher_code, transaction_id) DO NOTHING
await c.query(`INSERT INTO voucher_usages ...`);

// UPDATE berjalan TERLEPAS dari apakah INSERT berhasil
await c.query(`UPDATE vouchers SET usage_count = usage_count + 1 ...`);
```

Jika `applyVoucher` dipanggil dua kali untuk `(voucher_code, transaction_id)` yang sama (retry, race condition), INSERT kedua adalah no-op tapi UPDATE tetap berjalan → `usage_count` double-increment → voucher habis lebih cepat dari `usage_limit`.

### Fix

**Fix 1 — Hapus per-customer duplicate check**

Hapus Step 6 dari `validateVoucher`. Satu-satunya pembatas adalah `usage_limit` global (Step 3). Ini sesuai dengan semantik yang diharapkan: "voucher dapat dipakai hingga `usage_limit` kali total, oleh customer apapun."

```diff
- // 6. Duplicate check — skip for Walk-in Customer
- if (customerId) {
-   const walkinId = await _getWalkinCustomerId();
-   const isWalkin = customerId === walkinId;
-   if (!isWalkin) {
-     const usedRes = await query(`SELECT 1 FROM voucher_usages WHERE ...`);
-     if (usedRes.rows.length > 0) throw new AppError('ALREADY_USED', 400);
-   }
- }
```

Helper `_getWalkinCustomerId` dan konstanta `WALKIN_PHONE` juga dihapus karena tidak lagi digunakan.

**Fix 2 — INSERT kondisional sebelum UPDATE**

```diff
- await c.query(`INSERT INTO voucher_usages ... ON CONFLICT DO NOTHING`);
- await c.query(`UPDATE vouchers SET usage_count = usage_count + 1 ...`);
+ const insertRes = await c.query(`INSERT INTO voucher_usages ... ON CONFLICT DO NOTHING`);
+ if (insertRes.rowCount > 0) {
+   await c.query(`UPDATE vouchers SET usage_count = usage_count + 1 ...`);
+ }
```

UPDATE `usage_count` sekarang hanya berjalan jika INSERT benar-benar memasukkan baris baru.

### Files Changed

- `backend/src/modules/vouchers/vouchers.service.js`

### Deployment

```bash
docker cp backend/src/modules/vouchers/vouchers.service.js hybrid_backend:/app/src/modules/vouchers/vouchers.service.js
docker restart hybrid_backend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| `usage_limit` adalah satu-satunya pembatas pemakaian voucher — tidak ada per-customer limit terpisah | Per-customer check bertentangan dengan semantik `usage_limit > 1` yang diharapkan admin |
| Setiap INSERT idempotent (`ON CONFLICT DO NOTHING`) yang diikuti UPDATE harus kondisional: cek `insertRes.rowCount > 0` sebelum menjalankan UPDATE | Jika tidak, retry atau concurrent call akan double-increment counter |
| Saat desain voucher: jika butuh pembatasan per-customer, tambahkan field `per_customer_limit` eksplisit di tabel `vouchers` | Jangan implisit encode per-customer limit sebagai "ada/tidak di usage table" karena ini konflik dengan `usage_limit` global |

---

## CR-046 — Auto-Refresh Approval Queue Tanpa Blink

**Date:** 2026-06-11
**CR Terkait:** CR-046

### Permintaan

Halaman `/helper` tab "Approval Queue" memperbarui data secara otomatis tanpa kedipan (blink), menggunakan mekanisme Virtual DOM React dan sistem Re-rendering.

### Root Cause Potensi Blink

Implementasi sebelumnya memanggil `fetchQueue()` yang selalu mengeksekusi `setLoading(true)`, kemudian mengganti seluruh state `queue` dengan array baru dari server (`setQueue(data)`). Dua masalah:

1. **`setLoading(true)` di background** — meski rendering bersyarat (`loading && queue.length === 0`) mencegah spinner tampil saat ada data, state change tetap memaksa re-render tidak perlu.
2. **`setQueue(data)` full replace** — setiap polling mengganti array dengan referensi baru. Seluruh `ApprovalCard` dan `ItemRow` menerima prop baru → React masuk ke reconciliation cycle penuh meski datanya tidak berubah.
3. **`ItemRow`/`ApprovalCard` bukan `React.memo`** — komponen re-render setiap kali parent re-render, terlepas dari apakah props berubah.

### Fix

**1. `fetchQueue(silent)` — dua mode**

```js
const fetchQueue = useCallback((silent = false) => {
  if (!silent) setLoading(true);   // hanya untuk initial load / manual refresh
  else         setRefreshing(true); // indikator kecil, tidak mengubah layout

  getApprovalQueue()
    .then(r => {
      setQueue(prev => mergeQueue(prev, r.data.data ?? []));
      setLastRefreshed(new Date());
    })
    ...
}, [onCountChange]);
```

- Polling (20 s) dan WebSocket push memanggil `fetchQueue(true)` → tidak ada spinner, tidak ada layout shift.
- Initial mount dan tombol Refresh manual memanggil `fetchQueue(false)` → spinner normal.

**2. `mergeQueue` + `mergeItems` — preserve object references**

```js
function mergeItems(prevItems, nextItems) {
  const prevMap = new Map(prevItems.map(i => [i.item_id, i]));
  return nextItems.map(i => {
    const old = prevMap.get(i.item_id);
    if (!old) return i;
    // Jika tidak ada yang berubah, kembalikan referensi lama
    if (old.approval_status === i.approval_status &&
        old.approved_quantity === i.approved_quantity &&
        old.rejection_reason  === i.rejection_reason &&
        old.quantity          === i.quantity) return old;
    return i;
  });
}
```

React membandingkan prop `item` dengan referensi (`===`). Jika referensi sama, `React.memo` bail out → tidak masuk render cycle sama sekali.

**3. `React.memo` pada `ItemRow` dan `ApprovalCard`**

```jsx
const ItemRow    = memo(function ItemRow(...)    { ... });
const ApprovalCard = memo(function ApprovalCard(...) { ... });
```

Kombinasi dengan smart merge: item yang tidak berubah → referensi sama → `memo` skip re-render.

**4. Visual auto-refresh indicator**

```jsx
{/* Pulsing green dot — auto-refresh active */}
<span className="relative flex h-2 w-2">
  <span className="animate-ping absolute ... bg-emerald-400 opacity-75" />
  <span className="relative ... bg-emerald-500" />
</span>
// + "diperbarui HH:MM:SS" di subtitle header
```

### Files Changed

- `frontend/src/components/helper/ApprovalQueueTab.jsx`

### Deployment

```bash
docker compose build frontend && docker compose up -d --no-deps frontend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| Jangan gunakan `setLoading(true)` untuk background refresh — pisahkan "initial load state" dari "background fetching state" | `setLoading` memicu re-render; untuk polling cukup `setRefreshing` yang tidak mengubah layout |
| Gunakan smart merge (`mergeQueue`/`mergeItems`) bukan full replace (`setQueue(data)`) saat memperbarui list | Full replace selalu menghasilkan referensi baru → semua child re-render meski data sama |
| Bungkus komponen list item dengan `React.memo` jika parent sering re-render karena polling | Tanpa `memo`, setiap polling cycle memaksa seluruh list masuk reconciliation |

---

## BUG-047 — Receipt & Pickup Page Tampilkan Qty Original, Bukan Qty Approved

**Date:** 2026-06-11
**CR Terkait:** —

### Symptom

`TXN-20260611-00064` — customer memesan ASTRO BOY ×4, helper menyetujui ×2. Halaman:
- `/pesanan/TXN-20260611-00064/receipt` → masih menampilkan **ASTRO BOY ×4**
- `/pesanan/TXN-20260611-00064/pickup` → masih menampilkan **×4** dan progress bar dihitung dari ×4

### Root Cause

Ini adalah pola yang sama dengan **BUG-045** (qty approved tidak ditampilkan). BUG-045 hanya memperbaiki `PaymentPage.jsx`, `ThermalReceipt.jsx`, dan `OrderTrackingPage.jsx`. Dua halaman lain terlewat saat audit:

| Halaman | File | Baris yang bermasalah |
|---|---|---|
| `/pesanan/:id/receipt` | `ReceiptPickupPage.jsx` | L125 `item.unit_price * item.quantity` · L128 `×{item.quantity}` · L165 `×{item.quantity}` |
| `/pesanan/:id/pickup` | `PickupStatusPage.jsx` | L59 `totalItems` · L60-62 `doneItems` · L116 `×{item.quantity}` |

Semua titik menggunakan `item.quantity` (qty yang dipesan customer) alih-alih `item.approved_quantity ?? item.quantity` (qty yang disetujui helper).

Tambahan: item dengan `approval_status = 'REJECTED'` tidak difilter, sehingga item yang ditolak tetap muncul di receipt dan pickup.

### Fix

**ReceiptPickupPage.jsx:**

```diff
- const groups = groupByTenant(order.items);
+ const groups = groupByTenant(order.items.filter(i => i.approval_status !== 'REJECTED'));

- {order.items.map((item, idx) => {
-   const priceIncTax = Math.round(item.unit_price * item.quantity * (1 + taxRate / 100));
+ {order.items.filter(i => i.approval_status !== 'REJECTED').map((item, idx) => {
+   const priceIncTax = Math.round(item.subtotal * (1 + taxRate / 100));

-   <span>{item.product_name} ×{item.quantity}</span>
+   <span>{item.product_name} ×{item.approved_quantity ?? item.quantity}</span>

# Bagian pickup instructions:
-   {item.product_name} ×{item.quantity}
+   {item.product_name} ×{item.approved_quantity ?? item.quantity}
```

**PickupStatusPage.jsx:**

```diff
- const groups = groupByTenant(order.items);
- const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
- const doneItems  = order.items.filter(i => i.pickup_status === 'DONE').reduce((sum, i) => sum + i.quantity, 0);
+ const activeItems = order.items.filter(i => i.approval_status !== 'REJECTED');
+ const groups = groupByTenant(activeItems);
+ const totalItems = activeItems.reduce((sum, i) => sum + (i.approved_quantity ?? i.quantity), 0);
+ const doneItems  = activeItems.filter(i => i.pickup_status === 'DONE').reduce((sum, i) => sum + (i.approved_quantity ?? i.quantity), 0);

- ×{item.quantity} · {formatRupiah(item.unit_price * item.quantity)}
+ ×{item.approved_quantity ?? item.quantity} · {formatRupiah(item.subtotal)}
```

### Files Changed

- `frontend/src/pages/customer/ReceiptPickupPage.jsx`
- `frontend/src/pages/customer/PickupStatusPage.jsx`

### Deployment

```bash
docker compose build frontend && docker compose up -d --no-deps frontend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| Saat menambah fitur yang mengubah qty item (approval, partial fulfillment, dll.), lakukan audit menyeluruh semua halaman yang menampilkan `item.quantity` | BUG-045 dan BUG-047 keduanya terjadi karena audit halaman tidak lengkap — hanya halaman "utama" yang difix, halaman downstream terlewat |
| Daftar halaman customer yang menampilkan qty item: `OrderTrackingPage`, `ReceiptPickupPage`, `PickupStatusPage`, `CartPage`, `ThermalReceipt`, `PaymentPage`, `orders.router.js` (public token) | Jadikan checklist ini sebagai standar setiap kali ada perubahan data qty/approval |
| Gunakan `item.subtotal` (nilai tersimpan di DB) bukan `item.unit_price * item.quantity` untuk kalkulasi harga — `subtotal` sudah mencerminkan approved qty setelah approval | Menghitung ulang dari `unit_price * quantity` selalu menghasilkan nilai pre-approval |
| Selalu filter `approval_status !== 'REJECTED'` sebelum render item di halaman customer | Item yang ditolak tidak boleh tampil di receipt, pickup list, atau progress bar |

---

## CR-048 — Hide Stok (pcs) di Halaman Detail Produk

**Date:** 2026-06-11
**CR Terkait:** CR-048

### Permintaan

Sembunyikan chip "52 pcs / Stock" di spec strip pada halaman `/product/:id` dan `/product_cart/:id`. Badge status (Tersedia/Stok Terbatas/Habis) tetap tampil.

### Root Cause

Saat spec strip didesain, tiga chip ditampilkan sejajar: Booth, Location, Stock (angka pcs). Jumlah stok eksak (`52 pcs`) tidak seharusnya terlihat oleh customer — hanya status kategoris (Available/Limited/Out) yang relevan.

### Fix

Hapus baris `<SpecItem emoji="📦" ... />` dari kedua komponen:

```diff
  <div style={{ display: 'flex', gap: 8 }}>
    <SpecItem emoji="🏪" value={product.tenant_name} label={t('product.booth')} />
    <SpecItem emoji="📍" value={product.booth_location ?? '-'} label={t('product.location')} />
-   <SpecItem emoji="📦" value={`${stock} pcs`} label={t('product.stock')} />
  </div>
```

### Files Changed

- `frontend/src/pages/customer/MockProductDetailPage.jsx`
- `frontend/src/pages/customer/ProductCartPage.jsx`

### Deployment

```bash
docker compose build frontend && docker compose up -d --no-deps frontend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| Halaman customer tidak boleh menampilkan angka stok eksak — hanya badge status kategoris | Angka stok adalah informasi operasional internal, bukan informasi yang perlu diketahui customer |
| Badge status (`getStockStatus()`) sudah cukup untuk customer: Tersedia / Stok Terbatas / Habis | Gunakan badge dari `stockUtils.js`, bukan angka raw `stock_quantity` |

---

## BUG-048 — Tab "Antrian Approval" di `/helper` Tampilkan Kosong Padahal Ada Data

**Tanggal:** 2026-06-12
**Layer:** Database + Backend + Frontend
**Page:** `/helper` → tab "Antrian Approval"
**Component:** `frontend/src/components/helper/ApprovalQueueTab.jsx`, `backend/src/app.js`
**Status:** ✅ Resolved

### Symptom

Helper membuka halaman `/helper` dan klik tab "Antrian Approval". Tab tampil dengan pesan "Antrian kosong ✅ Tidak ada pesanan yang menunggu persetujuan" meskipun ada transaksi dengan status `PENDING_APPROVAL` di database. Tidak ada pesan error apapun yang ditampilkan.

### Root Cause (3 lapisan)

| # | Layer | Defect |
|---|---|---|
| 1 | **DATABASE (PRIMER)** | Migration 015 (`approval_status` di `transaction_items`) dan/atau migration 017 (`approved_quantity`, `rejection_reason` di `transaction_items`) tidak diaplikasikan ke environment Docker. Query `getApprovalQueue()` mereferensikan kolom-kolom tersebut; PostgreSQL mengembalikan error 500 "column does not exist". |
| 2 | **FRONTEND (SEKUNDER)** | `ApprovalQueueTab.fetchQueue` menggunakan `.catch(() => {})` — error dari API sepenuhnya ditelan tanpa menampilkan pesan ke user. UI hanya melihat bahwa `queue` tetap `[]`, sehingga menampilkan empty state "Antrian kosong" yang menyesatkan. |
| 3 | **BACKEND (TERSIER)** | Tidak ada migration auto-runner di `backend/src/app.js`. Migrations hanya diaplikasikan secara manual via `docker exec`. Environment baru (fresh container, dev baru) tidak memiliki kolom-kolom ini secara otomatis. |

### Chain of Failure

```
Helper buka /helper → tab Antrian Approval
  → fetchQueue() → GET /api/v1/helper/approval-queue
  → getApprovalQueue() → SELECT ti.approval_status, ti.approved_quantity, ... FROM transaction_items
  → PostgreSQL: ERROR column "ti.approval_status" does not exist (migration 015 belum diapply)
             ATAU column "ti.approved_quantity" does not exist (migration 017 belum diapply)
  → withTransaction: ROLLBACK + rethrow
  → Error middleware: 500 Internal server error
  → Frontend: .catch(() => {}) → error ditelan, queue tetap []
  → UI: "Antrian kosong ✅" (padahal ada PENDING_APPROVAL transactions)
```

Catatan: BUG-041 (2026-06-11) memiliki root cause yang sama dan diselesaikan dengan `docker exec` manual. Fix ini memastikan recurrence tidak terjadi dengan menghapus dependency pada aplikasi manual.

### Fix

**Fix 1 — Frontend: Tambah error state ke `ApprovalQueueTab.jsx`**

Sebelumnya:
```js
.catch(() => {})
```

Sesudah:
```js
.catch((err) => {
  const status = err.response?.status;
  const msg    = err.response?.data?.message;
  setFetchError(
    status === 500
      ? 'Gagal memuat antrian (server error 500). Pastikan migration database 015 dan 017 sudah diaplikasikan.'
      : msg || 'Gagal memuat antrian. Periksa koneksi atau coba refresh.'
  );
})
```

Tambah state `fetchError` dan banner error merah di atas list yang menampilkan pesan error beserta tombol "Coba lagi". Empty state "Antrian kosong" hanya tampil jika tidak ada error (`!fetchError && queue.length === 0`).

**Fix 2 — Backend: Idempotent schema guard di `app.js` startup**

Tambah di `server.listen` callback (sekarang `async`):
```js
const helperApproveColumns = [
  `ALTER TABLE transaction_items  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'`,
  `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ`,
  `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS approved_by         UUID`,
  `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS timer_locked_until  TIMESTAMPTZ`,
  `ALTER TABLE transactions       ADD COLUMN IF NOT EXISTS approval_note       TEXT`,
  `ALTER TABLE transaction_items  ADD COLUMN IF NOT EXISTS approved_quantity   INTEGER`,
  `ALTER TABLE transaction_items  ADD COLUMN IF NOT EXISTS rejection_reason    TEXT`,
];
try {
  for (const sql of helperApproveColumns) await dbQuery(sql);
  logger.info('[Schema] HELPER_APPROVE columns verified (migrations 015 + 017 idempotent check done).');
} catch (e) {
  logger.warn('[Schema] HELPER_APPROVE column check warning:', e.message);
}
```

Setiap `ADD COLUMN IF NOT EXISTS` bersifat idempotent: tidak ada efek jika kolom sudah ada, menambahkan kolom jika belum ada. Ini memastikan fresh environment langsung siap tanpa manual `docker exec`.

### Files Changed

- `frontend/src/components/helper/ApprovalQueueTab.jsx` — tambah `fetchError` state, error banner UI, ubah `.catch(() => {})` menjadi catch dengan error state yang informatif
- `backend/src/app.js` — import `dbQuery`, tambah idempotent schema guard di `server.listen` callback

### Deployment

```bash
docker compose build --no-cache backend frontend
docker compose up -d backend frontend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| **Jangan pernah `.catch(() => {})` pada fetch yang mempengaruhi UI state** — selalu set error state agar user tahu ada masalah dan bisa retry | Silent catch menyembunyikan bug database/backend dan membuat user mengira "data memang kosong" padahal sebenarnya error |
| Setiap feature yang membutuhkan migration baru **harus memiliki idempotent schema guard** di startup backend | Fresh environment (developer baru, staging baru, Docker rebuild) tidak otomatis mendapat migration kecuali ada runner |
| Pattern `.catch(() => {})` hanya diizinkan untuk fire-and-forget side effects yang tidak mempengaruhi UI (analytics, cache warm-up, dll.) | Semua fetch yang menentukan apa yang ditampilkan ke user harus handle error secara eksplisit |

---

## BUG-049 — Semua Screen Blank Setelah Fix BUG-048

**Tanggal:** 2026-06-12
**Layer:** Frontend
**Component:** `frontend/src/components/helper/ApprovalQueueTab.jsx`
**Introduced by:** Fix BUG-048 (perubahan ternary chain di conditional render)
**Status:** ✅ Resolved

### Symptom

Setelah deploy fix BUG-048, seluruh halaman aplikasi (customer, helper, cashier, admin) menjadi blank — tidak ada konten yang tampil sama sekali. Tidak ada error di UI, hanya layar putih kosong.

### Root Cause

Saat mengubah ternary chain di `ApprovalQueueTab.jsx` untuk mendukung kondisi `fetchError`, kondisi terakhir dibiarkan tidak lengkap:

```jsx
// SEBELUM fix BUG-048 (benar):
) : (
  queue.map(...)
)}

// SESUDAH fix BUG-048 (SALAH — ternary tidak lengkap):
) : queue.length > 0 ? (
  queue.map(...)
)}   ← missing ': null'
```

Ternary operator `A ? B : C` selalu harus memiliki ketiga bagian. Jika bagian `C` (fallback) hilang, JavaScript/JSX mengalami syntax error. Vite membangun bundle meskipun ada JSX syntax error tertentu, tapi React crash saat runtime ketika mencoba merender komponen tersebut — menyebabkan seluruh React tree yang memuat `ApprovalQueueTab` (dan karena ini dimuat via lazy/import chain dari `App.jsx`) crash dengan white screen.

### Why ALL screens were affected

`ApprovalQueueTab.jsx` diimpor ke `HelperPage.jsx`, yang diimpor ke `App.jsx`. Saat React mencoba merender component tree, error JavaScript melempar exception yang tidak tertangkap di level provider/router, menyebabkan seluruh `<BrowserRouter>` crash — semua route ikut blank.

### Fix

Tambahkan `: null` sebagai fallback terakhir ternary:

```jsx
// Sebelum:
) : queue.length > 0 ? (
  queue.map(...)
)}

// Sesudah:
) : queue.length > 0 ? (
  queue.map(...)
) : null}
```

### Files Changed

- `frontend/src/components/helper/ApprovalQueueTab.jsx` — tambah `: null` pada akhir ternary chain

### Deployment

```bash
docker compose build --no-cache frontend
docker compose up -d --no-deps frontend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| **Setiap ternary `A ? B` yang bukan bagian dari `A ? B : C` adalah syntax error** — selalu pastikan ada `: fallback` di akhir | Jika kondisi terakhir bisa false tanpa output, gunakan `condition ? <jsx> : null` bukan `condition ? <jsx>` |
| Saat mengubah ternary chain (menambah kondisi di tengah), periksa seluruh chain dari atas ke bawah sebelum commit | Perubahan dari `(A ? X : Y)` menjadi `(A ? X : B ? Y : Z)` tanpa fallback `Z` adalah pola yang paling sering salah |
| Gunakan error boundary di top-level router untuk mencegah satu komponen crash membuat semua screen blank | Tanpa error boundary, satu syntax/runtime error di satu komponen bisa mematikan seluruh aplikasi |

---

## CR-049 — SPA Navigation: Ganti `window.location.href` dengan React Router `useNavigate`

**Date:** 2026-06-12
**CR Terkait:** —
**STD Baru:** STD-008
**Status:** ✅ Done

### Permintaan

Pastikan semua module/page menggunakan teknologi Virtual DOM dan Single Page Application (SPA) — tidak ada navigasi yang menyebabkan full page reload.

### Temuan Audit

Aplikasi sudah dibangun sebagai React SPA menggunakan React Router v6 dengan benar di semua halaman. Hanya **satu** pola yang melanggar SPA:

| File | Baris | Masalah |
|---|---|---|
| `frontend/src/api/client.js` | 24 | `window.location.href = '/masuk'` pada interceptor 401 — full page reload |

Semua `window.location` lainnya bersifat **read-only** dan tidak melanggar SPA:
- `useWebSocket.js`: baca `protocol` dan `host` untuk konstruksi URL WebSocket
- `CustomerShell.jsx`: baca `pathname` untuk cek kondisi, navigasi tetap via `navigate()`
- `TourProvider.jsx`: baca `pathname` untuk cek kondisi, navigasi tetap via `navigate()`
- `QrScannerModal.jsx`: baca `host`/`pathname` untuk error message display

### Root Cause Pelanggaran

`api/client.js` adalah modul biasa (bukan React component), sehingga **tidak bisa menggunakan `useNavigate()`** langsung. Solusi lama: `window.location.href` — berfungsi tapi mematikan SPA.

**Dampak negatif `window.location.href`:**
- Seluruh React virtual DOM di-destroy dan di-rebuild (state hilang)
- Cart, notifikasi, tour state — semua reset
- WebSocket diputus, harus reconnect dari awal
- JS bundle di-download ulang (meski dari cache, masih lebih lambat)
- User melihat layar putih sebentar (flash of blank)

### Solusi: Custom DOM Event Pattern

Karena `client.js` tidak bisa menggunakan React hooks, gunakan **window custom event** sebagai bridge antara Axios interceptor dan React Router:

```
401 terjadi
  → client.js: localStorage.clear + dispatchEvent('sos:session-expired')
  → AppRoutes (useEffect listener): logout() + navigate('/masuk', replace)
  → React Router: SPA navigate, zero page reload
```

### Fix

**`frontend/src/api/client.js`**

```diff
- localStorage.removeItem('sos_token');
- localStorage.removeItem('sos_user');
- window.location.href = '/masuk';
+ localStorage.removeItem('sos_token');
+ localStorage.removeItem('sos_user');
+ window.dispatchEvent(new CustomEvent('sos:session-expired'));
```

**`frontend/src/App.jsx`**

1. Tambah `useEffect` ke React import, `useNavigate` ke react-router-dom import
2. Tambah di `AppRoutes`:

```js
const { logout } = useAuth();
const navigate   = useNavigate();

useEffect(() => {
  const handleExpiry = () => {
    logout();
    navigate('/masuk', { replace: true });
  };
  window.addEventListener('sos:session-expired', handleExpiry);
  return () => window.removeEventListener('sos:session-expired', handleExpiry);
}, [logout, navigate]);
```

### Files Changed

- `frontend/src/api/client.js`
- `frontend/src/App.jsx`
- `STANDARD.md` — tambah STD-008 (SPA navigation rules)

### Deployment

```bash
docker compose build --no-cache frontend
docker compose up -d --no-deps frontend
```

### Recurrence Prevention (STD-008)

| Rule | Context |
|---|---|
| **Dilarang `window.location.href = '/path'`** untuk routing internal | Gunakan `useNavigate()` atau pattern Custom Event jika di luar komponen React |
| Modul non-React yang butuh trigger navigasi harus pakai `window.dispatchEvent(new CustomEvent('sos:...'))`; handler di `AppRoutes` | Pattern ini tetap pure SPA, React state tidak terganggu |
| Baca `window.location.*` (tanpa assignment) untuk keperluan non-navigasi masih diizinkan | WebSocket URL, display, kondisi check — tidak menyebabkan reload |

---

## CR-041 — OTP Login + Trusted Device

**Implemented:** 2026-06-12

**Feature:**
Login staff sekarang menggunakan OTP verifikasi saat login dari perangkat baru. Setelah OTP berhasil, perangkat dipercaya selama 30 hari — login berikutnya langsung tanpa OTP.

**Flow:**
1. Staff input username + password di `/staff/masuk`
2. Frontend kirim `deviceId` (UUID stabil dari localStorage) + `fingerprintHash` (FingerprintJS)
3. Backend cek:
   - Jika `otp_enabled = FALSE` atau `email` kosong → issue JWT langsung (backward compatible)
   - Jika device sudah trusted → skip OTP, issue JWT + refresh token
   - Jika device baru → generate OTP 6-digit, kirim ke email, return `{ requiresOtp: true, tempToken, maskedEmail }`
4. Frontend redirect ke `/staff/otp` dengan `tempToken` via route state
5. User input OTP → `POST /api/v1/auth/verify-otp` → device registered as trusted → JWT + refresh token issued
6. Email notifikasi perangkat baru dikirim setelah OTP berhasil

**Files Modified:**
- `backend/src/modules/auth/auth.service.js` — OTP flow, `verifyOtpAndLogin`, `refreshAccessToken`, device management
- `backend/src/modules/auth/auth.router.js` — endpoint `/verify-otp`, `/refresh`, `/logout`, `/devices`, `/devices/:id`
- `backend/src/app.js` — schema guard untuk tabel OTP (CREATE TABLE IF NOT EXISTS)

**Files Created:**
- `backend/migrations/018_cr041_alter_users_otp.sql` — kolom `email`, `otp_enabled` di tabel `users`
- `backend/migrations/019_cr041_login_otps.sql` — tabel `login_otps`
- `backend/migrations/020_cr041_trusted_devices.sql` — tabel `trusted_devices`
- `backend/migrations/021_cr041_refresh_tokens.sql` — tabel `refresh_tokens`
- `backend/src/modules/auth/otp.service.js` — generate, hash, store, verify OTP
- `backend/src/modules/auth/device.service.js` — checkTrustedDevice, registerTrustedDevice, list/revoke, refresh tokens
- `backend/src/services/email.service.js` (extended) — `sendOTPEmail`, `sendNewDeviceAlert`
- `frontend/src/utils/deviceFingerprint.js` — stable device UUID + FingerprintJS hash
- `frontend/src/pages/staff/OTPVerificationPage.jsx` — 6-digit OTP input dengan paste support
- `frontend/src/pages/staff/TrustedDevicesPage.jsx` — daftar & revoke perangkat terpercaya (`/settings/devices`)
- `frontend/src/api/auth.js` (extended) — `verifyOtp`, `refreshToken`, `logoutStaff`, `getDevices`, `revokeDevice`
- `frontend/src/pages/staff/LoginStaffPage.jsx` (modified) — kirim deviceId/fingerprint, handle `requiresOtp` redirect

**OTP Spec:**
- 6 digit, TTL 5 menit, max 3 percobaan, bcrypt-hashed di DB
- Device trust: 30 hari TTL, UUID stable per browser + FingerprintJS entropy
- Refresh token: per-device, SHA-256 hashed, TTL 30 hari

**Backward Compatibility:**
- User tanpa `email` atau `otp_enabled = FALSE` tetap login langsung tanpa OTP
- Existing JWT format tidak berubah; `deviceId` ditambahkan sebagai optional field

**Schema Guard:**
Tabel OTP dibuat via `CREATE TABLE IF NOT EXISTS` di startup `app.js` sehingga tidak bergantung pada manual migration untuk environment yang sudah ada.

---

## BUG-050 — Serah Terima Outstanding Tampilkan Qty Original, Bukan Qty Approved (TXN-20260612-00086)

**Tanggal:** 2026-06-13
**Layer:** Backend
**Page:** `/helper` → Serah Terima → Outstanding → HandoverDetailView
**Transaction:** TXN-20260612-00086 ("barbie dream house x 5" seharusnya "x 3")
**CR Terkait:** CR-040 (HELPER_APPROVE, per-item approved_quantity)
**Status:** ✅ Resolved

### Symptom

Helper membuka detail handover untuk TXN-20260612-00086. Panel menampilkan:

```
barbie dream house × 5
```

Padahal item tersebut sudah diapprove partial (approved_quantity = 3), seharusnya tampil:

```
barbie dream house × 3
```

### Root Cause

`getBoothOrder` di `backend/src/modules/helper/helper.service.js` (line 566–573) tidak menyertakan `ti.approved_quantity` dalam SELECT items:

```sql
-- SEBELUM (salah):
SELECT ti.product_id, p.product_name, ti.quantity, ti.unit_price, ti.subtotal,
       ti.pickup_status, ti.tenant_id
FROM transaction_items ti
JOIN products p ON p.product_id = ti.product_id
WHERE ti.transaction_id = $1 AND ti.tenant_id = $2
```

Frontend `HandoverDetailView` menggunakan pola:

```jsx
×{item.approved_quantity ?? item.quantity}
```

Karena `approved_quantity` tidak ada di response, `item.approved_quantity === undefined`. Operator `??` (nullish coalescing) mengevaluasi `undefined ?? item.quantity` → jatuh ke `item.quantity` (nilai ordered = 5), bukan approved = 3.

Bandingkan dengan `getApprovalQueue` (line 638–646) yang sudah benar mencantumkan `ti.approved_quantity` — konsistensi ini tidak direplikasi saat `getBoothOrder` ditulis.

### Fix

Tambahkan `ti.approved_quantity` (dan `p.barcode` untuk display) ke SELECT items di `getBoothOrder`:

**`backend/src/modules/helper/helper.service.js` — line 567:**

```diff
- SELECT ti.product_id, p.product_name, ti.quantity, ti.unit_price, ti.subtotal,
-        ti.pickup_status, ti.tenant_id
+ SELECT ti.product_id, p.product_name, p.barcode, ti.quantity, ti.approved_quantity,
+        ti.unit_price, ti.subtotal, ti.pickup_status, ti.tenant_id
```

Frontend display `×{item.approved_quantity ?? item.quantity}` sudah benar — tidak perlu diubah.

### Files Changed

- `backend/src/modules/helper/helper.service.js` — tambah `ti.approved_quantity, p.barcode` ke SELECT di `getBoothOrder`

### Deployment

```bash
docker compose restart backend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| Setiap query yang mengembalikan `transaction_items` untuk keperluan **display ke helper/kasir** wajib menyertakan `ti.approved_quantity` | Kolom ini ditambahkan di CR-040 (migration 017). Qty yang relevan untuk ditampilkan adalah approved_quantity (apa yang benar-benar disediakan), bukan quantity (apa yang dipesan) |
| Saat menulis fungsi query baru yang mengambil items, selalu cross-check dengan `getApprovalQueue` sebagai reference — ia sudah memiliki kolom yang lengkap | `getApprovalQueue` adalah contoh canonical SELECT transaction_items yang benar |
| Frontend `??` (nullish coalescing) adalah fallback yang benar untuk `approved_quantity`, tapi ia hanya bisa bekerja jika backend mengirim field tersebut | Pastikan backend mengembalikan field, bukan mengandalkan frontend untuk "menebak" nilai default |

---

## BUG-051 — Field "Kategori *" di Admin Master Data Tidak Ada Menu Tambah Kategori

**Tanggal:** 2026-06-13
**Layer:** Frontend + Backend
**Page:** `/admin` → Master Data → modal Tambah Produk / Edit Produk → field "Kategori *"
**Status:** ✅ Resolved

### Symptom

Admin membuka form tambah/edit produk dan mengisi field "Kategori *". Dropdown `CategoryCombobox` hanya menampilkan kategori yang sudah ada. Tidak ada cara untuk mendaftarkan kategori baru langsung dari form tersebut — admin harus menutup modal, menambahkan kategori lewat cara lain (tidak ada), lalu kembali.

### Root Cause

Dua lapisan yang saling absen:

1. **Backend** — `product_categories` table sudah ada (migration 007) namun tidak ada endpoint untuk menambah baris baru. `listCategories()` hanya membaca, tidak ada `createCategory()`.

2. **Frontend** — `CategoryCombobox` hanya menampilkan suggestions dari list yang ada. Tidak ada affordance "Tambahkan '{teks}'" untuk nilai yang belum terdaftar. Prop `onAddNew` tidak pernah didefinisikan.

### Fix

**`backend/src/modules/products/products.service.js`**
Tambah fungsi `createCategory(name)`:
```js
async function createCategory(name) {
  // INSERT INTO product_categories ... ON CONFLICT DO NOTHING
}
```

**`backend/src/modules/products/products.router.js`**
Tambah endpoint `POST /api/v1/products/categories` (auth: LEADER, ADMIN).

**`frontend/src/api/products.js`**
Tambah `createCategory(name)` → `POST /products/categories`.

**`frontend/src/components/ui/CategoryCombobox.jsx`**
- Tambah prop `onAddNew?: (name: string) => Promise<void>`
- Saat `value` tidak kosong dan tidak ada exact match, tampilkan item `➕ Tambahkan "{value}"` di bagian bawah dropdown
- Saat diklik: jalankan `onAddNew(value.trim())` dengan loading state (`adding`)

**`frontend/src/pages/admin/tabs/MasterDataTab.jsx`**
- Import `createCategory` dari `api/products`
- Tambah `handleAddCategory(name)`: call API → refresh `categories` state → toast sukses/gagal
- Tambah prop `onAddCategory` di `FormFields` → forward ke `CategoryCombobox` sebagai `onAddNew`
- Wire ke kedua `<FormFields>` (Create Modal + Edit Modal)

### Files Changed

- `backend/src/modules/products/products.service.js` — tambah `createCategory`
- `backend/src/modules/products/products.router.js` — tambah `POST /categories`
- `frontend/src/api/products.js` — tambah `createCategory`
- `frontend/src/components/ui/CategoryCombobox.jsx` — tambah prop `onAddNew` + UI "Tambahkan"
- `frontend/src/pages/admin/tabs/MasterDataTab.jsx` — import, handler, wire ke FormFields

### Deployment

```bash
docker compose restart backend
docker compose build --no-cache frontend && docker compose up -d --no-deps frontend
```

### Recurrence Prevention

Lihat STD-009 di STANDARD.md — setiap field admin yang referensi list konfigurasi wajib punya affordance tambah nilai baru inline.


---

## CR-053 — Delete Item Approval Workflow (Kasir → Leader)

**Date:** 2026-06-13  
**Type:** CR (Change Request)  
**Layer:** Backend + Frontend  
**Status:** ✅ Done

### Deskripsi

Kasir tidak bisa langsung menghapus item dari keranjang POS — setiap permintaan hapus item wajib disetujui oleh Leader secara real-time via WebSocket.

### Flow

1. **Kasir ajukan hapus** — Kasir tap ikon 🗑️ pada item di keranjang → permintaan PENDING dikirim ke backend → item di-dim dengan badge "⏳ Menunggu persetujuan leader..." → notifikasi real-time ke semua Leader via WS event `delete_request:new`
2. **Leader review** — Leader buka halaman `/leader/hapus-approval` → melihat kartu permintaan dengan detail produk, qty, subtotal, nama kasir, dan waktu → pilih Setujui atau Tolak (dengan alasan opsional)
3. **Keputusan** — Backend update status + (jika disetujui dan ada transaction_id) hapus item dari `transaction_items` + recalculate total → emit WS event `delete_request:resolved` ke cashier yang bersangkutan → UI kasir update otomatis

### Root Cause (Pre-existing Gap)

Belum ada workflow kontrol perubahan keranjang POS. Kasir bisa hapus item sembarangan tanpa oversight dari leader, membuka risiko manipulasi transaksi.

### Fix

**Database:**
- Tabel `item_delete_requests` dibuat via idempotent schema guard di `app.js` startup
- Kolom: `request_id` SERIAL PK, `transaction_id` VARCHAR FK, `product_id` INT, `product_name` TEXT, `qty` INT, `subtotal` NUMERIC, `cashier_id` UUID FK, `cashier_name` TEXT, `status` TEXT (PENDING/APPROVED/REJECTED), `reason` TEXT, `reviewed_by` UUID FK, `created_at` TIMESTAMPTZ, `reviewed_at` TIMESTAMPTZ

**WebSocket (`backend/src/ws/websocket.js`):**
- Tambah `leaderClients: Set<WebSocket>` — semua LEADER/ADMIN yang terkoneksi
- Tambah `cashierClients: Map<cashierId, Set<WebSocket>>` — per kasir by UUID
- Tambah `broadcastToLeaders(payload)` dan `broadcastToCashier(cashierId, payload)`
- AUTH handler sekarang register LEADER/ADMIN ke leaderClients dan CASHIER ke cashierClients

**Backend Service:**
- `cashier.service.js`: `createDeleteRequest()`, `getPendingDeleteRequests(cashierId)`
- `leader.service.js`: `listDeleteRequests(status)`, `reviewDeleteRequest(requestId, leaderId, action, reason)` — dengan hapus transaction_item + recalculate total jika disetujui dan ada transaction_id

**Backend Router:**
- `POST /api/v1/cashier/delete-requests` (CASHIER) — buat request + emit WS ke leaders
- `GET /api/v1/cashier/delete-requests/pending` (CASHIER) — restore pending state setelah reload
- `GET /api/v1/leader/delete-requests?status=PENDING` (LEADER/ADMIN)
- `PATCH /api/v1/leader/delete-requests/:id` (LEADER/ADMIN) — approve/reject + emit WS ke cashier

**Frontend:**
- `api/cashier.js`: `createDeleteRequest`, `getPendingDeleteRequests`
- `api/leader.js`: `getDeleteRequests`, `reviewDeleteRequest`
- `CashierPOSPage.jsx`: state `pendingDeleteIds` (Set), load pending on mount, WS listener `delete_request:resolved`, tombol 🗑️ → kirim request, item pending = dim + badge + disable qty controls
- Halaman baru `LeaderDeleteApprovalPage.jsx` di `/leader/hapus-approval` — panel real-time dengan `RequestCard` per permintaan (Setujui/Tolak + alasan), WS listener `delete_request:new`
- `App.jsx`: import + nav item "🗑️ Hapus Approval" + route `/leader/hapus-approval`

### Files Changed

- `backend/src/ws/websocket.js`
- `backend/src/app.js` — schema guard
- `backend/src/modules/cashier/cashier.service.js`
- `backend/src/modules/cashier/cashier.router.js`
- `backend/src/modules/leader/leader.service.js`
- `backend/src/modules/leader/leader.router.js`
- `frontend/src/api/cashier.js`
- `frontend/src/api/leader.js`
- `frontend/src/pages/cashier/CashierPOSPage.jsx`
- `frontend/src/pages/leader/LeaderDeleteApprovalPage.jsx` (new)
- `frontend/src/App.jsx`

### Deployment

```bash
docker compose restart backend
docker compose build --no-cache frontend && docker compose up -d --no-deps frontend
```

---

## BUG-052 — Halaman `/daftar` dan `/masuk` Selalu Tampil "Amazing Toys Fair 2026" Hardcoded Setelah Rebuild

**Tanggal:** 2026-06-13

### Symptom

Halaman `/daftar` (RegisterPage) dan `/masuk` (LoginCustomerPage) menampilkan `"Amazing Toys Fair 2026"` secara permanen, bahkan setelah admin mengubah nama event via Admin → Konfigurasi. Setiap kali `docker compose up --build` dijalankan, perubahan admin hilang dan halaman kembali ke nilai hardcoded.

### Root Cause (3 lapis)

**Layer 1 — Dockerfile tidak meng-copy `data/`:**
Backend Dockerfile hanya meng-copy `src/`, `migrations/`, dan `add-admin.js`. Direktori `backend/data/` (tempat `system-config.json` disimpan) **tidak pernah masuk ke Docker image**. Akibatnya, setiap kali container dibuat ulang, `/app/data/` kosong.

**Layer 2 — Tidak ada Docker volume untuk `/app/data`:**
Karena tidak ada named volume, `/app/data/system-config.json` hanya hidup di writable layer container. Setiap `docker compose up --build` → container baru → writable layer kosong → file hilang.

**Layer 3 — Fallback ganda yang masking bug:**
Saat `/app/data/system-config.json` tidak ada, backend mengembalikan `DEFAULT_SYSTEM_CONFIG` yang juga hardcode `event_name: 'Amazing Toys Fair 2026'`. Di frontend, fallback `t('login.subtitle')` / `t('register.subtitle')` di `LangContext.jsx` juga bernilai `'Amazing Toys Fair 2026'`. Kedua fallback ini menghasilkan tampilan yang sama dengan nilai admin yang benar, sehingga bug tidak terdeteksi secara visual — tampak normal padahal koneksi ke admin config sudah putus.

### Fix

**1. `backend/Dockerfile` — tambah `COPY data ./data`:**
```dockerfile
COPY src ./src
COPY migrations ./migrations
COPY add-admin.js ./add-admin.js
COPY data ./data          # ← added
```
Menjamin `system-config.json` dari git selalu ada di image sebagai initial default.

**2. `docker-compose.yml` — tambah named volume `hybrid_config_data`:**
```yaml
backend:
  volumes:
    - hybrid_uploads_data:/app/public/uploads
    - hybrid_config_data:/app/data    # ← added

volumes:
  hybrid_config_data:                 # ← added
```
Volume ini berperilaku: saat volume baru/kosong + image punya file di path yang sama → Docker meng-copy file dari image ke volume (Docker's named-volume seeding). Setelah itu, perubahan admin via UI tersimpan di volume dan **tidak hilang** meski container di-rebuild.

**3. `backend/data/system-config.json` — sinkronisasi dengan config admin:**
Diperbarui dari `"Amazing Toy Show"` → `"Amazing Toys Fair 2026"` dan struktur field diselaraskan dengan versi production (field `txn_timeout_checkout`, `printer_type`, dll.).

### Behavior Setelah Fix

| Skenario | Sebelum | Sesudah |
|---|---|---|
| Fresh install (`docker compose up`) | `/app/data/` kosong → DEFAULT_SYSTEM_CONFIG | Volume dibuat, Docker seed dari image → `system-config.json` tersedia |
| Admin ubah event name via UI | Tersimpan di writable layer container | Tersimpan di volume `hybrid_config_data` |
| `docker compose up --build` (rebuild) | Writable layer hilang → config hilang → kembali ke hardcoded | Volume dipertahankan → config admin tetap ada |
| Reset config ke default | — | `docker volume rm hybrid_hybrid_config_data` lalu `docker compose up -d --build` |

### Files Changed

- `backend/Dockerfile`
- `docker-compose.yml`
- `backend/data/system-config.json`

### Deployment

```bash
docker compose up -d --build backend
```

> **Catatan:** Volume `hybrid_config_data` dibuat otomatis saat pertama kali. Jika volume sudah ada dari run sebelumnya, data di volume tetap dipakai (tidak di-overwrite oleh image).

### Invariant untuk Mencegah Regresi

- **Setiap kali ada field baru di `DEFAULT_SYSTEM_CONFIG`**, tambahkan juga ke `backend/data/system-config.json` agar fresh install mendapat nilai yang benar.
- **Jangan hapus `COPY data ./data` dari Dockerfile** — ini adalah mekanisme seeding untuk volume kosong.
- **Jangan ubah `/daftar` dan `/masuk` hanya untuk cosmetic** — halaman ini sudah benar menggunakan `usePublicConfig()`. Jika event name tidak muncul dari admin config, cek volume dan endpoint `/config/public`, bukan source page.

---

## CR-061 — Fraud Protection: Sistem Proteksi pada Fitur Hapus Item Kasir

**Tanggal:** 2026-06-13

### Latar Belakang

Skenario fraud: kasir tambah item X → customer bayar EDC (total sudah include X) → kasir submit delete request setelah PAID → leader approve → nominal EDC tidak cocok total akhir → selisih digelapkan.

### Root Cause

Tidak ada guard yang mencegah approval delete request pada transaksi yang sudah PAID. `reviewDeleteRequest()` di `leader.service.js` langsung melakukan `DELETE FROM transaction_items` tanpa mengecek status transaksi.

Selain itu, tidak ada mekanisme untuk membekukan nominal yang ditagih saat pembayaran, sehingga perubahan total setelah PAID tidak bisa dideteksi.

### Fix

**FIX 1 — Block delete pada TRX PAID** (`leader.service.js`):
`reviewDeleteRequest()` query status transaksi sebelum approve. Jika `PAID` → throw `AppError` 409.

**FIX 2 — Kolom `amount_charged`** (migration `023_cr061_fraud_protection.sql`):
`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_charged NUMERIC(14,2);`
Set atomik saat `processPayment()` (`payments.service.js`) dan `groupCheckout()` (`cashier.service.js`) mengubah status ke PAID.

**FIX 3 — Audit log ADD_ITEM** (`orders.service.js`):
`addItemToTransaction()` — upgrade ke action `ADD_ITEM` dengan `product_name`, `qty`, `subtotal`, `total_before`, `total_after`.

**FIX 4 — Fraud alert WS** (`leader.service.js`):
Sebelum throw 409, broadcast `fraud_alert:delete_on_paid` ke semua leader online. Payload: `{ cashier_id, cashier_name, transaction_id, product_name, qty, subtotal, attempted_at }`.

**FIX 5 — Discrepancy endpoint** (`leader.router.js` + `leader.service.js`):
`GET /api/v1/leader/discrepancies?date=YYYY-MM-DD` → PAID transactions hari ini dengan `amount_charged ≠ total_amount`. Require LEADER/ADMIN.

### Files Changed

| File | Perubahan |
|---|---|
| `backend/src/modules/leader/leader.service.js` | Import `broadcastToLeaders`; guard PAID; fraud WS broadcast; `getDiscrepancies()` |
| `backend/src/modules/leader/leader.router.js` | `GET /discrepancies` endpoint |
| `backend/src/modules/payments/payments.service.js` | `amount_charged = total_amount` saat PAID |
| `backend/src/modules/cashier/cashier.service.js` | `amount_charged = total_amount` di group checkout |
| `backend/src/modules/orders/orders.service.js` | Audit log `ADD_ITEM` diperkaya |
| `backend/migrations/023_cr061_fraud_protection.sql` | Tambah kolom `amount_charged` |

### Deployment

```bash
docker exec hybrid_postgres psql -U postgres -d amazing_toys_hybrid \
  -c "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_charged NUMERIC(14,2);"
docker compose restart backend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| Selalu cek status TRX sebelum mutasi item — terutama pada approval flow | DELETE/UPDATE item harus guard `status != 'PAID'` |
| Setiap payment path harus set `amount_charged` | `processPayment` dan `groupCheckout` adalah dua path yang ada — audit jika ditambah path baru |
| `ADD_ITEM` audit log wajib mencatat `total_before` dan `total_after` | Tanpa ini kronologi fraud tidak bisa direkonstruksi |

---

## BUG-053 — QR Scanner Tidak Bekerja pada Perangkat Lama

**Tanggal:** 2026-06-13

### Symptom

QR Scanner modal tidak bisa membuka kamera atau kamera terbuka tapi tidak pernah mendeteksi QR code pada perangkat dengan browser lama (Android Chrome < 53, iOS Safari < 11, Firefox lama).

### Root Cause (6 lapis)

**1. Tidak ada legacy `getUserMedia` polyfill:**
`QrScannerModal` hanya memanggil `navigator.mediaDevices.getUserMedia`. Perangkat dengan Android 4.x / Chrome lama menggunakan `navigator.webkitGetUserMedia` (callback-based). Hasilnya: error `NotSupportedError` atau `navigator.mediaDevices` adalah `undefined` → scanner langsung tampilkan pesan error.

**2. Tidak ada constraint cascade — `OverconstrainedError` mematikan scanner:**
Constraint `{ width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } }` bisa menyebabkan `OverconstrainedError` pada kamera lama. Tanpa fallback, scanner langsung mati meski kamera tersedia.

**3. `video.play()` tidak mengembalikan Promise pada browser lama:**
`await video.play()` — jika `play()` mengembalikan `undefined` (pre-2017 behavior), `await undefined` berhasil tapi error kamera tidak pernah terpropagasi. Kalau `play()` gagal secara silent, `setStarting(false)` tidak terpanggil dan scanner stuck di loading.

**4. `video.srcObject` tidak ada di iOS Safari < 11:**
iOS Safari lama hanya mendukung `video.src = URL.createObjectURL(stream)`. Tanpa fallback, kamera tidak pernah ditampilkan.

**5. `video.videoWidth / videoHeight = 0` pada old Android:**
Android Chrome lama melaporkan `0×0` meski `readyState === 4 (HAVE_ENOUGH_DATA)`. `jsQR` menerima array pixel kosong → tidak pernah mendeteksi QR code.

**6. Error name berbeda di browser lama:**
`NotAllowedError` (modern) vs `PermissionDeniedError` (lama), `NotFoundError` vs `DevicesNotFoundError`, `NotReadableError` vs `TrackStartError` — pesan error yang ditampilkan ke user selalu "unknown".

### Fix

`frontend/src/components/ui/QrScannerModal.jsx`:

1. **Helper `getMediaStream(constraints)`** — coba `mediaDevices.getUserMedia` → fallback ke `webkitGetUserMedia` → `mozGetUserMedia` via Promise wrapper
2. **Constraint cascade** — 3 level: ideal constraints → bare `facingMode: 'environment'` → `{ video: true }`
3. **`play()` Promise guard** — `const p = video.play(); if (p !== undefined) await p;`
4. **`srcObject` fallback** — `if ('srcObject' in video) { video.srcObject = stream } else { video.src = URL.createObjectURL(stream) }`
5. **`videoWidth/Height > 0` guard di `scanLoop`** — skip frame jika dimensi belum ready
6. **`canvas.getContext()` null guard** — defensive check setelah getContext
7. **Error name mapping diperluas** — tambah `PermissionDeniedError`, `DevicesNotFoundError`, `TrackStartError`

### Files Changed

- `frontend/src/components/ui/QrScannerModal.jsx`

### Deployment

```bash
docker compose build --no-cache frontend
docker compose up -d --no-deps frontend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| Selalu sediakan legacy `getUserMedia` polyfill saat mengakses kamera | `mediaDevices` API tidak ada di Android < Chrome 53 |
| Constraint getUserMedia harus punya fallback cascade | `OverconstrainedError` harus ditangkap dan dicoba ulang dengan constraint lebih longgar |
| `video.play()` harus di-guard `!== undefined` sebelum `await` | Pre-2017 browser tidak return Promise dari media element methods |
| Cek `videoWidth > 0 && videoHeight > 0` sebelum memproses frame | Old Android Chrome laporkan `0×0` meski readyState sudah HAVE_ENOUGH_DATA |

---

## BUG-054 — Hapus Item (CR-053/CR-061) Tidak Mengembalikan Stok + PaymentPage Delete Button Tidak Dapat `product_id`

**Tanggal:** 2026-06-13
**Layer:** Backend (2 titik)
**CR Terkait:** CR-053, CR-061
**Status:** ✅ Resolved

### Symptom

1. Kasir submit delete request → Leader setujui → item hilang dari transaksi, tapi **stok produk tidak bertambah kembali** — stok "hilang permanen" setiap kali item dihapus via approval.
2. Tombol hapus (🗑️) yang baru ditambahkan di PaymentPage mengirim `product_id: undefined` ke backend → backend menolak dengan "product_id wajib diisi" — karena `lookupTransaction()` tidak menyertakan `product_id` di query items.

### Root Cause

**Root Cause 1 — `reviewDeleteRequest()` tidak ada stock restoration:**

`leader.service.js` `reviewDeleteRequest()` saat action `approve`:
- ✅ Menghapus item dari `transaction_items`
- ✅ Merecalculate `total_amount` transaksi
- ❌ **Tidak memanggil `UPDATE products SET stock_quantity = stock_quantity + qty`**

Saat CR-053 diimplementasikan, workflow hapus item difokuskan pada audit trail dan total recalculation. Bagian stock restoration terlewat — padahal setiap flow lain yang menghapus item selalu mengembalikan stok (`cancelOrder`, `cancelHelperOrder`, `removeOrderItem` semua memiliki stock restore).

**Root Cause 2 — `lookupTransaction()` tidak include `product_id` di SELECT items:**

`payments.service.js` `lookupTransaction()` query items:
```sql
SELECT ti.quantity, ti.approved_quantity, ti.approval_status,
       ti.unit_price, ti.subtotal, p.product_name, p.image_url, ...
```

Kolom `ti.product_id` tidak disertakan. PaymentPage yang baru menggunakan `item.product_id` untuk `pendingDeleteIds.has(item.product_id)` dan `handleDeleteRequest(item)` — semua hasilnya `undefined`. Delete request dikirim dengan `product_id: undefined`, diblokir oleh validasi backend.

**Root Cause 3 — `reviewDeleteRequest()` hanya recalculate `total_amount`, tidak `subtotal_amount` dan `tax_amount`:**

Query recalculate hanya mengupdate kolom `total_amount`. Setelah item dihapus, `subtotal_amount` dan `tax_amount` di tabel `transactions` tetap di nilai lama — inconsisten dengan `total_amount` yang baru.

### Fix

**Fix 1 — `backend/src/modules/leader/leader.service.js`**

Tambah stock restoration SEBELUM DELETE, dalam blok `action === 'approve'`:
```js
// Restore stock — item is leaving the transaction so stock comes back
await client.query(
  `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2`,
  [req.qty, req.product_id],
);
```

**Fix 2 — `backend/src/modules/payments/payments.service.js`**

Tambah `ti.product_id` ke SELECT items di `lookupTransaction()`:
```diff
-SELECT ti.quantity, ti.approved_quantity, ti.approval_status,
+SELECT ti.product_id, ti.quantity, ti.approved_quantity, ti.approval_status,
        ti.unit_price, ti.subtotal, p.product_name, ...
```

**Fix 3 — `backend/src/modules/leader/leader.service.js`**

Ganti recalculate `total_amount` saja dengan recalculate 3 kolom sekaligus (subtotal, tax, total):
```sql
UPDATE transactions t
SET subtotal_amount = COALESCE(sub.s, 0),
    tax_amount      = ROUND(COALESCE(sub.s, 0) * t.tax_rate / 100),
    total_amount    = COALESCE(sub.s, 0) + ROUND(COALESCE(sub.s, 0) * t.tax_rate / 100)
FROM (
  SELECT COALESCE(SUM(subtotal), 0) AS s
  FROM transaction_items
  WHERE transaction_id = $1 AND approval_status != 'REJECTED'
) sub
WHERE t.transaction_id = $1
```

### Files Changed

- `backend/src/modules/leader/leader.service.js` — stock restoration + full recalculate (3 kolom)
- `backend/src/modules/payments/payments.service.js` — tambah `ti.product_id` ke SELECT items

### Deployment

```bash
docker compose restart backend
```

### Recurrence Prevention

| Rule | Context |
|---|---|
| **Setiap fungsi yang menghapus item dari transaksi WAJIB mengembalikan stok** — `cancelOrder`, `cancelHelperOrder`, `removeOrderItem` sudah benar; pattern ini harus selalu diikuti | Stock adalah sumber kebenaran inventory — setiap penghapusan item = stok kembali |
| Saat membuat query items baru (untuk endpoint yang belum ada), cross-check kolom dengan `getTransaction()` di `orders.service.js` sebagai referensi lengkap | `lookupTransaction()` ditulis sebelum CR-053/CR-061 dan tidak membutuhkan `product_id` saat itu — tapi setiap penambahan fitur yang butuh `product_id` harus update query ini |
| Recalculate setelah hapus item = 3 kolom: `subtotal_amount`, `tax_amount`, `total_amount` — bukan hanya `total_amount` | Inconsistency antara 3 kolom ini bisa menyebabkan discrepancy report CR-061 melaporkan false positive |

---

## BUG-055 — Page `/masuk` Klik Login → Internal Server Error

**Tanggal:** 2026-06-13
**Layer:** Database + Backend
**Page:** `/masuk` (LoginCustomerPage)
**Status:** ✅ Resolved

### Symptom

Customer membuka halaman `/masuk`, mengisi nomor HP, klik tombol "Masuk" → halaman menampilkan pesan error "Internal server error." (HTTP 500). Login tidak bisa dilanjutkan.

### Root Cause (3 lapisan)

| # | Layer | Defect |
|---|---|---|
| 1 | **DATABASE (PRIMER)** | Tabel `customer_otps` dan `customer_trusted_devices` tidak ada di DB. `loginCustomer()` di `auth.service.js` memanggil `customerDeviceSvc.checkTrustedDevice()` dan `customerOtpSvc.storeOTP()` → PostgreSQL mengembalikan `ERROR: relation "customer_otps" does not exist` (atau `customer_trusted_devices`) → 500. |
| 2 | **BACKEND (SEKUNDER)** | Migration `024_customer_otp_devices.sql` tidak pernah berjalan karena DB volume sudah ada. `docker-entrypoint-initdb.d` script hanya berjalan saat volume kosong pertama kali. Tabel tidak pernah dibuat. |
| 3 | **BACKEND (TERSIER — BLOCKER GANDA)** | Migration 024 mendefinisikan `customer_id INTEGER` pada kedua tabel (`customer_otps` dan `customer_trusted_devices`). Tabel `customers.customer_id` bertipe `UUID`. Tipe FK yang salah menyebabkan `CREATE TABLE` gagal dengan `ERROR: foreign key constraint cannot be implemented — Key columns "customer_id" and "customer_id" are of incompatible types: integer and uuid`. Bahkan jika schema guard berjalan, tabel tetap tidak terbuat. |

### Chain of Failure

```
Customer klik "Masuk" → POST /api/v1/auth/customer/login
  → loginCustomer() → customerDeviceSvc.checkTrustedDevice(customer_id, deviceId)
  → SELECT FROM customer_trusted_devices WHERE customer_id = $1
  → PostgreSQL: ERROR relation "customer_trusted_devices" does not exist
     (atau jika guard sudah berjalan dengan INTEGER: FK type mismatch → tabel tidak terbuat)
  → error middleware: 500 Internal server error
  → Frontend: "Internal server error."
```

### Fix

**Fix 1 — Idempotent schema guard di `backend/src/app.js`**

Tambah blok migration 024 di `server.listen` callback, menggunakan tipe `UUID` yang benar untuk `customer_id` di kedua tabel:

```js
const migration024Statements = [
  `CREATE TABLE IF NOT EXISTS customer_otps (
     id            SERIAL PRIMARY KEY,
     customer_id   UUID        NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
     otp_hash      TEXT        NOT NULL,
     expires_at    TIMESTAMPTZ NOT NULL,
     used_at       TIMESTAMPTZ,
     attempt_count INTEGER     NOT NULL DEFAULT 0,
     ip_address    INET,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_customer_otps_customer_id ON customer_otps (customer_id)`,
  `CREATE TABLE IF NOT EXISTS customer_trusted_devices (
     id           SERIAL PRIMARY KEY,
     customer_id  UUID         NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
     device_id    UUID         NOT NULL,
     device_name  VARCHAR(200),
     browser      VARCHAR(200),
     ip_address   INET,
     last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
     expires_at   TIMESTAMPTZ  NOT NULL,
     created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
     UNIQUE (customer_id, device_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_customer_trusted_devices_lookup
     ON customer_trusted_devices (customer_id, device_id)`,
];
try {
  for (const sql of migration024Statements) await dbQuery(sql);
  logger.info('[Schema] Migration 024 verified — customer_otps + customer_trusted_devices ready.');
} catch (e) {
  logger.warn('[Schema] Migration 024 schema check warning:', e.message);
}
```

**Fix 2 — `backend/migrations/024_customer_otp_devices.sql`**

Ubah kedua `customer_id INTEGER` → `customer_id UUID` agar migration file konsisten dengan tipe sebenarnya di tabel `customers`.

**Verifikasi:** Log startup menampilkan `[Schema] Migration 024 verified — customer_otps + customer_trusted_devices ready.` tanpa warning.

### Files Changed

- `backend/src/app.js` — tambah idempotent schema guard migration 024 dengan tipe `UUID` yang benar
- `backend/migrations/024_customer_otp_devices.sql` — fix tipe FK: `INTEGER` → `UUID` pada kedua tabel

### Deployment

```bash
docker compose build backend
docker compose up -d --no-deps backend
```

> **Catatan:** `docker compose restart backend` tidak cukup karena hanya merestart container yang ada — kode baru tidak masuk. Harus `build` → `up --no-deps` karena backend tidak memiliki source code volume mount.

### Recurrence Prevention

| Rule | Context |
|---|---|
| **Setiap tabel baru yang dibutuhkan feature wajib memiliki idempotent schema guard di `backend/src/app.js`** | Migration SQL di `docker-entrypoint-initdb.d` hanya berjalan pada volume kosong pertama kali. Environment yang sudah ada tidak mendapat tabel baru dari migration tanpa guard. Lihat STD-010. |
| **Tipe FK harus sama persis dengan tipe PK tabel yang direferensikan** — selalu cek tipe PK sebelum menulis migration | `customers.customer_id` adalah `UUID`. Menulis `customer_id INTEGER` akan selalu gagal dengan `incompatible types` tanpa pesan error yang jelas di startup log jika logger format objek tidak benar. |
| Setelah menambah schema guard, selalu rebuild image (`docker compose build backend`) dan verifikasi log `[Schema] ... verified` saat startup | `docker compose restart` memakai image lama — perubahan kode tidak terpakau sampai image direbuild. |
| Saat schema guard gagal dengan warning kosong (`[Schema] xxx schema check warning:`), jalankan SQL langsung di container untuk melihat error aslinya: `docker exec hybrid_postgres psql -U postgres -d amazing_toys_hybrid -c "CREATE TABLE ..."` | `logger.warn('[Schema] ... warning:', e.message)` — jika `e` adalah objek error tanpa `message` string, outputnya kosong. |

---

## BUG-056 — Transaksi RESERVED/WAITING_PAYMENT Tidak Otomatis Kadaluarsa

**Tanggal:** 2026-06-13
**Layer:** Backend / Scheduler
**Transaction:** TXN-20260613-00070 (status RESERVED, `expires_at` sudah lewat)
**Status:** ✅ Resolved

### Symptom

QC test: transaksi TXN-20260613-00070 dengan status `RESERVED` memiliki `expires_at = 2026-06-13 08:01:32+00` (sudah lewat 1.5 jam). Transaksi tetap di status `RESERVED` dan masih bisa diproses kasir seolah-olah masih valid.

### Root Cause

`TxnExpireJob.js` — job scheduler yang berjalan setiap 5 menit — hanya men-sweep transaksi dengan `status = 'PENDING'`:

```sql
-- SEBELUM (hanya PENDING):
UPDATE transactions SET status = 'EXPIRED'
WHERE status = 'PENDING'
  AND expires_at IS NOT NULL
  AND expires_at < NOW()
```

Padahal `RESERVED` dan `WAITING_PAYMENT` juga memiliki `expires_at` yang di-set saat Helper membuat order (2 jam dari waktu pembuatan). Keduanya legal bertransisi ke `EXPIRED` menurut `status.machine.js`:
```js
RESERVED:         new Set(['WAITING_PAYMENT', 'CANCELLED', 'EXPIRED']),  // ✅ EXPIRED ada
WAITING_PAYMENT:  new Set(['PAID', 'CANCELLED', 'EXPIRED']),              // ✅ EXPIRED ada
```

Selain itu, `PENDING` di-sweep tanpa stock restoration karena flow lamanya bergantung pada Odoo cancel sync. Tapi `RESERVED` dan `WAITING_PAYMENT` adalah Helper orders — stock diambil atomik saat `createHelperOrder()` dan **tidak ada Odoo cancel sync**. Jika expire tanpa stock restore, stok hilang permanen.

### Chain of Failure

```
createHelperOrder() → INSERT RESERVED, expires_at = NOW() + 2h, stock deducted
→ TxnExpireJob runs every 5 min → WHERE status = 'PENDING' → RESERVED tidak tersentuh
→ expires_at lewat → transaksi tetap RESERVED
→ cashier lookupTransaction() → isCashierProcessable('RESERVED') = true → tetap bisa diproses
→ customer / helper tidak mendapat notifikasi bahwa order sudah kadaluarsa
→ stok tetap terkunci (tidak dikembalikan)
```

### Fix

**`backend/src/modules/scheduler/jobs/TxnExpireJob.js`** — 2 tahap sweep:

**Tahap 1 — RESERVED + WAITING_PAYMENT dengan stock restoration:**
```sql
UPDATE transactions SET status = 'EXPIRED'
WHERE status IN ('RESERVED', 'WAITING_PAYMENT')
  AND expires_at IS NOT NULL AND expires_at < NOW()
RETURNING transaction_id
```
Setelah update, untuk setiap transaksi yang di-expire:
```sql
UPDATE products p
   SET stock_quantity = stock_quantity + ti.quantity
  FROM transaction_items ti
 WHERE ti.transaction_id = $1
   AND ti.product_id = p.product_id
   AND ti.approval_status != 'REJECTED'
```

**Tahap 2 — PENDING (tanpa stock restoration, sama seperti sebelumnya):**
```sql
UPDATE transactions SET status = 'EXPIRED'
WHERE status = 'PENDING'
  AND expires_at IS NOT NULL AND expires_at < NOW()
RETURNING transaction_id
```

**Hotfix transaksi yang sudah stuck:**
```sql
BEGIN;
UPDATE products p SET stock_quantity = stock_quantity + ti.quantity
  FROM transaction_items ti
 WHERE ti.transaction_id = 'TXN-20260613-00070' AND ti.product_id = p.product_id;
UPDATE transactions SET status = 'EXPIRED'
 WHERE transaction_id = 'TXN-20260613-00070' AND status = 'RESERVED';
COMMIT;
```

**Frontend — Tab "Kadaluarsa" di `/cashier`:**
- `cashier.service.js`: fungsi `getExpiredQueue(date)` — query EXPIRED hari ini
- `cashier.router.js`: `GET /api/v1/cashier/expired` (CASHIER/LEADER/ADMIN)
- `frontend/src/api/cashier.js`: `getExpiredTransactions(params)`
- `CashierDashboardPage.jsx`: tab baru "Kadaluarsa" dengan badge merah jumlah, list transaksi non-clickable (read-only), tombol refresh

### Files Changed

| File | Perubahan |
|---|---|
| `backend/src/modules/scheduler/jobs/TxnExpireJob.js` | Expand sweep: RESERVED+WAITING_PAYMENT dengan stock restore, PENDING tetap tanpa restore |
| `backend/src/modules/cashier/cashier.service.js` | Tambah `getExpiredQueue(date)` |
| `backend/src/modules/cashier/cashier.router.js` | Tambah `GET /expired` |
| `frontend/src/api/cashier.js` | Tambah `getExpiredTransactions()` |
| `frontend/src/pages/cashier/CashierDashboardPage.jsx` | Tambah tab "Kadaluarsa" |

### Deployment

```bash
docker compose build backend
docker compose up -d --no-deps backend
docker compose build frontend && docker compose up -d --no-deps frontend
```

### Recurrence Prevention

Lihat STD-011 di STANDARD.md — setiap status non-terminal dengan `expires_at` wajib di-cover oleh TxnExpireJob.

---

## BUG-057 — Tombol 🗑️ di `/cashier/bayar/:id` → Internal Server Error

**Tanggal:** 2026-06-13
**Dilaporkan dari:** QC manual — cashier klik tombol 🗑️ pada item di halaman `/cashier/bayar/:id`
**Severity:** High — cashier tidak bisa mengajukan delete request sama sekali

### Gejala

Setiap kali kasir menekan tombol 🗑️ (hapus item) di halaman pembayaran (`/cashier/bayar/:transactionId`), respons dari server adalah:

```
HTTP 500 Internal Server Error
"Internal server error."
```

Tidak ada pesan error spesifik yang tampil ke user — hanya toast generic.

### Root Cause

**Tipe kolom `product_id` di tabel `item_delete_requests` salah: `INTEGER`, seharusnya `VARCHAR(20)`.**

Rantai masalah:

1. `products.product_id` adalah `VARCHAR(20)` — dikonfirmasi dari FK di `migrations/008_wishlists.sql` dan data seed di `004_mock_catalogue_products.sql` (`'p1'`, `'p2'`, `'T001'`, dll.)
2. Schema guard di `app.js` mendefinisikan `item_delete_requests.product_id` sebagai `INTEGER NOT NULL` — tipe yang salah.
3. Saat kasir klik 🗑️, frontend mengirim `product_id` seperti `'p1'` (string) ke `POST /api/v1/cashier/delete-requests`.
4. Service melakukan `INSERT INTO item_delete_requests (..., product_id, ...) VALUES (..., 'p1', ...)` — PostgreSQL mencoba memasukkan string ke kolom `INTEGER` → error `invalid input syntax for type integer`.
5. Error tidak tertangkap secara specific → `errorHandler` merespons dengan HTTP 500.

**Mengapa tidak terdeteksi lebih awal?**
- `CREATE TABLE IF NOT EXISTS` hanya berjalan satu kali (saat tabel belum ada) — jika tabel sudah terlanjur dibuat dengan tipe salah, guard tidak akan memperbaikinya.
- Tidak ada FK eksplisit antara `item_delete_requests.product_id` dan `products.product_id`, sehingga kesalahan tipe tidak tertangkap saat CREATE TABLE.
- Tabel berhasil dibuat (tidak ada error saat startup) karena `INTEGER` adalah tipe valid — error hanya muncul saat INSERT dengan nilai non-numerik.

### Perubahan File

#### 1. `backend/src/app.js` — Schema guard fix

Ubah tipe `product_id` dari `INTEGER` ke `VARCHAR(20)` di blok `CREATE TABLE IF NOT EXISTS item_delete_requests`. Tambahkan statement `DO $$ ... ALTER COLUMN` untuk memperbaiki tabel yang sudah terlanjur dibuat salah di deployment existing:

```js
// SEBELUM (salah):
product_id     INTEGER       NOT NULL,

// SESUDAH (benar):
product_id     VARCHAR(20)   NOT NULL,
```

Dan tambahan guard ALTER:
```sql
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'item_delete_requests'
      AND column_name = 'product_id'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE item_delete_requests ALTER COLUMN product_id TYPE VARCHAR(20) USING product_id::text;
  END IF;
END $$
```

#### 2. `backend/migrations/026_fix_delete_requests_product_id.sql` — Migration file baru

File migration idempotent untuk memperbaiki tipe kolom di deployment yang sudah running. Menggunakan `DO $$ ... IF EXISTS` agar aman dijalankan berulang kali.

### Deployment

```bash
docker compose build backend
docker compose up -d --no-deps backend
```

Saat startup, backend akan:
1. Menjalankan schema guard → `DO $$` akan mendeteksi kolom `INTEGER` dan mengubahnya ke `VARCHAR(20)`
2. Log: `[Schema] item_delete_requests table verified (idempotent check done).`

Setelah deploy, tombol 🗑️ berfungsi normal — insert `product_id = 'p1'` berhasil masuk ke kolom `VARCHAR(20)`.

### Recurrence Prevention

Lihat STD-012 di STANDARD.md — setiap FK atau referensi ke kolom tabel lain wajib memverifikasi tipe data sebelum schema guard ditulis.

---

## BUG-058 — Klik "Setujui" di `/leader/hapus-approval` → Internal Server Error

**Tanggal:** 2026-06-13
**Test case:** TXN-20260613-00075
**Dilaporkan dari:** QC manual — leader klik tombol "Setujui" pada permintaan hapus item di `/leader/hapus-approval`
**Severity:** High — seluruh fitur approval hapus item tidak bisa digunakan

### Gejala

Setiap kali leader menekan tombol "Setujui" pada `RequestCard` di halaman `/leader/hapus-approval`, respons dari server adalah:

```
HTTP 500 Internal Server Error
"Internal server error."
```

Error spesifik dari log Docker:
```
error: new row for relation "transactions" violates check constraint "transactions_total_amount_check"
    at /app/src/modules/leader/leader.service.js:270:7
    at async withTransaction
    at async /app/src/modules/leader/leader.router.js:149:22
```

### Root Cause

**`transactions` tabel memiliki check constraint `total_amount > 0`. Saat leader menyetujui penghapusan item terakhir dalam transaksi, recalculate menghasilkan `total_amount = 0` → constraint violated → 500.**

Rantai masalah:

1. Kasir mengajukan delete request untuk satu-satunya item di transaksi TXN-20260613-00075.
2. Leader klik "Setujui" → `PATCH /api/v1/leader/delete-requests/3` → `reviewDeleteRequest()` di `leader.service.js`.
3. Fungsi melakukan `DELETE FROM transaction_items WHERE transaction_id = $1 AND product_id = $2` — item terhapus.
4. Recalculate: `SELECT COALESCE(SUM(subtotal), 0) AS s FROM transaction_items WHERE transaction_id = $1 AND approval_status != 'REJECTED'` → `s = 0` (tidak ada item tersisa).
5. `UPDATE transactions SET total_amount = 0 + 0 = 0` → melanggar `CHECK (total_amount > 0::numeric)`.
6. PostgreSQL throws constraint violation → `withTransaction` rollback → HTTP 500.

**Mengapa tidak terdeteksi lebih awal?**
- Check constraint `transactions_total_amount_check` ada di schema original DB, tapi tidak pernah diuji pada skenario "hapus item terakhir".
- Skenario normal: sebuah transaksi biasanya memiliki lebih dari satu item, jadi recalculate selalu menghasilkan nilai > 0.
- Tidak ada guard "minimum 1 item" sebelum DELETE di kode approval.

### Perubahan File

#### `backend/src/modules/leader/leader.service.js` — Tambah guard "last item check"

Sebelum melakukan DELETE, cek apakah item yang akan dihapus adalah satu-satunya item non-rejected yang tersisa:

```js
// SEBELUM (tidak ada guard):
await client.query(
  `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2`,
  [req.qty, req.product_id],
);
await client.query(`DELETE FROM transaction_items ...`);

// SESUDAH (dengan guard):
const remainingRes = await client.query(
  `SELECT COUNT(*) AS cnt
   FROM transaction_items
   WHERE transaction_id = $1
     AND approval_status != 'REJECTED'
     AND product_id != $2`,
  [req.transaction_id, req.product_id],
);
if (parseInt(remainingRes.rows[0].cnt, 10) === 0) {
  throw new AppError(
    'Tidak dapat menghapus semua item dari transaksi. Batalkan transaksi terlebih dahulu jika tidak ada item yang tersisa.',
    422,
  );
}
// baru lanjut stock restore + DELETE + recalculate
```

Jika ini adalah item terakhir, endpoint mengembalikan HTTP 422 dengan pesan yang actionable — `withTransaction` rollback, `item_delete_requests.status` tetap `PENDING`.

### Deployment

```bash
docker compose build backend
docker compose up -d --no-deps backend
```

### Recurrence Prevention

Lihat STD-013 di STANDARD.md — setiap operasi yang mengubah nilai agregat tabel yang memiliki check constraint wajib memvalidasi hasil kalkulasi sebelum UPDATE.

---

## BUG-059 — Cancel Transaksi Partial-Approval Mengembalikan Stok Berlebih

**Tanggal:** 2026-06-13
**Test case:** TXN-2026613-00076, produk P0001-001 (stok awal 16)
**Dilaporkan dari:** QC manual — customer cancel dari Page `/pesanan/TXN-...-00076` setelah helper approve parsial
**Severity:** High — stok tidak akurat setiap kali customer cancel transaksi yang sudah di-approve parsial

### Skenario yang Direproduksi

| Langkah | Event | Stock | Penjelasan |
|---|---|---|---|
| Awal | — | 16 | Stok awal P0001-001 |
| 1 | Customer order 4 pcs → `PENDING_APPROVAL` | 16 | PENDING_APPROVAL: stok TIDAK dikurangi saat order |
| 2 | Helper `approveItem(qty=2)` dari 4 | 14 | `approveItem` deduct `approved_quantity = 2` → 16-2=14 |
| 3 | Transaksi → `PENDING` (setelah semua item resolved) | 14 | `_resolveAfterItemAction` transition status |
| 4 | Customer cancel → `cancelOrder()` | **18** ❌ | Restore `quantity = 4` bukan `approved_quantity = 2` |
| **Expected** | Customer cancel | **16** ✓ | Seharusnya restore `approved_quantity = 2` → 14+2=16 |

### Root Cause

**`cancelOrder()` di `orders.service.js` menggunakan `item.quantity` (jumlah original yang dipesan) sebagai restore quantity untuk SEMUA item — tidak mempertimbangkan `item.approved_quantity` dan `item.approval_status`.**

```js
// SEBELUM (salah):
const items = await client.query(
  `SELECT product_id, quantity FROM transaction_items WHERE transaction_id = $1`,
  [transactionId]
);
for (const item of items.rows) {
  await client.query(
    `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2`,
    [item.quantity, item.product_id]  // ← selalu pakai quantity (original), SALAH
  );
}
```

**Perbedaan stock accounting antara dua flow:**

| Flow | Kapan stok dikurangi | Berapa yang dikurangi | Yang harus di-restore saat cancel |
|---|---|---|---|
| **SELF_ORDER** (PENDING) | Saat order dibuat | `quantity` | `quantity` |
| **PENDING_APPROVAL → PENDING** | Saat helper `approveItem()` | `approved_quantity` (bisa < quantity) | `approved_quantity` |
| Item REJECTED | Tidak pernah dikurangi | 0 | 0 |

`cancelOrder()` tidak membedakan kedua flow ini — selalu menggunakan `quantity` untuk semua item.

**Mengapa tidak terdeteksi lebih awal?**

- CR-040 menambahkan PENDING_APPROVAL flow dengan komentar di `cancelOrder()`: "Restore stock only if it was already deducted (PENDING, not PENDING_APPROVAL)" — tapi asumsinya PENDING = self-order (full quantity deducted).
- Tidak ada test case yang mencakup skenario PENDING_APPROVAL → PENDING → cancel.
- Per-item `approval_status` dan `approved_quantity` tidak pernah di-cross-check di `cancelOrder()`.

### Perubahan File

#### `backend/src/modules/orders/orders.service.js` — Fix `cancelOrder()`

```js
// SESUDAH (benar):
const items = await client.query(
  `SELECT product_id, quantity, approval_status, approved_quantity
   FROM transaction_items WHERE transaction_id = $1`,
  [transactionId]
);
for (const item of items.rows) {
  // BUG-059: use approved_quantity for APPROVED items
  const restoreQty = item.approval_status === 'REJECTED'
    ? 0
    : (item.approved_quantity !== null ? item.approved_quantity : item.quantity);
  if (restoreQty > 0) {
    await client.query(
      `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2`,
      [restoreQty, item.product_id]
    );
  }
}
```

**Tabel restore quantity per kasus:**

| `approval_status` | `approved_quantity` | Restore qty | Alasan |
|---|---|---|---|
| `REJECTED` | any | 0 | Stok tidak pernah dikurangi |
| `APPROVED` | 2 (from qty=4) | 2 | Hanya 2 yang pernah dikurangi (PENDING_APPROVAL flow) |
| `PENDING` | NULL | `quantity` | Full deduction saat order (SELF_ORDER flow) |

### Deployment

```bash
docker compose build backend
docker compose up -d --no-deps backend
```

### Gap yang Diketahui

**Gap-001** (tidak di-fix sekarang): Transaksi PENDING yang berasal dari PENDING_APPROVAL flow juga memiliki `expires_at`. Jika expired via TxnExpireJob Step 2 (PENDING), stok tidak dikembalikan — TxnExpireJob berasumsi Odoo yang handle, tapi untuk transaksi PENDING_APPROVAL→PENDING, stock dikurangi oleh SOS bukan Odoo. Ini mitigated by the fact that pelanggan biasanya cancel sebelum expire.

### Recurrence Prevention

Lihat STD-014 di STANDARD.md — setiap fungsi yang merestorasi stok dari cancel/expire wajib mempertimbangkan `approval_status` dan `approved_quantity`.

---

## BUG-060 — Field "Batas Waktu Checkout (menit)" di Admin Tidak Bisa Diketik

**Tanggal:** 2026-06-14  
**Layer:** Frontend  
**Status:** ✅ Resolved

**Symptom:**  
Field "Batas Waktu Checkout (menit)" pada tab Konfigurasi di halaman Admin tidak bisa diisi nilai baru. Setiap kali user menghapus angka yang ada untuk mengetik angka baru, field langsung kembali ke nilai `30`.

**Root Cause:**  
`onChange` handler menggunakan pola `parseInt(e.target.value, 10) || 30`:

```jsx
// SEBELUM (bug):
onChange={(e) => set('txn_timeout_checkout', parseInt(e.target.value, 10) || 30)}
```

Ketika user menghapus seluruh isi field (backspace), `e.target.value` menjadi `""`. `parseInt("", 10)` mengembalikan `NaN`. `NaN || 30` = `30`. Sehingga `set()` dipanggil dengan `30`, field langsung kembali ke nilai semula. User tidak pernah bisa mengosongkan field untuk mengetik angka baru.

**Fix:**  
Simpan string kosong saat field dikosongkan, bukan fallback ke default:

```jsx
// SESUDAH (benar):
value={config.txn_timeout_checkout ?? ''}
onChange={(e) => set('txn_timeout_checkout', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
```

Dengan ini, `value=''` membuat number input tampil kosong, dan user bisa mengetik nilai baru. React number input dengan `value={NaN}` juga merender sebagai kosong — pattern yang digunakan untuk field serupa seperti `max_items_per_order`.

**Perubahan File:**

- `frontend/src/pages/admin/tabs/ConfigTab.jsx` — baris 301-303

**Deployment:**

```bash
docker compose build frontend
docker compose up -d --no-deps frontend
```

**Recurrence Prevention:**  
Lihat STD-015 di STANDARD.md — jangan gunakan `parseInt(...) || fallback` pada `onChange` input numerik yang boleh dikosongkan.

---

## BUG-061 — WA Notifikasi "Hampir Kadaluarsa" Tidak Terkirim (TXN-20260613-00080)

**Tanggal:** 2026-06-14  
**Layer:** Backend / Scheduler / Database  
**Status:** ✅ Resolved

**Symptom:**  
Notifikasi WA pengingat "pesanan hampir kadaluarsa" (`Notif Limit Pesanan (menit)`) tidak dikirim ke customer untuk transaksi `TXN-20260613-00080`, meskipun konfigurasi sudah diset.

**Root Cause — 3 penyebab bersamaan:**

**RC-1: `c.phone` bukan kolom yang ada (harus `c.phone_number`)**  
Di `TxnNotifJob.js` baris 138:
```sql
COALESCE(t.customer_phone, c.phone) AS phone
```
Tabel `customers` menggunakan kolom `phone_number`, bukan `phone`. Ini menyebabkan SQL query gagal dengan error "column c.phone does not exist". Error ini di-catch oleh blok try-catch di `execute()` dan diabaikan (silent fail) — `notified = 0` tanpa pesan error yang jelas.

**RC-2: Status `PENDING` tidak dicakup**  
Query hanya filter `status IN ('RESERVED', 'WAITING_PAYMENT')`. Transaksi dengan mode SELF_ORDER atau mode HELPER_APPROVE (setelah disetujui helper, status = `PENDING`) tidak akan pernah menerima notifikasi. Namun `TxnExpireJob` mengexpire PENDING, jadi mereka bisa expired tanpa notif.

**RC-3: Kolom `wa_expiry_notif_sent_at` tidak ada di schema guard app.js**  
Kolom ini hanya didefinisikan di `backend/migrations/025_txn_expiry_notif.sql` yang tidak dieksekusi secara otomatis saat container start. Jika migration belum dijalankan manual, kolom tidak ada dan query gagal.

**Fix:**

```js
// TxnNotifJob.js — RC-1: c.phone → c.phone_number
// TxnNotifJob.js — RC-2: tambah 'PENDING' ke status filter
COALESCE(t.customer_phone, c.phone_number) AS phone,
...
WHERE t.status IN ('RESERVED', 'WAITING_PAYMENT', 'PENDING')
```

```js
// app.js — RC-3: tambah idempotent schema guard untuk wa_expiry_notif_sent_at
await dbQuery(
  `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS wa_expiry_notif_sent_at TIMESTAMPTZ DEFAULT NULL`,
);
await dbQuery(
  `CREATE INDEX IF NOT EXISTS idx_transactions_wa_expiry_notif
     ON transactions (expires_at)
     WHERE wa_expiry_notif_sent_at IS NULL
       AND status IN ('RESERVED', 'WAITING_PAYMENT', 'PENDING')`,
);
```

**Perubahan File:**

- `backend/src/modules/scheduler/jobs/TxnNotifJob.js` — baris 138, 147
- `backend/src/app.js` — tambah schema guard sebelum `initializeScheduledJobs()`

**Deployment:**

```bash
docker compose build backend
docker compose up -d --no-deps backend
```

**Recurrence Prevention:**  
Lihat STD-016 di STANDARD.md — setiap kolom baru yang digunakan oleh job/scheduler wajib memiliki idempotent schema guard di `app.js`, dan query JOIN wajib mereferensi nama kolom yang sesuai dengan schema tabel target.

---

## BUG-062 — Registrasi Berhasil di Backend tapi Customer Lapor "Registrasi Failed" + OTP Terkirim

**Tanggal:** 2026-06-14  
**Layer:** Backend / Auth  
**Status:** ✅ Resolved

**Symptom:**  
QC test registrasi dengan nomor `081180003939` — customer melaporkan "registrasi failed", tetapi OTP WhatsApp tetap diterima. Record di tabel `pending_registrations` terbukti tersimpan.

**Investigasi:**

Log backend menunjukkan:
- `00:55:34` — Login attempt → `"Akun tidak ditemukan"` (user coba login dulu)
- `00:56:00` — `[WA-OTP] OTP terkirim` — registrasi backend **berhasil**
- `01:00:39` — Login attempt lagi → `"Akun tidak ditemukan"` (21 detik sebelum OTP expired)
- Tidak ada error backend antara 00:56 dan 01:00

Dari log, backend **berhasil**: OTP terkirim, `pending_registrations` tersimpan, backend return 202. Frontend menampilkan step OTP. Namun customer tidak menyelesaikan verifikasi OTP (navigasi ke halaman login alih-alih memasukkan kode OTP).

**Root Cause — Architectural Bug:**

Di `registerCustomer()` (`auth.service.js`), `sendOTP()` dipanggil **sebelum** `INSERT INTO pending_registrations`:

```js
// SEBELUM (bug):
const waResult = await sendOTP(phone_number, otpPlain, full_name);  // ← OTP terkirim dulu
if (waResult.status === 'FAILED') throw new AppError(...);

await query(`INSERT INTO pending_registrations ...`);               // ← DB disimpan setelah
```

**Skenario failure:** Jika `INSERT INTO pending_registrations` gagal (constraint violation, DB error, dsb.) setelah OTP sudah terkirim:
- Customer menerima OTP di WhatsApp
- Tidak ada record di `pending_registrations` → verifikasi OTP (`verifyRegisterOtp`) akan gagal "sesi registrasi tidak ditemukan"
- Customer kebingungan: menerima OTP tapi tidak bisa menyelesaikan registrasi

**Fix:**

Swap urutan — simpan `pending_registrations` **dulu**, baru kirim OTP:

```js
// SESUDAH (fix):
await query(`INSERT INTO pending_registrations ...`);               // ← DB disimpan dulu
// STD-018: DB record harus ada sebelum OTP dikirim

const waResult = await sendOTP(phone_number, otpPlain, full_name);  // ← OTP dikirim setelah
if (waResult.status === 'FAILED') throw new AppError(...);
```

Jika `sendOTP` gagal setelah INSERT: pending record tetap ada → user retry → `ON CONFLICT DO UPDATE` generate OTP baru → OTP baru dikirim. Tidak ada data kotor.

**Fix Tambahan — BUG-061 RC-4 (ditemukan saat investigasi):**

`TxnNotifJob.js` masih memiliki bug yang menyebabkan query gagal setiap menit:
```sql
-- SEBELUM (bug): ten.name tidak ada di tabel tenants
COALESCE(ten.tenant_name, ten.name) AS booth_name

-- SESUDAH (fix): hanya ten.tenant_name
ten.tenant_name AS booth_name
```
Error ini menyebabkan seluruh notif WA tidak terkirim (query fail → catch → return `{ notified: 0 }`).

**Perubahan File:**

- `backend/src/modules/auth/auth.service.js` — `registerCustomer()`: pindah INSERT sebelum sendOTP
- `backend/src/modules/scheduler/jobs/TxnNotifJob.js` — baris 139: `COALESCE(ten.tenant_name, ten.name)` → `ten.tenant_name`

**Deployment:**

```bash
docker compose build backend
docker compose up -d --no-deps backend
```

**Recurrence Prevention:**  
Lihat STD-018 di STANDARD.md — OTP wajib dikirim setelah record database yang menjadi acuan verifikasi berhasil disimpan.


---

## BUG-063 — Tour Guide Mobile Popup Overlap Nav Bar + Teks Salah

**Symptom:**

Pada tampilan mobile, tooltip tour guide (`TourTooltip`) muncul di posisi paling bawah layar dengan `position: fixed; bottom: 0` — menabrak/overlap navigation bar bawah. Selain itu ditemukan tiga teks error:
- `TourWelcomeModal`: "Mau tur singkat untuk belajar cara **memesan makanan**?" (app ini adalah toy fair, bukan food)
- `TourNavigationButtons`: "**Navigating...**" (teks Bahasa Inggris, app seharusnya full Bahasa Indonesia)
- `TourProgressBar`: "Langkah X **dari 16**" — membingungkan karena step bisa di-skip sehingga progress bisa melompat (misal dari Langkah 3 ke Langkah 12)

**Root Cause:**

| # | Defect | File |
|---|---|---|
| 1 | Mobile bottom-sheet menggunakan `bottom: 0, left: 0, right: 0` — tidak ada clearance dari nav bar (z-30) | `TourTooltip.jsx` |
| 2 | Hardcoded text "memesan makanan" dari template awal, tidak diperbarui saat app diganti ke toy fair | `TourWelcomeModal.jsx` |
| 3 | `isTransitioning` state menampilkan "Navigating..." (English) | `TourNavigationButtons.jsx` |
| 4 | Progress label menampilkan total step absolut (16) yang tidak mencerminkan step yang user jalani karena `skipIfMissing` | `TourProgressBar.jsx` |

**Fix:**

**`TourTooltip.jsx`** — Redesign mobile layout:
- Ganti `bottom: 0, left: 0, right: 0, borderRadius: '16px 16px 0 0'` → `bottom: 72, left: 12, right: 12, borderRadius: 20`
- Floating card di atas nav bar (clearance 72px) dengan rounded corners semua sisi
- Tambah blue gradient accent strip 4px di bagian atas card
- Tambah drag handle indicator (visual only)
- Close button (✕) circular di kanan atas
- Tombol transisi: `translateY(0)` dengan spring easing `cubic-bezier(0.34,1.56,0.64,1)`
- Desktop tooltip: tetap positioned, tambah gradient accent strip + improved shadow

**`TourWelcomeModal.jsx`** — Teks dan desain:
- "memesan makanan" → "memesan produk di sini"
- Tambah gradient header (`#3B5BDB → #748FFC`) dengan ikon 🎪 dan subtitle "Amazing Toys Fair 2026"
- Tombol "Mulai Tur" menggunakan gradient brand, bukan plain `bg-blue-600`

**`TourNavigationButtons.jsx`** — Teks dan mobile layout:
- "Navigating..." → "Memuat..."
- Terima prop `isCard` dari `TourTooltip`
- Mobile (`isCard=true`): tombol row dengan Back (fixed 80px) + Next (flex-1), touch target 40px, gradient Next button
- Desktop: layout existing diperbaiki dengan gradient button

**`TourProgressBar.jsx`** — Label:
- "Langkah X dari {totalSteps}" → "Langkah X" + persentase `{pct}%`
- Progress bar: tinggi 5px (dari 1px/h-1), gradient `#3B5BDB → #748FFC`, easing `cubic-bezier(0.4,0,0.2,1)`

**Perubahan File:**

- `frontend/src/components/tour/TourTooltip.jsx` — redesign mobile card + desktop tooltip
- `frontend/src/components/tour/TourWelcomeModal.jsx` — fix teks + redesign visual
- `frontend/src/components/tour/TourNavigationButtons.jsx` — fix "Navigating..." + mobile layout
- `frontend/src/components/tour/TourProgressBar.jsx` — fix label + visual

**Deployment:**

```bash
docker compose build frontend
docker compose up -d --no-deps frontend
```

**Recurrence Prevention:**

Lihat STD-019 di STANDARD.md — Tour Guide UI Standard: tooltip mobile harus selalu floating card di atas nav bar (`bottom ≥ 64px`), tidak boleh edge-to-edge bottom sheet. Semua teks UI wajib Bahasa Indonesia.

---

## BUG-064 — Group Checkout Gagal: Tabel `transaction_groups` Tidak Ada di Database

**Date:** 2026-06-14  
**Status:** ✅ Resolved  
**CR Terkait:** CR-054

### Symptom

Fitur Group Checkout (CR-054) tidak berfungsi sama sekali. Saat kasir menscan QR customer dengan >1 transaksi aktif, backend melempar error:

```
relation "transaction_groups" does not exist
```

Atau lebih tepatnya, endpoint `GET /cashier/customer-transactions` crash karena query menyertakan `AND t.group_id IS NULL` — kolom `group_id` belum ada di tabel `transactions`.

### Root Cause

Migration `022_group_checkout.sql` **tidak pernah diaplikasikan** ke database. File migration sudah ada di `backend/migrations/`, service code sudah ada (cashier.service.js, cashier.router.js), frontend pages sudah ada (GroupMergePage, GroupPaymentPage, PrintGroupReceiptButton), routes di App.jsx sudah ada — tetapi step deploy migration terlewat.

**Urutan migration yang ada:**

```
021_cr041_refresh_tokens.sql    ← applied ✅
022_group_checkout.sql          ← SKIPPED ❌
023_cr061_fraud_protection.sql  ← applied ✅ (terbukti: kolom amount_charged ada)
```

Migration 023 yang datang setelahnya diaplikasikan normal, sehingga tidak ada error yang muncul saat deploy awal. Bug hanya terdeteksi saat fitur group checkout pertama kali digunakan.

### Fix

```bash
docker cp backend/migrations/022_group_checkout.sql hybrid_postgres:/tmp/
docker exec hybrid_postgres psql -U postgres -d amazing_toys_hybrid -f /tmp/022_group_checkout.sql
docker restart hybrid_backend
```

**Hasil setelah fix:**
- Tabel `transaction_groups` dibuat dengan 14 kolom
- Kolom `group_id UUID` ditambahkan ke `transactions`
- Index `idx_transactions_group_id`, `idx_transaction_groups_customer`, `idx_transaction_groups_phone` dibuat
- Sequence `transaction_groups_seq` dibuat (untuk format `GRP-YYYYMMDD-NNNN`)

### Recurrence Prevention

Lihat STD-020 di STANDARD.md — Migration Deployment Checklist: setiap CR yang menyertakan file migration wajib didaftarkan ke checklist deployment dan diverifikasi via `SELECT` sebelum dianggap selesai.

---

## BUG-065 — "Konfirmasi Bayar" Group Checkout Gagal 422: Validator `.isUUID()` Menolak Format `TXN-*`

**Date:** 2026-06-15  
**Status:** ✅ Resolved  
**CR Terkait:** CR-054

### Symptom

Setelah BUG-064 (migration) diperbaiki, kasir masih tidak bisa memproses pembayaran Group Checkout. Saat klik tombol **"Konfirmasi Bayar"** di halaman `/cashier/group-bayar`, request dikirim ke `POST /api/v1/cashier/group-checkout` dan mendapat respons:

```
HTTP 422 Unprocessable Entity
{ "errors": [{ "msg": "transaction_id tidak valid.", "path": "transaction_ids[0]" }] }
```

Semua transaction ID yang dikirim (`TXN-20260615-00001`, dst.) ditolak validasi.

### Root Cause

Di `cashier.router.js` (POST `/group-checkout` validator), baris:

```js
body('transaction_ids.*').isUUID().withMessage('transaction_id tidak valid.'),
```

Validator `.isUUID()` mengharapkan format UUID v4 (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`). Transaction ID di sistem ini menggunakan format **custom string** `TXN-YYYYMMDD-NNNNN` yang tidak pernah valid sebagai UUID — sehingga **100% request group checkout akan ditolak**, tanpa pengecualian.

Format aktual yang tersimpan di database:

```sql
SELECT transaction_id FROM transactions LIMIT 3;
-- TXN-20260613-00079
-- TXN-20260613-00080
-- TXN-20260614-00081
```

### Fix

**File:** `backend/src/modules/cashier/cashier.router.js` — baris 206

```js
// Sebelum (BUG):
body('transaction_ids.*').isUUID().withMessage('transaction_id tidak valid.'),

// Sesudah (FIX):
body('transaction_ids.*').isString().notEmpty().withMessage('transaction_id tidak valid.'),
```

Deploy:

```bash
docker cp backend/src/modules/cashier/cashier.router.js hybrid_backend:/app/src/modules/cashier/cashier.router.js
docker restart hybrid_backend
```

Verifikasi fix di dalam container:

```bash
docker exec hybrid_backend grep "transaction_ids\.\*" /app/src/modules/cashier/cashier.router.js
# Output: body('transaction_ids.*').isString().notEmpty().withMessage('transaction_id tidak valid.'),
```

### Recurrence Prevention

Lihat STD-021 di STANDARD.md — Input validator harus menggunakan tipe yang sesuai dengan format primary key aktual. Jangan gunakan `.isUUID()` untuk field yang menggunakan format string custom seperti `TXN-*`, `GRP-*`, `PRD-*`.

---

## BUG-066 — `/pesanan/:id` Tidak Auto-Refresh Setelah Group Checkout

**Date:** 2026-06-15  
**Status:** ✅ Resolved  
**CR Terkait:** CR-054

### Symptom

Setelah kasir berhasil memproses Group Checkout, halaman `/pesanan/:id` customer tidak auto-refresh — status tetap tampil `PENDING`/`RESERVED` meskipun pembayaran sudah dikonfirmasi. Customer harus manual tekan tombol refresh untuk melihat status `PAID`.

### Root Cause

**Penyebab utama — event name mismatch (Backend ↔ Frontend):**

`payments.service.js` (single-TRX flow) broadcast event:
```js
broadcastToCustomer(txn.customer_id, { event: 'ORDER_PAID', transactionId });
```

`cashier.service.js` (group checkout flow) broadcast event:
```js
broadcastToCustomer(committed.customerId, {
  event: 'GROUP_ORDER_PAID',   // ← event name berbeda!
  groupId, groupCode, message  // ← tidak menyertakan transactionIds
});
```

`OrderTrackingPage.jsx` hanya subscribe ke `ORDER_PAID`:
```js
return subscribe('ORDER_PAID', (data) => {
  if (data?.transactionId === transactionId) fetchOrder();
});
```

Akibatnya, saat kasir menggunakan Group Checkout, event `GROUP_ORDER_PAID` diterima oleh WS tapi tidak ada handler yang menangkap — halaman customer tidak pernah memanggil `fetchOrder()`.

**Penyebab kedua — polling tidak cover `PENDING_APPROVAL`:**

Polling fallback hanya aktif untuk `['PENDING', 'RESERVED', 'WAITING_PAYMENT']`. Status `PENDING_APPROVAL` (mode HELPER_APPROVE) tidak termasuk, sehingga jika WS down saat helper menyetujui pesanan, halaman tidak pernah auto-refresh.

### Fix

**1. Backend — `cashier.service.js` (line ~358):** Tambahkan `transactionIds` ke payload `GROUP_ORDER_PAID`:

```js
// Sebelum (BUG):
broadcastToCustomer(committed.customerId, {
  event:    'GROUP_ORDER_PAID',
  groupId:  committed.groupId,
  groupCode: committed.groupCode,
  message:  '...',
});

// Sesudah (FIX):
broadcastToCustomer(committed.customerId, {
  event:          'GROUP_ORDER_PAID',
  groupId:        committed.groupId,
  groupCode:      committed.groupCode,
  transactionIds: committed.transactionIds,  // ← TAMBAH INI
  message:        '...',
});
```

**2. Frontend — `OrderTrackingPage.jsx`:** Tambah subscriber `GROUP_ORDER_PAID` dan perluas polling ke `PENDING_APPROVAL`:

```jsx
// Handler baru: GROUP_ORDER_PAID
useEffect(() => {
  return subscribe('GROUP_ORDER_PAID', (data) => {
    if (data?.transactionIds?.includes(transactionId)) fetchOrder();
  });
}, [transactionId, subscribe, fetchOrder]);

// Polling diperluas ke PENDING_APPROVAL
useEffect(() => {
  const isActive = order?.status
    && ['PENDING', 'RESERVED', 'WAITING_PAYMENT', 'PENDING_APPROVAL'].includes(order.status);
  if (!isActive) return;
  const id = setInterval(fetchOrder, 15_000);
  return () => clearInterval(id);
}, [order?.status, fetchOrder]);
```

Deploy:

```bash
# Backend
docker cp cashier.service.js hybrid_backend:/app/src/modules/cashier/cashier.service.js
docker restart hybrid_backend

# Frontend (Nginx, perlu build)
npm run build
docker cp dist/. hybrid_frontend:/usr/share/nginx/html/
docker exec hybrid_frontend nginx -s reload
```

### Recurrence Prevention

Lihat STD-022 di STANDARD.md — Setiap kali backend menambahkan WS broadcast baru, semua halaman frontend yang relevan WAJIB subscribe ke event tersebut dengan payload yang cukup untuk filter per-entity.

---

## BUG-067 — Group Invoice `GRP-*` Tidak Bisa Digunakan untuk Ambil Barang di Helper

**Date:** 2026-06-15  
**Status:** ✅ Resolved  
**CR Terkait:** CR-054

### Symptom

Helper booth menerima customer yang menunjukkan struk dengan kode `GRP-20260614-0001`. Saat helper mengetik atau scan kode tersebut di kolom pencarian halaman "Serah Terima", daftar menampilkan "Tidak ada pesanan untuk diserahkan" — meskipun ada transaksi PAID yang siap diserahkan.

### Root Cause

`HandoverOutstandingPanel` di `HelperPage.jsx` menggunakan filter:

```js
const filtered = orders.filter(o =>
  !searchQuery || o.transaction_id.toLowerCase().includes(searchQuery.toLowerCase())
);
```

`orders` berisi data individual TXN (`TXN-00091`, `TXN-00092`). Ketika helper mengetik `GRP-20260614-0001`, tidak ada TXN yang cocok → list kosong.

Backend sudah mendukung lookup by group code via `_getGroupOrderForBooth()` (deteksi `^GRP-` prefix di `helper.service.js` baris 554), tetapi fungsi ini tidak pernah dipanggil dari panel outstanding karena filter hanya bekerja pada `transaction_id`.

### Fix

**File:** `frontend/src/pages/helper/HelperPage.jsx` — `HandoverOutstandingPanel`

Tambahkan `useEffect` yang mendeteksi prefix `GRP-` di `searchQuery` dan langsung memanggil `getBoothOrder(q)`:

```jsx
useEffect(() => {
  const q = (searchQuery ?? '').trim();
  if (!/^GRP-/i.test(q)) { setGrpError(''); return; }
  if (q.length < 10) return;  // tunggu kode lengkap
  setGrpLoading(true);
  setGrpError('');
  getBoothOrder(q)
    .then(r => setSelectedOrder(r.data.data))
    .catch(err => setGrpError(err.response?.data?.message || 'Group invoice tidak ditemukan di booth ini.'))
    .finally(() => setGrpLoading(false));
}, [searchQuery]);
```

Ketika `selectedOrder` ter-set, `HandoverDetailView` langsung terbuka dengan data dari `_getGroupOrderForBooth()` — yaitu item milik booth ini dari semua TXN dalam group. Handover kemudian berjalan via `transaction_id` TXN pertama yang ditemukan untuk booth ini.

### Alur Setelah Fix

```
Helper scan/ketik GRP-20260614-0001
  → useEffect deteksi prefix GRP-
  → getBoothOrder('GRP-20260614-0001')
  → _getGroupOrderForBooth() → items Booth A dari TXN-00091
  → HandoverDetailView terbuka
  → Helper centang semua item → Konfirmasi
  → handoverOrder('TXN-00091') → status PAID → HANDED_OVER → COMPLETED
  → items pickup_status READY → DONE
```

### Recurrence Prevention

Lihat STD-023 di STANDARD.md — Setiap fitur yang menggunakan format ID selain `TXN-*` (misal group code `GRP-*`) WAJIB ditest secara eksplisit di semua UI yang menerima input ID — termasuk kolom pencarian, scan QR, dan lookup manual.

---

### BUG-067 — Addendum: Multi-Booth Independent Handover via Group Code

**Date:** 2026-06-15 (follow-up)  
**Kasus nyata:**
```
GRP-20260614-0001
  ├─ TXN-20260614-00093 → ToysWorld · Hall A, Stand A1
  └─ TXN-20260614-00094 → EduPlayZone · Hall C, Stand C5
```

**Root cause lanjutan (setelah BUG-067 fix awal):**

1. **`handoverOrder` tidak punya logik GRP** — meneruskan ke single-TXN path, tidak ada `tenant_id` scope di `UPDATE transaction_items`. Jika TXN-00093 punya item dari dua booth, booth pertama yang handover akan me-mark semua item (termasuk milik booth lain) sebagai DONE.

2. **`HandoverDetailView` re-fetch kehilangan `is_group_invoice` flag** — re-fetch pakai `transaction_id` (TXN ID dari hasil lookup GRP), sehingga response single-TXN tidak lagi punya `group_code` atau `is_group_invoice`. Akibatnya `doHandover` memanggil `handoverOrder('TXN-00093')` bukan `handoverOrder('GRP-...')`.

**Fix:**

*Backend — `helper.service.js`:*
```js
// Tambah deteksi GRP- di handoverOrder:
async function handoverOrder(transactionId, helperId, helperTenantId) {
  if (/^GRP-/i.test(transactionId)) {
    return _handoverGroup(transactionId, helperId, helperTenantId);
  }
  // ... existing single-TXN code unchanged ...
}

// _handoverGroup: booth-scoped, handles multi-TXN group:
async function _handoverGroup(groupCode, helperId, helperTenantId) {
  // Temukan TRX dalam group yang punya item booth ini (AND t.status = 'PAID')
  // Update hanya item tenant ini: WHERE transaction_id = $2 AND tenant_id = $3 AND pickup_status = 'READY'
  // Cek jika masih ada item READY di TRX → jika tidak, mark TRX sebagai COMPLETED
}
```

*Frontend — `HelperPage.jsx` `HandoverDetailView`:*
```js
// Re-fetch pakai group_code jika is_group_invoice
const lookupKey = initialOrder.is_group_invoice ? initialOrder.group_code : initialOrder.transaction_id;

// Handover pakai group_code jika is_group_invoice
const handoverId = order.is_group_invoice ? order.group_code : order.transaction_id;
await handoverOrder(handoverId);
```

**Alur Setelah Fix (kasus user):**
```
ToysWorld helper scan GRP-20260614-0001:
  → getBoothOrder('GRP-20260614-0001', ToysWorld_tenantId)
  → _getGroupOrderForBooth → items dari TXN-00093 (ToysWorld only)
  → HandoverDetailView re-fetch: getBoothOrder('GRP-20260614-0001') → is_group_invoice:true
  → handoverOrder('GRP-20260614-0001', helperId, ToysWorld_tenantId)
  → _handoverGroup → UPDATE items WHERE tenant_id = ToysWorld AND pickup_status = 'READY'
  → TXN-00093: no more READY → COMPLETED ✅

EduPlayZone helper scan GRP-20260614-0001:
  → getBoothOrder('GRP-20260614-0001', EduPlayZone_tenantId)
  → _getGroupOrderForBooth → items dari TXN-00094 (EduPlayZone only)
  → HandoverDetailView re-fetch: getBoothOrder('GRP-20260614-0001') → is_group_invoice:true
  → handoverOrder('GRP-20260614-0001', helperId, EduPlayZone_tenantId)
  → _handoverGroup → UPDATE items WHERE tenant_id = EduPlayZone AND pickup_status = 'READY'
  → TXN-00094: no more READY → COMPLETED ✅
```

Kedua booth menggunakan **kode yang sama** (`GRP-20260614-0001`) dan masing-masing hanya menyelesaikan item milik booth mereka sendiri.
