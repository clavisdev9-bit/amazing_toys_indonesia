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

No schema migrations required.

---

## Deployment Notes

All code changes were hot-deployed to the running Docker containers via `docker cp` and a container restart. No image rebuild was required for this fix cycle.

```
docker cp integration/src/... sos_integration:/app/src/...
docker cp backend/src/...     sos_backend:/app/src/...
docker cp frontend/dist/...   sos_frontend:/usr/share/nginx/html/...
docker restart sos_integration
```

For a full rebuild and permanent persistence of these changes, rebuild the images from the updated source:
```
docker compose build --no-cache
docker compose up -d
```
