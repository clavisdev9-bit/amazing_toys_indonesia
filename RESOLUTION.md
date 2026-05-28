# Bug Resolution Report
**Project:** Amazing Toys Fair 2026 — Self-Order Kiosk (SOS) × Odoo 18 Integration  
**Date:** 2026-05-27  
**Resolved by:** clavis Development

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


