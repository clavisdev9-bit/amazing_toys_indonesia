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


