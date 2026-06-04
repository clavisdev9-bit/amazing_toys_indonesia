# Change Request
**Project:** Amazing Toys Fair 2026 — SOS × Odoo 18 Integration  
**CR Number:** CR-2026-0527-001  
**Date:** 2026-05-27  
**Author:** clavis Development  
**Status:** Implemented & Deployed

---

## Summary

Four production bugs fixed across the integration service, backend, and frontend. All changes are backward-compatible; no database schema migrations required beyond a one-time data correction.

---

## Changes

### CR-001 — Odoo Company ID: Hard Fail Instead of Silent Fallback
**File:** `integration/src/clients/odoo.client.js`  
**Type:** Bug Fix — Critical

After `authenticate()` receives the Odoo session response, compare the configured `companyId` against `user_companies.allowed_companies`. If the configured company is NOT accessible, **throw an error** instead of silently falling back to a different company. The previous silent fallback caused TXN-20260527-00002 and other transactions to land in the wrong Odoo company (Dev.clavis.retail-business instead of AMAZING TOYS).

**Before:** silently set `_creds.companyId` to company 1 and logged a `WARN`  
**After:** throws with a message that names the allowed companies and instructs the operator to grant the correct company in Odoo Settings → Users → [user] → Companies

**Pre-requisite fix in Odoo (one-time):** Added company 5 (AMAZING TOYS) to user uid=10 `company_ids` and set it as the default company via Odoo RPC.

---

### CR-002 — Remove Stock Fields from Product Pull Sync Patch
**File:** `integration/src/services/product.sync.js`  
**Type:** Bug Fix

Removed `stock_quantity` and `stock_status` from the `PATCH /products/:id` payload in the Odoo→SOS product pull sync. SOS manages event inventory stock independently; the product sync must only update price and name. Previously, every sync run zeroed all product stock quantities by writing Odoo's `qty_available=0` (from consumable-type products) back to SOS.

**Before:**
```js
await sos.patch(`/products/${sosId}`, { price, stock_quantity: stockQty, stock_status: newStatus });
```
**After:**
```js
await sos.patch(`/products/${sosId}`, { price });
```

---

### CR-003 — Fix Inverted Product Type Filter in Stock Sync
**File:** `integration/src/services/stock.sync.js`  
**Type:** Bug Fix

Changed Odoo filter from `['type', '=', 'consu']` to `['type', '=', 'product']` in the stock sync query. Consumable products always report `qty_available=0`; only storable products (`type='product'`) carry meaningful stock. The existing inline comment already stated the correct intent.

**Before:**
```js
[['id', 'in', odooProductIds], ['type', '=', 'consu']]
```
**After:**
```js
[['id', 'in', odooProductIds], ['type', '=', 'product']]
```

---

### CR-004 — Restore ACTIVE Status on Xref Upsert Conflict
**File:** `integration/src/services/push.product.sync.js`  
**Type:** Bug Fix

Added `status='ACTIVE'` to the `ON CONFLICT DO UPDATE` clause in `upsertXref`. Previously, if an xref entry was accidentally set to `CANCELLED` by the archive sweep, subsequent push-product-sync runs would update `odoo_id` and `sync_metadata` but leave `status='CANCELLED'`, causing the entry to be excluded from all future syncs.

**Before:**
```sql
DO UPDATE SET odoo_id=EXCLUDED.odoo_id, sync_metadata=EXCLUDED.sync_metadata, updated_at=NOW()
```
**After:**
```sql
DO UPDATE SET odoo_id=EXCLUDED.odoo_id, status='ACTIVE', sync_metadata=EXCLUDED.sync_metadata, updated_at=NOW()
```

---

### CR-005 — Change New Odoo Products to type='service'
**File:** `integration/src/services/push.product.sync.js`  
**Type:** Bug Fix / Improvement

Changed `buildProductVals` to create new Odoo products as `type='service'` instead of `type='consu'`. Service products require no outbound routes, no delivery orders, and `action_confirm` always succeeds — eliminating the "No rule has been found to replenish X" error class for all new products.

**Before:**
```js
type: 'consu',
route_ids: [[5, 0, 0]],
```
**After:**
```js
type: 'service',
// route_ids removed — not applicable to service products
```

> **Note:** Odoo blocks inventory tracking type changes on products already referenced in stock moves or confirmed orders. This change applies to newly created products only. Existing `consu` products are handled by the fallback route mechanism in `order.push.js`.

---

### CR-006 — Fix manualConfirmRequired Permanently Silencing Order Retry
**File:** `integration/src/services/order.push.js`  
**Type:** Bug Fix

In `_reConfirmOrder`, replaced the `manualConfirmRequired: true` flag (which caused the polling query to permanently skip the transaction) with `confirmFailed: true` (which keeps the transaction in the polling queue for future retry attempts).

Also added: if the draft order is found in `state='sale'` or `state='done'` on re-entry (confirmed out-of-band or by a parallel attempt), `_reConfirmOrder` now clears `confirmFailed` from the metadata and returns success — preventing the flag from persisting indefinitely after the order has already been resolved.

**Before (route error path):**
```js
await xref.upsertXref('order', transactionId, odooOrderId, {
  ...meta, confirmFailed: false, manualConfirmRequired: true
});
```
**After (route error path):**
```js
await xref.upsertXref('order', transactionId, odooOrderId, {
  ...meta, confirmFailed: true
});
```

---

### CR-006b — Apply Fallback Route in `_reConfirmOrder` (same as `_doPushOrder`)
**File:** `integration/src/services/order.push.js`  
**Type:** Bug Fix

`_reConfirmOrder` (called by polling for orders in draft) previously did not apply the fallback route when `action_confirm` failed with a route error — it just kept `confirmFailed: true` forever. Added the same fallback logic as `_doPushOrder`: fetch all order lines → write `route_id=fallbackRouteId` → retry `action_confirm`. This unblocked TXN-20260527-00003 and TXN-20260526-00001 that were stuck in polling loops.

---

### CR-009 — Fix Customer Location Domain in `resolveStartupRefs`
**File:** `integration/src/clients/odoo.client.js`  
**Type:** Bug Fix — Critical

`resolveStartupRefs` was filtering customer stock locations with `company_id=companyId`. The global `Partners/Customers` location has `company_id=False` (not company-specific) and was therefore never found, leaving `_cache.customerLocationId=null`. As a result, `property_stock_customer` was never set on new partners, causing `action_confirm` to fail with "No rule has been found to replenish X in 'False'" for every new customer in company 5.

**Before:** `[['usage', '=', 'customer'], ['active', '=', true], ['company_id', '=', companyId]]`  
**After:** `[['usage', '=', 'customer'], ['active', '=', true], ['company_id', '=', false]]`

---

### CR-010 — Set `property_stock_customer` on Partner Update, Not Just Create
**File:** `integration/src/services/customer.sync.js`  
**Type:** Bug Fix

`resolveOrCreatePartner` already set `property_stock_customer` when creating a new partner (step 4), but not when updating an existing one (steps 1/2/3). Added a conditional write: if `customerLocationId` is known and the matched partner does not already have `property_stock_customer` set, include it in the update payload. This ensures all matched partners get the required customer location on their next order push, preventing the "in False" confirmation error.

Also extended the `searchRead` fields list in steps 1/2/3 to include `property_stock_customer` so the check can be performed.

---

### CR-007 — Broadcast PRODUCT_UPDATED Event from Admin Product Endpoints
**File:** `backend/src/modules/admin/admin.router.js`  
**Type:** Feature Fix (real-time sync)

Added `broadcastToAll({ event: 'PRODUCT_UPDATED' })` after every successful product mutation in the admin router. Affected endpoints:

| Method | Path | Action |
|---|---|---|
| `POST` | `/products` | Create product |
| `PATCH` | `/products/bulk-category` | Bulk category update |
| `PATCH` | `/products/bulk-odoo-category` | Bulk Odoo category update |
| `PATCH` | `/products/bulk-description` | Bulk description update |
| `PATCH` | `/products/:productId` | Update single product |
| `DELETE` | `/products/:productId` | Deactivate product |

---

### CR-008 — Real-Time Catalogue Refresh via WebSocket and Page Visibility
**File:** `frontend/src/hooks/useCatalogueState.js`  
**Type:** Feature Fix (real-time sync)

Refactored `useCatalogueState` to keep `/katalog` data in sync with admin changes without requiring a manual browser refresh:

1. **Extracted `loadData` callback** with a `fetchingRef` guard to prevent concurrent fetches triggered by rapid events.
2. **WebSocket subscriber**: `subscribe('PRODUCT_UPDATED', loadData)` — triggers a refetch whenever the admin mutates any product.
3. **Page Visibility listener**: re-fetches when the user returns to the browser tab (`document.visibilityState === 'visible'`).
4. **Product fetch limit**: increased from `200` → `500` to prevent partial catalogue loads for larger inventories.

### CR-011 — Replace Plain Input with CategoryCombobox in Bulk Category Modal
**File:** `frontend/src/pages/admin/tabs/MasterDataTab.jsx`  
**Type:** Bug Fix

Replaced the plain `<Input>` component in the "Set Kategori" bulk modal with `<CategoryCombobox categories={categories}>`. The combobox shows the registered SOS category list (loaded from `GET /products/categories`), filters by what the user types, and prevents free-form input from bypassing the category list. The `CategoryCombobox` component and the `categories` state were already present in the file but were not wired to the bulk modal.

**Before:**
```jsx
<Input label="Kategori" value={bulkCatValue} onChange={(e) => setBulkCatValue(e.target.value)} required />
```
**After:**
```jsx
<CategoryCombobox label="Kategori *" value={bulkCatValue} onChange={(val) => setBulkCatValue(val)} categories={categories} required />
```

---

### CR-012 — Fix ComboboxField Label Blank When Options Load Asynchronously
**File:** `frontend/src/components/ui/ComboboxField.jsx`  
**Type:** Bug Fix

Added a second `useEffect` that watches `[options]`. When the options array changes and a `value` is already selected (e.g., editing a product whose Odoo category was set, but `odooCategories` hadn't finished loading when the edit form opened), the effect finds the matching option and updates the display label. The `if (value == null) return` guard prevents it from interfering with free-text search mode (where `value` is null while the user is typing).

**Before:** Only one `useEffect` watched `[value]` — `options` excluded from deps meant the label never updated when options loaded after value was set.  
**After:** Second `useEffect` on `[options]` syncs the label whenever the list arrives for an already-selected value.

---

### CR-013 — Dynamic Event Info & Receipt Layout Update
**Files:**
- `frontend/src/components/cashier/ThermalReceipt.jsx`
- `backend/src/app.js`

**Type:** Feature / UI Change

**Changes:**

1. **Dynamic event header from admin config** — replaced hardcoded `EVENT_NAME`, `EVENT_VENUE`, `EVENT_DATE` constants with live data fetched via `usePublicConfig()` hook (calls `GET /config/public`). Falls back to the previous constants if config not yet loaded.

   Fields read:
   | Config field | Displayed as |
   |---|---|
   | `event_name` | Event name (SANS, Bold 700) |
   | `venue` | Venue line (SANS, 10px) |
   | `event_date_start` + `event_date_end` | Formatted date range, e.g. "19-21 Mei 2026" (SANS, 10px) |

   Date range formatting rules:
   - Same month: `19-21 Mei 2026`
   - Different months: `19 Mei - 3 Jun 2026`

2. **`event_date_start` / `event_date_end` added to `/config/public`** — previously these two fields were absent from the public config response; added them so the receipt can consume them without requiring authentication.

3. **Item price bold** — changed `itemPrice.fontWeight` from `'400'` → `'600'` so product name and price are both Bold 600, matching spec.

4. **Removed PPN tax row** — the separate `PPN X%` line in the totals section is removed. `Subtotal` shows the pre-tax amount; `TOTAL` shows the tax-inclusive `total_amount`. Tax is no longer broken out as a line item on the printed receipt.

**Before (totals section):**
```
Subtotal (3 items)    Rp 200.000
PPN 12%               Rp 24.000
─────────────────────────────────
TOTAL                 Rp 224.000
```

**After:**
```
Subtotal (3 items)    Rp 200.000
─────────────────────────────────
TOTAL                 Rp 224.000
```

---

### CR-014 — Tax-Inclusive Item Prices & Contact Email in Receipt Footer
**Files:**
- `frontend/src/components/cashier/ThermalReceipt.jsx`
- `frontend/src/pages/customer/ReceiptPickupPage.jsx`
- `backend/src/modules/print/print.service.js`
- `backend/src/app.js`

**Type:** UI Change

**Changes:**

1. **Item prices now show tax-inclusive amounts** — each item's displayed price is calculated as `Math.round(unit_price × quantity × (1 + tax_rate / 100))` using `txn.tax_rate` from the transaction. Display-only change; backend tax calculation logic is untouched.

2. **Subtotal row removed** — since item prices already include tax, the `Subtotal (N items)` row in the totals section is redundant and has been removed. Only the `TOTAL` line remains, sourced from `txn.total_amount`.

   **Before (totals section):**
   ```
   items 1              Rp 200.000
   items 2              Rp 200.000
   PPN 12%               Rp 24.000
   ─────────────────────────────────
   TOTAL                 Rp 424.000
   ```

   **After:**
   ```
   items 1              Rp 212.000  ← includes tax
   items 2              Rp 212.000  ← includes tax
   ─────────────────────────────────
   TOTAL                 Rp 424.000
   ```

3. **Footer uses `contact_email` from admin config** — replaced hardcoded `amazingtoyfair.id` string with the value from admin config in both the React receipt (`publicCfg.contact_email` via `usePublicConfig()`) and the thermal print service (`adminSvc.getSystemConfig()`). The line is hidden/skipped if the value is empty. Configured under Admin → Konfigurasi → Email Kontak.

4. **`contact_email` added to `/config/public`** — added `contact_email` field to the public config response in `backend/src/app.js` so the React receipt component can read it without authentication.

**Note:** All three changes above are applied to both code paths:
- React on-screen receipt: `ThermalReceipt.jsx`
- Thermal printer (ESC/POS): `print.service.js`

---

### CR-015 — Payment Voucher Integration: SOS → Odoo 18 Accounting Chain
**Files:**
- `integration/src/services/payment-voucher.service.js` *(new)*
- `integration/src/routes/webhook.router.js`
- `integration/src/scheduler/scheduler.js`
- `backend/src/modules/admin/admin.service.js`
- `backend/src/modules/admin/admin.router.js`
- `backend/migrations/009_payment_voucher_xref.sql` *(new)*

**Type:** Feature — Odoo Integration Extension

**Background:**  
Previously, a paid SOS transaction only pushed a `sale.order` to Odoo (draft → confirmed). The full accounting chain (invoice creation, posting, payment registration, and reconciliation) was not automated, requiring manual steps in Odoo.

**Changes:**

1. **New service `payment-voucher.service.js`** — implements the 4-step JSON-RPC chain after SO confirmation:

   | Step | Odoo Call | Result |
   |---|---|---|
   | [A] Verify SO | `sale.order.search_read` | Confirm `state = sale`; read `partner_id` |
   | [B] Create invoice | `sale.order.action_create_invoices` | `account.move` type `out_invoice` terbentuk |
   | [C] Post invoice | `account.move.action_post` | `state: draft → posted` |
   | [D] Register payment | `account.payment.create` + `action_post` + `js_assign_outstanding_line` | `payment_state: paid`, `amount_residual: 0` |

   Idempotency dijaga oleh `voucher_status` di `integration_xref` — setiap langkah di-resume dari checkpoint terakhir jika terjadi kegagalan:
   ```
   PENDING → CONFIRMED → INVOICED → PAID
   ```

2. **`webhook.router.js`** — setelah `pushOrder()` selesai, langsung trigger `pushPaymentVoucher()` secara berantai:
   ```js
   orderPush.pushOrder(txnId)
     .then(() => voucherSvc.pushPaymentVoucher(txnId))
   ```

3. **`scheduler.js`** — dua tambahan:
   - Handler `PAYMENT_VOUCHER` didaftarkan ke retry queue
   - Polling fallback setiap `POLLING_INTERVAL_SEC` detik: mendeteksi order dengan `odoo_id` set tapi `voucher_status ≠ PAID`, lalu re-trigger voucher chain

4. **`admin.service.js`** — tambah `odoo_payment_journals: {}` ke `DEFAULT_INTEGRATION_CONFIG` untuk menyimpan mapping metode bayar → Odoo `journal_id`:
   ```json
   { "CASH": 14, "QRIS": 15, "EDC": 16, "TRANSFER": 17 }
   ```

5. **`admin.router.js`** — dua endpoint baru:
   - `GET  /api/v1/admin/odoo/payment-journals` — baca mapping journal
   - `PUT  /api/v1/admin/odoo/payment-journals` — simpan mapping journal

6. **Migration `009_payment_voucher_xref.sql`** — empat kolom baru di `integration_xref`:
   ```sql
   odoo_invoice_id   INTEGER         -- Odoo account.move ID
   odoo_payment_id   INTEGER         -- Odoo account.payment ID
   voucher_status    VARCHAR(20)     -- PENDING|CONFIRMED|INVOICED|PAID|FAILED
   voucher_synced_at TIMESTAMPTZ     -- Timestamp sync terakhir
   ```
   + partial index `idx_xref_voucher_status` untuk polling query.

**Error Handling:**  
Kegagalan di langkah mana pun **tidak memblokir transaksi SOS**. Sistem menggunakan fire-and-forget dengan:
- Retry queue (exponential backoff: 1s → 5s → 30s → 2m → 10m → 30m, max 3 attempts)
- Circuit breaker Odoo (5 gagal → open, reset 2 menit)
- `voucher_status = FAILED` jika semua retry habis — visible di Admin → Integrasi → Sync Log

**Hasil akhir di Odoo untuk setiap TXN PAID:**
```
sale.order (origin: TXN-YYYYMMDD-NNNNN)
  └── state: sale (confirmed + locked)
      └── account.move (INV/YYYY/NNNNN)
            └── state: posted
                payment_state: paid
                amount_residual: 0.00
                └── account.payment
                      journal: [sesuai payment_method]
                      ref: TXN-YYYYMMDD-NNNNN
```

**Setup wajib sebelum live:**
1. Di Odoo: catat `journal_id` untuk Kas, QRIS, EDC, Transfer (Accounting → Configuration → Journals)
2. Di `/admin` → Integrasi → Odoo Payment Journals: isi mapping
3. Jalankan migration `009_payment_voucher_xref.sql` (sudah applied ke DB aktif)

---

### CR-016 — Fix Duplicate SO & CB-Induced Delay in Odoo Integration
**Files:**
- `integration/src/routes/webhook.router.js`
- `integration/src/scheduler/scheduler.js`
- `integration/src/services/order.push.js`

**Type:** Bug Fix — Integration Resilience

**Triggered by:** BUG-010 (`TXN-20260528-00014` — delayed integration + duplicate SO in Odoo)

**Changes:**

1. **`webhook.router.js`** — voucher chain now only fires when `pushOrder` returns `success: true`:
   ```js
   // Before
   pushOrder(txn).then(() => pushVoucher(txn))

   // After
   pushOrder(txn).then(result => { if (result?.success) pushVoucher(txn); })
   ```
   Prevents spurious voucher retries being queued when the SO push itself was blocked by the circuit breaker.

2. **`scheduler.js`** — both polling loops made safe:
   - `ORDER_PUSH` polling: `LIMIT 100 → 5`, loop changed to `await` (sequential)
   - `VoucherPoll`: `LIMIT 50 → 5`, already `await`
   
   Prevents 90+ concurrent Odoo calls from a backlog flush, which was tripping the CB and delaying live transactions by 2–8 minutes.

3. **`order.push.js`** — added `inFlight` guard before SO creation:
   ```js
   // Before creating SO in Odoo, mark xref as in-flight
   await xref.upsertXref('order', transactionId, null, { inFlight: true });
   // ... create SO ...
   await xref.upsertXref('order', transactionId, odooOrderId, { ... }); // clears flag
   ```
   Any concurrent run (polling + retry queue firing simultaneously after CB reset) that sees `inFlight: true` within the last 60s backs off immediately. Eliminates the race condition that produced duplicate SOs.

**Root cause correlation:**  
CR-015 (Payment Voucher) introduced `VoucherPoll` with `LIMIT 50` + concurrent fire — this caused CB to open under backlog conditions (not triggered during initial testing because there was no backlog). CR-016 is the hardening layer on top of CR-015.

---

### CR-017 — Fix VoucherPoll & ORDER_PUSH Polling Queries (CB-Flood Prevention)
**Files:**
- `integration/src/scheduler/scheduler.js`

**Type:** Bug Fix — Integration Resilience

**Triggered by:** BUG-011 (CB-flood blocking new transactions incl. TXN-20260528-00041)

**Changes:**

1. **VoucherPoll query** — added two filter conditions so unconfirmed SOs are never picked up by the voucher chain:
   ```sql
   -- Before
   AND (x.voucher_status IS NULL OR x.voucher_status NOT IN ('PAID'))

   -- After
   AND (x.voucher_status IS NULL OR x.voucher_status NOT IN ('PAID', 'FAILED'))
   AND (x.sync_metadata->>'confirmFailed')::boolean IS NOT TRUE
   AND (x.sync_metadata->>'manualConfirmRequired')::boolean IS NOT TRUE
   ```
   `FAILED` status is also excluded — permanently-failed vouchers require manual intervention and must not be auto-retried.

2. **ORDER_PUSH polling query** — extended to pick up transactions with the legacy `manualConfirmRequired` flag (pre-CR-006 entries in DB):
   ```sql
   -- Before
   AND (x.odoo_id IS NULL OR (x.sync_metadata->>'confirmFailed')::boolean = true)

   -- After
   AND (x.odoo_id IS NULL
        OR (x.sync_metadata->>'confirmFailed')::boolean = true
        OR (x.sync_metadata->>'manualConfirmRequired')::boolean = true)
   ```

3. **Dead-letter handler** — registered a `PAYMENT_VOUCHER` callback in the retry queue processor. When a voucher exhausts `RETRY_MAX_ATTEMPTS`, `voucher_status = 'FAILED'` is written to `integration_xref` immediately, so VoucherPoll stops picking it up on the next cycle:
   ```js
   const deadLetterHandlers = {
     PAYMENT_VOUCHER: async ({ transactionId }) => {
       await query(`UPDATE integration_xref SET voucher_status = 'FAILED', voucher_synced_at = NOW()
                    WHERE entity_type = 'order' AND sos_id = $1`, [transactionId]);
     },
   };
   await retryQueue.processDue(retryHandlers, deadLetterHandlers);
   ```

---

### CR-018 — Fix payment-voucher.service.js: "SO Not Found" as Terminal Failure
**File:** `integration/src/services/payment-voucher.service.js`  
**Type:** Bug Fix

Step `[A]` of the voucher chain previously threw `new Error('SO id=X not found in Odoo')` into a generic catch block that silently re-queued the item. This caused 3 transactions (TXN-20260504-00004, TXN-20260506-00005, TXN-20260506-00006) whose Odoo SOs were deleted to retry forever, tripping the CB on every polling cycle.

**Before:**
```js
if (!order) throw new Error(`SO id=${soId} not found in Odoo`);
// ...
} catch (err) {
  cb.recordFailure('odoo');
  retryQ.enqueue({ type: 'PAYMENT_VOUCHER', ... });
  return { success: false, error: `[A] verify SO: ${err.message}` };
}
```

**After:**
```js
if (!order) {
  logger.error('PaymentVoucher: [A] SO not found in Odoo — marking FAILED', { transactionId, soId });
  await _patch(transactionId, { voucher_status: VS.FAILED });
  return { success: false, error: `SO id=${soId} not found in Odoo` };
}
// generic catch now also logs:
} catch (err) {
  cb.recordFailure('odoo');
  logger.error('PaymentVoucher: [A] verify SO failed — re-queuing', { transactionId, soId, error: err.message });
  retryQ.enqueue(...);
```

"SO not found" is now a terminal failure: `voucher_status = FAILED` is written immediately and the item never re-queued. Any other Odoo error is still retriable but now logged.

---

### CR-019 — Add onDeadLetter Callback to retry.queue.js
**File:** `integration/src/queue/retry.queue.js`  
**Type:** Infrastructure Fix

Added an optional second parameter `onDeadLetter = {}` to `processDue`. When an item exceeds `RETRY_MAX_ATTEMPTS`, the matching handler (keyed by `item.type`) is called after `audit.pushDeadLetter`:

```js
// Before
async function processDue(handlers) { ... }
if (nextAttempt > env.RETRY_MAX_ATTEMPTS) {
  await audit.pushDeadLetter(item.type, item.id, item.payload, err.message);
}

// After
async function processDue(handlers, onDeadLetter = {}) { ... }
if (nextAttempt > env.RETRY_MAX_ATTEMPTS) {
  await audit.pushDeadLetter(item.type, item.id, item.payload, err.message);
  if (onDeadLetter[item.type]) {
    await onDeadLetter[item.type](item.payload, err.message).catch(() => {});
  }
}
```

This allows callers to hook post-dead-letter cleanup (e.g., writing `voucher_status = FAILED`) without coupling the queue to application domain logic.

---

### CR-020 — Merge Polling Loops into Single Sequential setInterval (CB-Flood Prevention)
**File:** `integration/src/scheduler/scheduler.js`  
**Type:** Bug Fix — Integration Resilience  
**Triggered by:** BUG-012 (concurrent polling causing intermittent CB trips and delayed sync)

**Problem:**  
`ORDER_PUSH polling` dan `VoucherPoll` berjalan sebagai dua `setInterval` terpisah dengan interval dan start time yang sama. Keduanya selalu fire bersamaan (T=0, T=60, T=120...) dan Node.js event loop memungkinkan mereka berjalan *concurrent* melalui `await` suspension points. Di T=60, retry queue (30s) juga ikut fire, menghasilkan 3 polling loops Odoo concurrent setiap menit.

**Before:**
```js
// Fires at T=0, 60, 120... — concurrent with VoucherPoll
setInterval(async () => {
  for (const row of orderRows) await orderPush.pushOrder(row.transaction_id);
}, POLLING_INTERVAL_SEC * 1000);

// Fires at T=0, 60, 120... — concurrent with ORDER_PUSH
setInterval(async () => {
  for (const row of voucherRows) await voucherSvc.pushPaymentVoucher(row.transaction_id);
}, POLLING_INTERVAL_SEC * 1000);
```

**After:**
```js
let _polling = false;
setInterval(async () => {
  if (_polling) { logger.warn('Polling: previous cycle still running — skipping tick'); return; }
  _polling = true;
  try {
    // Phase 1: ORDER_PUSH (runs to completion before Phase 2 starts)
    for (const row of orderResult.rows)
      await orderPush.pushOrder(row.transaction_id).catch(...);

    // Phase 2: VoucherPoll (runs only after Phase 1 completes)
    for (const row of voucherResult.rows)
      await voucherSvc.pushPaymentVoucher(row.transaction_id).catch(...);
  } finally {
    _polling = false;
  }
}, POLLING_INTERVAL_SEC * 1000);
```

Also added `_retrying` guard to the retry queue processor:
```js
let _retrying = false;
setInterval(async () => {
  if (_retrying) return;
  _retrying = true;
  try { await retryQueue.processDue(retryHandlers, deadLetterHandlers); }
  finally { _retrying = false; }
}, 30_000);
```

**Effect:**  
- ORDER_PUSH and VoucherPoll can never make concurrent Odoo API calls — maximum Odoo calls per polling cycle is `10 × ~5 calls = 50`, well within the 100 req/min Odoo Online limit.
- Slow cycles (reconfirming multiple draft SOs) skip the next tick instead of launching a second concurrent instance.
- CB will no longer trip from polling-induced burst, so real-time webhook pushes are never blocked by polling backlog.

---

### CR-021 — Price Including Tax Field on Admin Product Form
**Files:**
- `frontend/src/pages/admin/tabs/MasterDataTab.jsx`

**Type:** Feature — UI Enhancement  
**Date:** 2026-05-29

**Background:**  
Admin tidak memiliki visibilitas harga final (inklusif PPN) saat input/edit produk. Mereka harus menghitung manual tiap kali, dan risiko salah input harga yang tidak sesuai dengan harga yang ditampilkan ke customer di receipt.

**Changes:**

1. **Import `getTaxConfig`** — ditambahkan ke import block dari `'../../../api/admin'`.

2. **State `ppnRate`** — ditambahkan di `MasterDataTab`:
   ```js
   const [ppnRate, setPpnRate] = useState(0);
   ```

3. **Fetch on mount** — dipanggil bersama `getTenants` dan `getCategories` dalam `useEffect`:
   ```js
   getTaxConfig()
     .then((r) => setPpnRate(parseFloat(r.data.data?.ppn_rate) || 0))
     .catch(() => {}); // silent fallback: ppnRate = 0
   ```

4. **`FormFields` signature** — tambah prop `ppnRate`:
   ```js
   function FormFields({ ..., ppnRate }) { ... }
   ```

5. **Field "Harga Termasuk Pajak"** — disisipkan tepat di bawah grid Kategori + Harga, full-width:
   ```jsx
   <div className="flex flex-col gap-1">
     <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
       Harga Termasuk Pajak
       <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
         <svg ...lock icon... />
         PPN {ppnRate ?? 0}%
       </span>
     </label>
     <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm
                     bg-gray-50 text-gray-500 cursor-not-allowed select-none">
       {formatRupiah((parseFloat(form.price) || 0) * (1 + (parseFloat(ppnRate) || 0) / 100))}
     </div>
   </div>
   ```

6. **Prop passed** — `ppnRate={ppnRate}` ditambahkan ke kedua instansi `<FormFields>` (Create modal + Edit modal).

**Behavior:**
| Kondisi | Tampilan field |
|---|---|
| Harga = 295.000, PPN = 11% | `Rp 327.450` |
| Harga = 0 atau kosong | `Rp 0` (no NaN) |
| PPN = 0 atau API gagal | Nilai sama dengan Harga (× 1.0) |
| Harga berubah (onChange) | Update real-time via React re-render |

**Non-requirements (by design):**
- Tidak ada kolom baru di database — computed display-only
- Tidak ada perubahan backend
- PPN rate selalu diambil live dari `/admin/tax-config` saat `MasterDataTab` mount — otomatis sync jika Admin ubah tarif PPN di tab Pajak & SPT

---

### CR-022 — Display Harga Termasuk Pajak di /katalog dan /keranjang
**Files:**
- `backend/src/app.js`
- `frontend/src/components/catalogue/ProductCard.jsx`
- `frontend/src/components/catalogue/ProductBottomSheet.jsx`
- `frontend/src/pages/customer/CartPage.jsx`

**Type:** Feature — Display Change  
**Date:** 2026-05-29

**Background:**  
Harga yang ditampilkan ke customer di halaman `/katalog` (kartu produk & bottom sheet detail) dan `/keranjang` masih menggunakan harga dasar (pre-tax). CR ini mengubah tampilan harga menjadi **Harga Termasuk Pajak** (`price × (1 + ppn_rate/100)`) agar konsisten dengan harga yang customer bayar di kasir dan tercantum di receipt.

**Perubahan:**

1. **`backend/src/app.js` — Expose `ppn_rate` di `/config/public`**  
   Endpoint publik ini dapat diakses tanpa auth oleh semua halaman customer. Ditambahkan field `ppn_rate` yang dibaca dari `system_settings.tax_config` (sumber sama dengan `/admin/tax-config`):
   ```js
   const taxCfg = await adminSvc.getTaxConfig().catch(() => ({}));
   res.json({ success: true, data: {
     ...existing fields...,
     ppn_rate: parseFloat(taxCfg.ppn_rate) || 0,  // ← NEW
   }});
   ```
   Jika `getTaxConfig` gagal, `ppn_rate` fallback ke `0` (harga tidak berubah).

2. **`ProductCard.jsx` — Harga di kartu produk katalog**  
   Ditambahkan `usePublicConfig` hook (sudah ada, module-level cached — tidak ada extra network call):
   ```jsx
   const config  = usePublicConfig();
   const ppnRate = parseFloat(config?.ppn_rate) || 0;
   // ...
   {formatPrice(Math.round(product.price * (1 + ppnRate / 100)))}
   ```

3. **`ProductBottomSheet.jsx` — Harga di detail popup produk**  
   Sama seperti ProductCard: tambah `usePublicConfig`, ganti display harga:
   ```jsx
   const ppnRate = parseFloat(config?.ppn_rate) || 0;
   // ...
   {formatPrice(Math.round(product.price * (1 + ppnRate / 100)))}
   ```

4. **`CartPage.jsx` — Harga per item dan total di keranjang**  
   ```jsx
   const ppnRate = parseFloat(config?.ppn_rate) || 0;
   // Per item:
   {formatRupiah(Math.round(item.price * item.quantity * (1 + ppnRate / 100)))}
   // Total:
   {formatRupiah(Math.round(totalAmount * (1 + ppnRate / 100)))}
   ```

**Yang TIDAK berubah (by design):**
- `CartContext` (`useCart`) — tidak disentuh; `items[].price` dan `totalAmount` tetap menyimpan harga dasar
- `handleCheckout` di `CartPage` — logic checkout ke backend tidak berubah; payload order tidak berubah
- `createOrder` API call — tidak berubah
- Semua module lain (cashier, payment, receipt, admin, integration) — tidak disentuh
- `ProductDetailPage` (`/product/:id`) — tidak diubah (di luar scope CR)

**Sumber `ppn_rate`:**  
`system_settings` table → key `tax_config` → field `ppn_rate`  
Dikelola via: `/admin` → sub-menu **Pajak & SPT** → field **Tarif PPN (%)**

**Caching:**  
`usePublicConfig` menggunakan module-level cache (singleton per page load). Tiga komponen yang memanggil hook ini (ProductCard, ProductBottomSheet, CartPage) berbagi satu network request. Jika Admin mengubah tarif PPN, perubahan akan terlihat setelah page refresh customer.

**Contoh Kalkulasi (ppn_rate = 12%):**

| Base Price | Harga Tampil |
|---|---|
| Rp 295.000 | Rp 330.400 |
| Rp 50.000 | Rp 56.000 |
| Rp 1.000.000 | Rp 1.120.000 |

---

### CR-023 — POS Langsung: Cashier Direct Order Creation & In-Payment Product Browser
**Files:**
- `frontend/src/pages/cashier/CashierPOSPage.jsx` *(new)*
- `frontend/src/pages/cashier/PaymentPage.jsx`
- `frontend/src/api/cashier.js`
- `frontend/src/App.jsx`
- `frontend/src/pages/cashier/CashierDashboardPage.jsx`
- `backend/src/modules/cashier/cashier.router.js`
- `backend/src/modules/orders/orders.service.js`

**Type:** Feature — Cashier UX Enhancement  
**Date:** 2026-05-30  
**Author:** clavis Development

**Background:**  
Sebelumnya kasir hanya bisa memproses transaksi berdasarkan ID yang dibuat oleh customer melalui kiosk. Tidak ada cara bagi kasir untuk membuat pesanan langsung (walk-in / offline sale) tanpa customer menggunakan kiosk terlebih dahulu. CR ini menambahkan dua fitur sekaligus:
1. **POS Langsung** — halaman baru untuk kasir browse produk, buat cart, dan buat pesanan langsung
2. **In-payment product browser** — kemampuan menambah produk ke transaksi PENDING yang sudah ada di halaman `/cashier/bayar/:id`

**Changes:**

1. **`CashierPOSPage.jsx` (new)** — Halaman POS 2-panel:
   - Kiri: search bar, category chips, product card grid (fetch dari `GET /products`)
   - Kanan: cart panel dengan qty controls (`+`/`−`), total, tombol Bayar
   - Tombol Bayar memanggil `POST /cashier/orders` → redirect ke `PaymentPage` yang sudah ada
   - Accessible via `/cashier/pos` dan shortcut di `CashierDashboardPage`

2. **`PaymentPage.jsx` — redesign 2-kolom:**
   - Kolom kiri (460px): detail transaksi + form pembayaran (tidak berubah secara logic)
   - Kolom kanan (flex-1): product browser baru, hanya ditampilkan saat status transaksi `PENDING`
     - Kotak hijau (atas): category chips filter
     - Kotak merah (bawah): product card grid dengan tombol `+ Tambah`
   - Klik produk → `POST /cashier/orders/:transactionId/items` → auto-refresh transaksi (item list + total terupdate)

3. **`cashier.router.js` — 2 endpoint baru:**
   ```
   POST /api/v1/cashier/orders                        → createOrderByCashier
   POST /api/v1/cashier/orders/:transactionId/items   → addItemToTransaction
   ```
   Kedua endpoint menggunakan `authorize('CASHIER', 'LEADER')`.

4. **`orders.service.js` — 2 fungsi baru:**
   - `createOrderByCashier(cashierId, items)` — menggunakan "Walk-in Customer" (`phone: 0000000000`) yang dibuat otomatis (lazy-create) agar FK `customer_id` pada tabel `transactions` tetap terpenuhi tanpa perubahan schema DB
   - `addItemToTransaction(transactionId, cashierId, productId, quantity)` — upsert item ke transaksi PENDING, decrement stock, recalculate totals

5. **`App.jsx`** — tambah route `/cashier/pos` dan nav item `🛒 POS Langsung` di sidebar kasir

6. **`CashierDashboardPage.jsx`** — tambah banner/shortcut biru ke `/cashier/pos`

7. **`api/cashier.js`** — tambah `createCashierOrder(items)` dan `addItemToTransaction(transactionId, productId, quantity)`

**Walk-in Customer Logic:**
```
POST /cashier/orders
  → SELECT customer_id FROM customers WHERE phone_number = '0000000000'
  → (jika tidak ada) INSERT INTO customers (full_name='Walk-in Customer', phone_number='0000000000')
  → INSERT INTO transactions (customer_id=walkin_id, cashier_id=cashierId, ...)
```

**Deployment:**  
Rebuild Docker image diperlukan untuk menerapkan perubahan ini:
```
docker compose down
docker compose up --build -d
```

---

### CR-023a — Display Harga Termasuk Pajak di /pesanan/:transactionId
**Files:**
- `frontend/src/pages/customer/OrderTrackingPage.jsx`

**Type:** Feature — Display Change  
**Date:** 2026-05-30

**Background:**  
Halaman `/pesanan/:transactionId` (OrderTrackingPage) menampilkan harga item masih pre-tax, tidak konsisten dengan `/katalog`, `/keranjang`, dan receipt. CR ini menyamakan tampilan harga menjadi **Harga Termasuk Pajak** di daftar item order dan modal edit jumlah.

**Perubahan:**

1. **Import `usePublicConfig`** dari `../../hooks/useAppLogo` — sumber `ppn_rate` sama dengan CR-022.
2. **Harga item per baris** — `formatRupiah(item.unit_price * item.quantity)` → `formatRupiah(Math.round(item.unit_price * item.quantity * (1 + ppnRate / 100)))`
3. **Subtotal di modal edit jumlah** — `formatRupiah(editItem.unit_price * editQty)` → `formatRupiah(Math.round(editItem.unit_price * editQty * (1 + ppnRate / 100)))`

**Yang TIDAK berubah (by design):**
- `order.total_amount` (header) — sudah include tax sejak disimpan ke DB, tidak diubah
- Semua logic checkout, API call, backend, CartContext — tidak disentuh
- Module/page lain — tidak disentuh

**Sumber `ppn_rate`:**  
`system_settings` table → key `tax_config` → field `ppn_rate`  
Dikelola via: `/admin` → sub-menu **Master Data** → tab **Pajak & SPT**

---

### CR-024 — Display Harga Termasuk Pajak di /product/:id
**Files:**
- `frontend/src/pages/customer/MockProductDetailPage.jsx`

**Type:** Feature — Display Change  
**Date:** 2026-05-31

**Background:**  
CR-022 menerapkan Harga Termasuk Pajak di `/katalog`, `/keranjang`, dan bottom sheet detail produk, namun secara eksplisit mengecualikan `ProductDetailPage (/product/:id)` — *"tidak diubah (di luar scope CR)"*. CR ini melengkapi jalur rendering yang tersisa.

**Perubahan:**

1. **Import `usePublicConfig`** dari `../../hooks/useAppLogo`
2. **Tambah `ppnRate`** di dalam komponen:
   ```jsx
   const config  = usePublicConfig();
   const ppnRate = parseFloat(config?.ppn_rate) || 0;
   ```
3. **Harga tampil** — ganti `formatPrice(product.price)` → `formatPrice(Math.round(product.price * (1 + ppnRate / 100)))`

**Yang TIDAK berubah (by design):**
- `handleAddToCart` — tetap menggunakan `product.price` (pre-tax); CartPage yang bertanggung jawab menampilkan harga tax-inclusive di keranjang
- Semua logic checkout, API call, backend — tidak disentuh
- Module/page lain — tidak disentuh

**Sumber `ppn_rate`:**  
`system_settings` table → key `tax_config` → field `ppn_rate`  
Dikelola via: `/admin` → sub-menu **Master Data** → tab **Pajak & SPT**

**Status jalur rendering customer (tax-inclusive):**
| Halaman | File | Status |
|---|---|---|
| `/katalog` — kartu produk | `ProductCard.jsx` | ✓ CR-022 |
| `/katalog` — bottom sheet detail | `ProductBottomSheet.jsx` | ✓ CR-022 |
| `/keranjang` | `CartPage.jsx` | ✓ CR-022 |
| `/product/:id` | `MockProductDetailPage.jsx` | ✓ CR-024 |
| `/pesanan/:id` | `OrderTrackingPage.jsx` | ✓ CR-023a |
| `/pesanan/:id/receipt` | `ReceiptPickupPage.jsx` | ✓ BUG-008 |
| Kasir print modal | `ThermalReceipt.jsx` | ✓ CR-014 |

---

### CR-025 — Konfigurasi Durasi Timer Pembayaran via Environment Variable
**Files:**
- `backend/.env`
- `backend/.env.example`
- `docker-compose.yml`

**Type:** Configuration Documentation  
**Date:** 2026-05-31  
**Author:** clavis Development

**Background:**  
Timer "Pay in X:XX minutes" di halaman `/checkout/sukses` menampilkan sisa waktu pembayaran berdasarkan `expiresAt` yang dikirim backend saat order dibuat. Durasi default 30 menit dapat diubah tanpa menyentuh kode.

**Mechanism (sudah terkonfigurasi):**

Durasi dikontrol oleh satu konstanta di `backend/src/modules/orders/orders.service.js` baris 11:
```js
const PENDING_TIMEOUT_MINUTES = parseInt(process.env.TXN_PENDING_TIMEOUT_MINUTES || '30', 10);
```

Konstanta ini dibaca **satu kali saat module load** — perubahan `.env` membutuhkan restart backend.

**Cara mengubah durasi:**

1. Edit `backend/.env`:
   ```
   TXN_PENDING_TIMEOUT_MINUTES=15   # contoh: ubah ke 15 menit
   ```
2. Restart backend container:
   ```bash
   docker compose restart sos_backend
   ```

**Konfigurasi terverifikasi:**

| Layer | File | Value |
|---|---|---|
| Env file | `backend/.env` | `TXN_PENDING_TIMEOUT_MINUTES=30` |
| Env example | `backend/.env.example` | `TXN_PENDING_TIMEOUT_MINUTES=30` |
| Docker Compose | `docker-compose.yml` baris 56 | `TXN_PENDING_TIMEOUT_MINUTES: ${TXN_PENDING_TIMEOUT_MINUTES:-30}` |
| Backend | `orders.service.js` baris 11 | `process.env.TXN_PENDING_TIMEOUT_MINUTES \|\| '30'` |

**Catatan:**  
Konstanta `PENDING_TIMEOUT_MINUTES` digunakan di dua tempat dalam `orders.service.js`:
- Baris 72: `createOrder()` — order dari customer kiosk
- Baris 350: `createOrderByCashier()` — order dari POS Langsung (CR-023)

Kedua path menggunakan nilai yang sama dari env var.

---

### CR-026 — Delete Item dari Pesanan PENDING via Tombol "−" di Edit Jumlah Modal
**Files:**
- `backend/src/modules/orders/orders.service.js`
- `backend/src/modules/orders/orders.router.js`
- `frontend/src/api/orders.js`
- `frontend/src/pages/customer/OrderTrackingPage.jsx`

**Type:** Feature — UX Enhancement  
**Date:** 2026-05-31  
**Author:** clavis Development

**Background:**  
Sebelumnya tombol "−" di modal Edit Jumlah dinonaktifkan (`disabled`) ketika qty=1, sehingga tidak ada cara bagi customer untuk menghapus satu item dari pesanan PENDING selain membatalkan seluruh order. CR ini menambahkan flow hapus item langsung dari modal qty.

**Flow:**
1. Customer klik ikon edit (pensil) pada item di halaman `/pesanan/:transactionId`
2. Modal "Edit Jumlah" terbuka — tombol "−" kini bisa ditekan hingga angka 0
3. Ketika qty mencapai 0 (dari 1 → klik "−"), modal delete confirmation muncul otomatis
4. **"Hapus"** → item dihapus dari order, stok dikembalikan, total direcalculate
5. **"Tidak"** → qty direset ke 1, kembali ke modal edit

**Edge case — item terakhir:**  
Jika item yang dihapus adalah satu-satunya item dalam order, order otomatis di-`CANCELLED` dan frontend redirect ke `/pesanan` (history).

**Changes:**

1. **`orders.service.js` — fungsi baru `removeOrderItem(transactionId, customerId, productId)`**:
   - Lock transaction row (FOR UPDATE)
   - Validasi: txn ada, milik customer, status PENDING
   - Restore stock item ke `products`
   - `DELETE FROM transaction_items`
   - Jika item terakhir → `UPDATE transactions SET status='CANCELLED'` + fire webhook `order-cancelled`
   - Jika masih ada item lain → recalculate `subtotal_amount`, `tax_amount`, `total_amount`
   - Audit log `TXN_ITEM_REMOVED`

2. **`orders.router.js` — endpoint baru**:
   ```
   DELETE /api/v1/orders/:transactionId/items/:productId
   ```
   Guard: `authenticate`, `authorize('CUSTOMER')`

3. **`api/orders.js`**:
   ```js
   export const deleteOrderItem = (transactionId, productId) =>
     client.delete(`/orders/${transactionId}/items/${productId}`);
   ```

4. **`OrderTrackingPage.jsx`**:
   - State baru: `deleteConfirmModal` (boolean), `deleting` (boolean)
   - Tombol "−": jika `editQty === 1` → set `editQty(0)` + `setDeleteConfirmModal(true)` alih-alih decrement; disabled hanya jika `editQty <= 0`
   - Modal edit disembunyikan saat `deleteConfirmModal=true` (`open={!!editItem && !deleteConfirmModal}`)
   - Modal baru "Hapus Item": "Hapus" → `handleDeleteItem()`, "Tidak" → reset qty ke 1
   - `handleDeleteItem`: call `deleteOrderItem` → jika `orderCancelled=true` navigate ke `/pesanan`, selain itu `fetchOrder()`

**Yang TIDAK berubah (by design):**
- `updateItemQuantity` — validator backend masih `min: 1`, tidak perlu diubah
- Logic cancel order penuh (`cancelOrder`) — tidak disentuh
- Cashier edit item path (`/cashier/*`) — tidak disentuh

---

### CR-027 — Field "Batas Waktu Checkout" di Admin Konfigurasi → Aturan Transaksi
**Files:**
- `backend/src/modules/admin/admin.service.js`
- `backend/src/modules/orders/orders.service.js`
- `frontend/src/pages/admin/tabs/ConfigTab.jsx`

**Type:** Feature — Admin Configurability  
**Date:** 2026-05-31  
**Author:** clavis Development

**Background:**  
Field `pending_timeout_minutes` sudah ada di halaman Admin → Konfigurasi → Aturan Transaksi, namun field ini **tidak terhubung** ke logika pembuatan order — `orders.service.js` membaca timeout dari env var `TXN_PENDING_TIMEOUT_MINUTES` sebagai konstanta module-level yang hanya dibaca saat server boot. Mengubah nilai di UI tidak mengubah perilaku nyata. CR ini memperbaiki gap tersebut sekaligus menambahkan field `txn_timeout_checkout` yang benar-benar fungsional.

**Root cause gap sebelumnya:**
```js
// orders.service.js — LAMA: modul-level const, hanya dibaca saat boot
const PENDING_TIMEOUT_MINUTES = parseInt(process.env.TXN_PENDING_TIMEOUT_MINUTES || '30', 10);
// → Perubahan di admin UI tidak pernah berpengaruh
```

**Changes:**

1. **`admin.service.js` — `DEFAULT_SYSTEM_CONFIG`**:
   - Hapus field `pending_timeout_minutes: 30` yang tidak terhubung ke apapun
   - Tambah field `txn_timeout_checkout` dengan nilai awal dari env var:
   ```js
   txn_timeout_checkout: parseInt(process.env.TXN_PENDING_TIMEOUT_MINUTES || '30', 10),
   ```
   Field ini disimpan ke `data/system-config.json` saat admin klik "Simpan Konfigurasi".

2. **`orders.service.js` — runtime read**:
   - Hapus `const PENDING_TIMEOUT_MINUTES = ...` (module-level, read-once)
   - Tambah import `fs` + `path`
   - Tambah helper `_getCheckoutTimeoutMinutes()` yang membaca `system-config.json` saat order dibuat:
   ```js
   function _getCheckoutTimeoutMinutes() {
     try {
       const cfg = JSON.parse(fs.readFileSync(_SYSTEM_CONFIG_PATH, 'utf8'));
       const val = parseInt(cfg.txn_timeout_checkout, 10);
       return (Number.isFinite(val) && val > 0) ? val : _ENV_TIMEOUT;
     } catch {
       return _ENV_TIMEOUT; // fallback ke TXN_PENDING_TIMEOUT_MINUTES env var
     }
   }
   ```
   - Ganti dua titik pemakaian `PENDING_TIMEOUT_MINUTES * 60 * 1000` → `_getCheckoutTimeoutMinutes() * 60 * 1000`
     - `createOrder()` (baris ~86) — order dari customer kiosk
     - `createOrderByCashier()` (baris ~457) — order dari POS Langsung (CR-023)

3. **`ConfigTab.jsx` — "Aturan Transaksi" section**:
   - Ganti field `pending_timeout_minutes` → `txn_timeout_checkout`
   - Label: "Batas Waktu Checkout (menit)"
   - Tambah helper text: "Timer 'Bayar dalam X menit' di halaman konfirmasi order. Sumber: `TXN_PENDING_TIMEOUT_MINUTES`"
   - Validasi: `parseInt(e.target.value, 10) || 30` — fallback ke 30 jika input tidak valid

**Priority order (cascade):**
```
1. system-config.json → txn_timeout_checkout  (admin UI, persistent)
2. env var TXN_PENDING_TIMEOUT_MINUTES          (fallback jika file tidak ada)
3. hardcoded 30                                  (fallback akhir)
```

**Tidak perlu restart server** — `_getCheckoutTimeoutMinutes()` membaca file di setiap order creation, sehingga perubahan dari Admin langsung efektif untuk order berikutnya.

**Yang TIDAK berubah (by design):**
- `data/system-config.json` schema — hanya mengganti nama satu key
- Semua logika order lainnya — tidak disentuh
- `TXN_PENDING_TIMEOUT_MINUTES` di `.env` tetap relevan sebagai fallback awal dan untuk existing deployments

**Deployment:**
```bash
docker compose build backend && docker compose up -d backend
docker compose build frontend && docker compose up -d frontend
```

**Catatan untuk existing deployment:**  
`system-config.json` yang sudah ada mungkin masih punya `pending_timeout_minutes` (lama) tapi tidak ada `txn_timeout_checkout`. Saat admin membuka Admin → Konfigurasi pertama kali, nilai default dari env var (`TXN_PENDING_TIMEOUT_MINUTES`) akan digunakan. Setelah admin klik "Simpan Konfigurasi", `txn_timeout_checkout` akan tertulis ke file.

---

### CR-028 — Enforce "Maks Item per Order" di Backend dan Frontend
**Files:**
- `backend/src/modules/orders/orders.service.js`
- `backend/src/app.js`
- `frontend/src/pages/customer/CartPage.jsx`

**Type:** Bug Fix — Dead Config Enforcement  
**Date:** 2026-05-31  
**Author:** clavis Development  
**Triggered by:** BUG-014 (TXN-20260531-00058 — customer berhasil order > 20 item)

**Root cause:**  
`max_items_per_order` dalam `DEFAULT_SYSTEM_CONFIG` (admin.service.js) disimpan ke `system-config.json` dan ditampilkan di Admin → Konfigurasi → Aturan Transaksi, tetapi **tidak pernah dibaca oleh kode apapun** — tidak ada validasi di backend maupun di frontend.

**Changes:**

1. **`orders.service.js` — fungsi baru `_getMaxItemsPerOrder()`**:
   ```js
   function _getMaxItemsPerOrder() {
     try {
       const cfg = JSON.parse(fs.readFileSync(_SYSTEM_CONFIG_PATH, 'utf8'));
       const val = parseInt(cfg.max_items_per_order, 10);
       return (Number.isFinite(val) && val > 0) ? val : 20;
     } catch { return 20; }
   }
   ```

2. **`orders.service.js` — validasi di 3 titik**:

   | Fungsi | Validasi |
   |---|---|
   | `createOrder()` | Hitung total qty semua items → throw 422 jika > limit |
   | `createOrderByCashier()` | Sama seperti `createOrder()` |
   | `addItemToTransaction()` | Query `SUM(quantity)` dari DB → throw 422 jika `current + addition > limit` |

   Pesan error: `"Maksimal X item per order. Total saat ini: Y item."`

3. **`app.js` — expose ke `/config/public`**:
   ```js
   max_items_per_order: parseInt(config.max_items_per_order, 10) || 20,
   ```

4. **`CartPage.jsx` — validasi UX**:
   - Hitung `totalQty = items.reduce((sum, i) => sum + i.quantity, 0)`
   - Jika `totalQty > maxItemsPerOrder`: tampilkan banner merah + counter "X / 20 item (Melebihi batas)"
   - Tombol "Checkout" di-`disabled` jika over limit
   - Backend tetap menjadi garis pertahanan terakhir

**Catatan penting — definisi "item":**  
Yang dihitung adalah **total quantity** (jumlah unit/pcs) dari semua line item, bukan jumlah baris produk berbeda. Jika limit = 20 dan customer beli 3 produk masing-masing 7 unit (total 21), order ditolak.

---

### CR-029 — Sistem Voucher Diskon End-to-End (SOS × Odoo 18)
**Files:**
- `backend/migrations/010_voucher_tables.sql` *(new)*
- `backend/src/modules/vouchers/vouchers.service.js` *(new)*
- `backend/src/modules/vouchers/vouchers.routes.js` *(new)*
- `frontend/src/api/vouchers.js` *(new)*
- `frontend/src/components/cart/VoucherInput.jsx` *(new)*
- `backend/src/modules/orders/orders.service.js`
- `backend/src/modules/orders/orders.router.js`
- `backend/src/app.js`
- `integration/src/services/order.push.js`
- `integration/src/clients/odoo.client.js`
- `frontend/src/context/CartContext.jsx`
- `frontend/src/api/orders.js`
- `frontend/src/pages/customer/CartPage.jsx`
- `frontend/src/components/cashier/ThermalReceipt.jsx`
- `frontend/src/pages/customer/ReceiptPickupPage.jsx`
- `backend/src/modules/print/print.service.js`

**Type:** Feature — Voucher Discount System  
**Date:** 2026-06-04  
**Author:** clavis Development

**Background:**  
Tidak ada mekanisme diskon berbasis kode voucher di SOS. Admin tidak bisa membuat kampanye potongan harga untuk event, dan tidak ada jejak diskon di Odoo SO atau receipt.

**Changes:**

#### 1. Database — Migration `010_voucher_tables.sql`

Tabel baru dan extend `transactions`:

```sql
-- Tabel vouchers (master data kode diskon)
vouchers (
  code VARCHAR(50) UNIQUE,
  discount_type VARCHAR(10)   -- 'PERCENT' | 'FIXED'
  discount_value NUMERIC,     -- persen atau nominal IDR
  min_purchase NUMERIC,
  max_discount NUMERIC,       -- cap nominal untuk PERCENT
  usage_limit INTEGER,        -- NULL = unlimited
  usage_count INTEGER,
  valid_from / valid_until TIMESTAMPTZ,
  is_active BOOLEAN,
  tenant_id VARCHAR(10)       -- NULL = berlaku semua tenant
)

-- Tabel voucher_usages (histori pemakaian, idempotency guard)
voucher_usages (
  voucher_code → vouchers(code),
  transaction_id VARCHAR(30),
  customer_id UUID → customers(customer_id) ON DELETE SET NULL,
  discount_amount NUMERIC,
  UNIQUE (voucher_code, transaction_id)
)

-- Extend transactions
ALTER TABLE transactions
  ADD COLUMN voucher_code VARCHAR(50) → vouchers(code),
  ADD COLUMN discount_amount NUMERIC DEFAULT 0;
```

#### 2. Backend — Modul Vouchers Baru

**`vouchers.service.js`:**

- `validateVoucher({ code, customerId, cartTotal, tenantIds })` — 7 validasi berurutan: aktif, waktu, usage limit, min purchase, tenant scope, duplikasi customer, hitung `discount_amount`
- `applyVoucher({ code, transactionId, customerId, discountAmount, client })` — idempotent insert ke `voucher_usages`, increment `usage_count`, update `transactions`; mendukung shared DB client untuk atomic operation
- CRUD admin: `listVouchers`, `getVoucherByCode`, `createVoucher`, `updateVoucher`, `deactivateVoucher`

**`vouchers.routes.js`:**

| Endpoint | Auth | Fungsi |
|---|---|---|
| `POST /api/v1/vouchers/validate` | CUSTOMER / CASHIER / LEADER | Validasi kode voucher |
| `POST /api/v1/vouchers/apply` | ADMIN | Record pemakaian voucher (internal) |
| `GET /api/v1/admin/vouchers` | ADMIN | List semua voucher |
| `POST /api/v1/admin/vouchers` | ADMIN | Buat voucher baru |
| `PATCH /api/v1/admin/vouchers/:code` | ADMIN | Update voucher |
| `DELETE /api/v1/admin/vouchers/:code` | ADMIN | Soft delete (is_active=false) |

#### 3. Backend — Extend `orders.service.js`

**Formula yang benar (perbaikan kritis dari spec awal):**
```js
// Discount diterapkan pre-tax; PPN dihitung ulang dari taxable amount
const taxableAmount = subtotalAmount - discountAmount;
const taxAmount     = Math.round(taxableAmount * TAX_RATE / 100);
const totalAmount   = taxableAmount + taxAmount;
```

`createOrder(customerId, items, voucherCode = null)` dan `createOrderByCashier(cashierId, items, voucherCode = null)`:
1. Validate voucher → `discountAmount` (sebelum INSERT)
2. INSERT transactions dengan `voucher_code` dan `discount_amount` bersama nilai `tax_amount`/`total_amount` yang sudah dihitung ulang
3. `applyVoucher()` dipanggil **dalam DB transaction yang sama** — jika gagal (race condition), rollback seluruh order

Walk-in Customer (POS Langsung) skip duplicate-customer check di `validateVoucher`.

#### 4. Integration — Extend `order.push.js`

**Helper `_calcLineDiscount(txn, item)`:**

```js
// PERCENT: uniform % ke semua baris
if (discountType === 'PERCENT') return discountValue;

// FIXED: distribusi proporsional per baris
const rawPercent = (discountAmount / subtotalAmount) * 100;
return Math.min(parseFloat(rawPercent.toFixed(4)), 100);
```

Field `discount` ditulis ke setiap `sale.order.line`. Field `x_voucher_code` ditulis ke `sale.order` header jika tersedia di Odoo (`cache.hasVoucherCodeField`).

Audit log ORDER_PUSH diperluas dengan `voucher_code` dan `discount_amount`.

Warning (bukan block) jika total SOS vs Odoo berbeda > Rp 1.

**`odoo.client.js`:** Deteksi `x_voucher_code` field di startup refs → set `cache.hasVoucherCodeField`.

#### 5. Frontend — VoucherInput + CartContext + CartPage

**`VoucherInput.jsx` (komponen baru):**
- Input kode + tombol "Pakai" → `POST /api/v1/vouchers/validate`
- State: `idle | loading | valid | invalid`
- Valid: chip hijau "Voucher KODE — hemat Rp X" + tombol ×
- Error: pesan spesifik per kode error (VOUCHER_NOT_FOUND, VOUCHER_EXPIRED, dll.)

**`CartContext.jsx`:**
- State baru: `appliedVoucher`, `discountAmount`
- Fungsi baru: `applyVoucher(voucherData)`, `removeVoucher()`
- `clearCart()` sekarang juga clear voucher state

**`CartPage.jsx` — ringkasan harga baru:**
```
Subtotal:          Rp xxx.xxx   (pre-tax)
Diskon (KODE):   − Rp xxx.xxx   (hanya tampil jika ada voucher)
PPN 11%:           Rp xxx.xxx   (dihitung dari taxable = subtotal - diskon)
Total:             Rp xxx.xxx
```

`createOrder(items, voucherCode)` dikirim ke backend saat checkout.

#### 6. Receipt — Update Tiga Jalur Rendering

Semua tiga jalur receipt kini menampilkan baris diskon jika `discount_amount > 0`:

| File | Perubahan |
|---|---|
| `ThermalReceipt.jsx` | Baris "Diskon (KODE) − Rp X" sebelum TOTAL, warna hijau |
| `ReceiptPickupPage.jsx` | Baris "Diskon (KODE) − Rp X" sebelum TOTAL, class `text-green-600` |
| `print.service.js` | Baris "Diskon (KODE) -Rp X" dalam ESC/POS output sebelum TOTAL |

**Odoo Setup (wajib sebelum production — dilakukan manual):**
1. Settings → Sales → Pricing → centang "Discounts" (mengaktifkan `sale.order.line.discount`)
2. Buat field `x_voucher_code` (Char 50) di `sale.order` via Odoo Shell atau UI
3. Lihat `docs/voucher-implementation-prompts.md` Prompt E untuk panduan lengkap

---

---

### CR-030 — Fix Voucher Tenant-Scoped: Diskon Harus Terbatas pada Item Tenant yang Dibatasi
**Files:**
- `backend/src/modules/vouchers/vouchers.service.js`
- `backend/src/modules/vouchers/vouchers.routes.js`
- `backend/src/modules/orders/orders.service.js`
- `integration/src/services/order.push.js`
- `frontend/src/components/cart/VoucherInput.jsx`
- `frontend/src/pages/customer/CartPage.jsx`

**Type:** Bug Fix — CR-029  
**Date:** 2026-06-04  
**Triggered by:** BUG-016 (TXN-20260604-00024 — voucher AMZ50% untuk T001 menerapkan diskon global)

**Root cause:** Lihat BUG-016 di RESOLUTION.md.

**Changes:**

1. **`vouchers.service.js`** — `validateVoucher` menerima parameter baru `items: [{price, quantity, tenant_id}]`. Ketika voucher memiliki `tenant_id`, base kalkulasi diskon diubah dari `cartTotal` menjadi `tenantScopedSubtotal` (subtotal item dari tenant yang dibatasi). Return menambahkan `voucher_tenant_id`.

   ```js
   // SEBELUM (salah):
   const raw = cartTotal * (discount_value / 100);  // seluruh cart

   // SESUDAH (benar):
   const tenantScopedSubtotal = items
     .filter(i => allowedTenants.includes(i.tenant_id))
     .reduce((s, i) => s + i.price * i.quantity, 0);
   const raw = tenantScopedSubtotal * (discount_value / 100);  // tenant scope only
   ```

2. **`vouchers.routes.js`** — `POST /api/v1/vouchers/validate` menerima field opsional `items` di request body.

3. **`orders.service.js`** — `createOrder` dan `createOrderByCashier` pass `resolvedItems` dengan `price` dan `tenant_id` ke `validateVoucher`. `getTransaction` ditambah `LEFT JOIN vouchers` untuk expose `voucher_tenant_id` di API response.

4. **`order.push.js`** — `_calcLineDiscount(txn, item, allItems)`:

   ```js
   // Item dari tenant lain → tidak dapat diskon
   if (voucherTenantId && !allowedTenants.includes(item.tenant_id)) return 0.0;

   // FIXED: distribusi hanya dalam eligible items (bukan semua item)
   const eligibleSubtotal = eligibleItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
   ```

5. **`VoucherInput.jsx`** — Menerima prop `items` dan menyertakannya dalam body API call.

6. **`CartPage.jsx`** — Pass `items` dari CartContext ke `VoucherInput`.

**Odoo Integration — Tidak Terdampak:**  
Payment voucher chain (CR-015/CR-016) tidak berubah. Perubahan hanya pada nilai `discount` per baris yang kini 0% untuk baris dari tenant yang tidak dibatasi. `action_confirm`, invoicing, dan payment tetap berjalan normal.

---

## Database Changes

| Type | Description | Applied |
|---|---|---|
| Data correction | Odoo user uid=10 granted access to company 5 (AMAZING TOYS); default company set to 5 | Yes — via Odoo RPC |
| Data correction | All 56 SOS products restored to `stock_quantity=20` | Yes — direct SQL on `sos_postgres` |
| Data correction | 26 `integration_xref` entries restored from `CANCELLED` → `ACTIVE` via push-product-sync re-run | Yes — via API |
| Data correction | Odoo `stock.rule` id=55 `location_src_id` corrected from `False` → `Partners/Vendors` (id=4) | Yes — via Odoo RPC |
| Data correction | `property_stock_customer` set to `Partners/Customers` (id=5) for partner 707 (Yasmin Salsabila) in company 5 context | Yes — via Odoo RPC |
| Data correction | Orders S00028, S00029 (wrong company 1) cancelled in Odoo | Yes — via Odoo RPC wizard |
| Data correction | `integration_xref` entries for TXN-20260527-00002, TXN-20260527-00003, TXN-20260526-00001 deleted and re-created under company 5 | Yes — direct SQL + polling |
| Data result | TXN-20260527-00002 → Odoo S00030 (AMAZING TOYS, confirmed, locked) | ✓ |
| Data result | TXN-20260527-00003 → Odoo S00032 (AMAZING TOYS, confirmed, locked) | ✓ |
| Data result | TXN-20260526-00001 → Odoo S00033 (AMAZING TOYS, confirmed, locked) | ✓ |

| Schema migration | `009_payment_voucher_xref.sql` — tambah kolom `odoo_invoice_id`, `odoo_payment_id`, `voucher_status`, `voucher_synced_at` + index ke tabel `integration_xref` | Yes — applied 2026-05-28 |
| Schema migration | `010_voucher_tables.sql` — buat tabel `vouchers`, `voucher_usages`; tambah kolom `voucher_code`, `discount_amount` ke `transactions` + 5 index | Yes — applied 2026-06-04 |
| Data correction | 4 `integration_xref` entries migrated: `sync_metadata.manualConfirmRequired = true` → `confirmFailed = true` for TXN-20260519-00010, TXN-20260519-00013, TXN-20260520-00022, TXN-20260506-00007 | Yes — direct SQL 2026-05-29 |
| Data result | TXN-20260520-00022 → SO confirmed, invoice INV-250 created & paid (payment id=47) | ✓ 2026-05-29 |
| Data result | TXN-20260519-00013 → SO confirmed, invoice INV-251 created & paid (payment id=48) | ✓ 2026-05-29 |
| Data result | TXN-20260519-00010 → SO confirmed, invoice INV-252 created & paid (payment id=49) | ✓ 2026-05-29 |
| Data result | TXN-20260506-00007 → SO confirmed, invoice INV-253 created & paid (payment id=50) | ✓ 2026-05-29 |
| Data result | TXN-20260504-00004, TXN-20260506-00005, TXN-20260506-00006 → `voucher_status = FAILED` (Odoo SO ids 62/83/84 not found — require manual re-sync) | ✓ 2026-05-29 |

---

## Deployment Notes

### CR-001 s/d CR-028 (previous cycles)
All code changes were hot-deployed to the running Docker containers via `docker cp` and a container restart. No image rebuild was required for this fix cycle.

```
docker cp integration/src/... sos_integration:/app/src/...
docker cp backend/src/...     sos_backend:/app/src/...
docker cp frontend/dist/...   sos_frontend:/usr/share/nginx/html/...
docker restart sos_integration
```

### CR-029 (2026-06-04)

Migration dijalankan langsung ke container PostgreSQL:
```bash
docker cp backend/migrations/010_voucher_tables.sql sos_postgres:/tmp/
docker exec sos_postgres psql -U postgres -d amazing_toys_sos -f /tmp/010_voucher_tables.sql
```

Backend dan integration hot-deployed via file copy individual:
```bash
docker cp backend/src/app.js                                      sos_backend:/app/src/app.js
docker cp backend/src/modules/vouchers/                           sos_backend:/app/src/modules/vouchers/
docker cp backend/src/modules/orders/orders.service.js            sos_backend:/app/src/modules/orders/
docker cp backend/src/modules/orders/orders.router.js             sos_backend:/app/src/modules/orders/
docker cp backend/src/modules/print/print.service.js              sos_backend:/app/src/modules/print/
docker cp integration/src/services/order.push.js                  sos_integration:/app/src/services/
docker cp integration/src/clients/odoo.client.js                  sos_integration:/app/src/clients/
docker restart sos_backend sos_integration
```

Frontend direbuild karena perubahan source React (bukan hot-swap):
```bash
docker compose build frontend
docker compose up -d frontend
```

For a full rebuild and permanent persistence of all changes:
```bash
docker compose build --no-cache
docker compose up -d
```

**Pending (manual, dilakukan di Odoo sebelum production):**
1. Aktifkan Discounts: Settings → Sales → Pricing → centang "Discounts"
2. Buat field `x_voucher_code` (Char 50) di `sale.order` via Odoo Shell
3. Panduan lengkap: `docs/voucher-implementation-prompts.md` → Prompt E

