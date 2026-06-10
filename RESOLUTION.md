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
