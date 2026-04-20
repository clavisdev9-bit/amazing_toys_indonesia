# Odoo 18 Integration — Developer Guide

**Document ID:** FSD-AMZTOYS-2026-001-DEV  
**Scope:** Amazing Toys Fair 2026 — SOS ↔ Odoo 18 Integration Service  
**Service Port:** `4000`  
**Last Updated:** April 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [Odoo 18 Setup (Admin Tasks)](#5-odoo-18-setup-admin-tasks)
6. [Installation & Startup](#6-installation--startup)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [How Each Sync Flow Works](#8-how-each-sync-flow-works)
   - [8.1 Authentication](#81-authentication)
   - [8.2 Product Sync (Odoo → SOS)](#82-product-sync-odoo--sos)
   - [8.3 Customer Sync (SOS → Odoo)](#83-customer-sync-sos--odoo)
   - [8.4 Order Push (SOS PAID → Odoo)](#84-order-push-sos-paid--odoo)
   - [8.5 Cancellation Sync](#85-cancellation-sync)
   - [8.6 Stock Sync (Odoo → SOS)](#86-stock-sync-odoo--sos)
9. [Data Field Mappings](#9-data-field-mappings)
10. [Webhook Events Reference](#10-webhook-events-reference)
11. [Retry & Error Handling](#11-retry--error-handling)
12. [Circuit Breaker](#12-circuit-breaker)
13. [xref Store (Cross-Reference)](#13-xref-store-cross-reference)
14. [Audit Log](#14-audit-log)
15. [API Endpoints](#15-api-endpoints)
16. [Scheduler Schedule](#16-scheduler-schedule)
17. [Acceptance Testing Checklist](#17-acceptance-testing-checklist)
18. [Troubleshooting](#18-troubleshooting)
19. [Glossary](#19-glossary)

---

## 1. Overview

The **Integration Service** is a standalone Node.js middleware that sits between:

- **SOS API** (`http://localhost:3000/api/v1`) — Amazing Toys event POS system
- **Odoo 18** (`http://localhost:8069`) — Company ERP system

Without this service, cashiers must manually re-enter every SOS transaction into Odoo at end of day — 3–5 hours of error-prone data entry per event day.

### What it does

| Direction | Flow | Trigger |
|---|---|---|
| Odoo → SOS | Product catalogue sync (name, price, stock, barcode) | Every 30 min / manual |
| SOS → Odoo | Customer partner create/update | Webhook on registration |
| SOS → Odoo | Confirmed `sale.order` from PAID transaction | Webhook on payment |
| SOS → Odoo | Cancel Odoo draft order on CANCELLED/EXPIRED | Webhook + sweep every 5 min |
| Odoo → SOS | Stock level update (`qty_available`) | Every 30 min |

### What it does NOT do (Phase 2)

- Create Odoo `account.payment` entries
- Sync SOS return requests to Odoo credit notes
- Push Odoo-created customers back to SOS
- Real-time stock reservation bridging

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ODOO 18 (ERP)                        │
│              JSON-RPC 2.0  ·  Port 8069                     │
└──────────────────────────┬──────────────────────────────────┘
                           │  search_read / create / write /
                           │  action_confirm / action_cancel
                           │
              ┌────────────▼────────────────────┐
              │      INTEGRATION SERVICE         │
              │       Node.js  ·  Port 4000      │
              │                                  │
              │  ┌──────────┐  ┌──────────────┐ │
              │  │ Scheduler│  │Webhook Router│ │
              │  │ (cron)   │  │  /webhook/*  │ │
              │  └────┬─────┘  └──────┬───────┘ │
              │       │               │         │
              │  ┌────▼───────────────▼───────┐ │
              │  │    Sync Services            │ │
              │  │  product · customer · order │ │
              │  │  cancel  · stock            │ │
              │  └────────────────────────────┘ │
              │                                  │
              │  ┌──────────┐  ┌──────────────┐ │
              │  │xref Store│  │ Audit Logger  │ │
              │  │ (Postgres)│  │ (async queue) │ │
              │  └──────────┘  └──────────────┘ │
              │                                  │
              │  ┌──────────┐  ┌──────────────┐ │
              │  │  Retry   │  │   Circuit    │ │
              │  │  Queue   │  │   Breaker    │ │
              │  └──────────┘  └──────────────┘ │
              └────────────┬────────────────────┘
                           │  REST API  ·  Bearer JWT
                           │  POST /products, PATCH /products/:id
                           │  GET /orders/:id, GET /cashier/transactions
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    SOS API (POS)                             │
│            REST/JSON  ·  Port 3000                          │
│                                                             │
│  Fires webhooks (fire-and-forget HTTP POST):                │
│    ORDER_PAID          → /webhook/order-paid                │
│    ORDER_CANCELLED     → /webhook/order-cancelled           │
│    CUSTOMER_REGISTERED → /webhook/customer-registered       │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│           PostgreSQL 16  ·  Port 3452  (shared DB)          │
│   Tables added by integration:                              │
│     integration_xref  ·  integration_audit                  │
│     integration_dead_letter                                  │
└─────────────────────────────────────────────────────────────┘
```

### Request flow: customer pays → Odoo order created

```
Customer pays in SOS app
        │
        ▼
POST /payments/process   (SOS cashier endpoint)
        │
        ▼
payments.service.js
  → Updates transaction status = PAID
  → Fires webhook (fire-and-forget)
        │
        ▼
POST http://localhost:4000/webhook/order-paid
  { transactionId, status, totalAmount, paidAt, customerId }
        │
        ▼
Integration: webhook.router.js
  → Validates X-SOS-Signature (HMAC-SHA256)
  → Returns HTTP 200 immediately (async processing)
        │
        ▼ (async)
order.push.js::pushOrder(transactionId)
  1. Check xref — idempotency guard
  2. GET /orders/:transactionId  (SOS full txn detail)
  3. resolveOrCreatePartner()   (Odoo res.partner lookup chain)
  4. resolveOdooProduct()       (barcode → Odoo product_id per line)
  5. odoo.create('sale.order', {...})
  6. odoo.execute('sale.order', 'action_confirm', [orderId])
  7. Write xref: transactionId → odooOrderId
  8. Write audit log entry
        │
        ▼
Odoo sale.order created, state = 'sale' (confirmed)
```

---

## 3. Project Structure

```
integration/
├── .env.example                  ← Copy to .env and fill values
├── package.json
├── migrations/
│   ├── 001_integration_tables.sql  ← DB schema for xref/audit tables
│   └── run.js                      ← Migration runner (node migrations/run.js)
└── src/
    ├── app.js                    ← Express server entry point + boot sequence
    ├── config/
    │   ├── env.js                ← All env vars parsed & exported
    │   ├── database.js           ← pg Pool for xref/audit DB
    │   └── logger.js             ← Winston logger
    ├── clients/
    │   ├── sos.client.js         ← SOS REST API client (JWT auth, auto-refresh)
    │   └── odoo.client.js        ← Odoo JSON-RPC client (session cookie auth)
    ├── services/
    │   ├── product.sync.js       ← FR-002: Odoo → SOS product catalogue
    │   ├── customer.sync.js      ← FR-003: SOS customer → Odoo res.partner
    │   ├── order.push.js         ← FR-004/005: SOS PAID txn → Odoo sale.order
    │   ├── cancel.sync.js        ← FR-006: Cancel Odoo draft + expiry sweep
    │   └── stock.sync.js         ← FR-007: Odoo qty_available → SOS stock
    ├── queue/
    │   └── retry.queue.js        ← In-memory retry queue with exponential backoff
    ├── utils/
    │   ├── xref.js               ← Cross-reference store CRUD
    │   ├── audit.js              ← Async audit log writer
    │   └── circuit.breaker.js   ← Per-system circuit breaker
    ├── middleware/
    │   └── webhook.auth.js       ← X-SOS-Signature HMAC validation
    ├── routes/
    │   ├── webhook.router.js     ← POST /webhook/* endpoints
    │   └── health.router.js      ← GET /health
    └── scheduler/
        └── scheduler.js          ← Cron jobs + polling fallback
```

**SOS Backend additions:**

```
backend/src/utils/webhook.js         ← Fire-and-forget HMAC-signed HTTP POST
backend/src/modules/payments/payments.service.js  ← fires ORDER_PAID
backend/src/modules/orders/orders.service.js      ← fires ORDER_CANCELLED
backend/src/modules/auth/auth.service.js          ← fires CUSTOMER_REGISTERED
```

---

## 4. Prerequisites

### Software

| Requirement | Version | Notes |
|---|---|---|
| Node.js | >= 18 | Integration service runtime |
| PostgreSQL | 16 | Shared with SOS (port 3452) |
| Odoo | 18 Community or Enterprise | Port 8069 |
| SOS Backend | v1.1 | Must be running on port 3000 |

### Odoo 18 manual setup (one-time, done by Odoo Admin before go-live)

See [Section 5](#5-odoo-18-setup-admin-tasks) for step-by-step.

### Network

- Integration service must reach `localhost:3000` (SOS) and `localhost:8069` (Odoo)
- SOS backend must reach `localhost:4000` (integration webhook endpoint)

---

## 5. Odoo 18 Setup (Admin Tasks)

These steps must be completed in Odoo **before** starting the integration service.

### 5.1 Create Custom Fields on `sale.order`

Go to **Settings → Technical → Fields** (developer mode must be on):

| Field Name | Field Label | Type | Model |
|---|---|---|---|
| `x_sos_transaction_id` | SOS Transaction ID | Char (256) | `sale.order` |
| `x_sos_tenant_id` | SOS Tenant IDs | Char (256) | `sale.order` |

**Via Odoo Settings UI:**
1. Enable developer mode: `Settings → General Settings → Activate Developer Mode`
2. Go to `Settings → Technical → Database Structure → Fields`
3. Click **Create**, fill in the table above, save each field

**Via Odoo Shell (alternative):**
```python
# In Odoo shell: ./odoo-bin shell -d your_db
env['ir.model.fields'].create({
    'model_id': env['ir.model'].search([('model','=','sale.order')]).id,
    'name': 'x_sos_transaction_id',
    'field_description': 'SOS Transaction ID',
    'ttype': 'char',
    'size': 256,
})
env['ir.model.fields'].create({
    'model_id': env['ir.model'].search([('model','=','sale.order')]).id,
    'name': 'x_sos_tenant_id',
    'field_description': 'SOS Tenant IDs',
    'ttype': 'char',
    'size': 256,
})
env.cr.commit()
```

### 5.2 Create Payment Journals

Go to **Accounting → Configuration → Journals**:

| Journal Name | Type | Notes |
|---|---|---|
| `QRIS` | Bank | For QRIS (QR code) payments |
| `EDC` | Bank | For EDC (card) payments |
| `Cash` | Cash | Usually exists by default |

> **Important:** The integration resolves journal IDs at startup by name. Names must match **exactly** (case-insensitive): `QRIS`, `EDC`, `Cash`.

### 5.3 Activate IDR Currency

Go to **Accounting → Configuration → Currencies**:
- Ensure **Indonesian Rupiah (IDR)** is active (green toggle)
- Set IDR as the default currency for the Sales module if not already set

### 5.4 Create Walk-in Customer Partner

Go to **Contacts → Create**:

| Field | Value |
|---|---|
| Name | `Walk-in Customer` |
| Customer Rank | 1 (tick "Is a Customer") |
| Leave all other fields blank | |

After saving, note the **ID** from the URL bar (e.g., `https://localhost:8069/web#id=7&model=res.partner` → ID is `7`).

Set this in `integration/.env`:
```
ODOO_WALKIN_PARTNER_ID=7
```

### 5.5 Create Integration User (optional but recommended)

Instead of using the `admin` account, create a dedicated Odoo user for the integration:

1. Go to **Settings → Users → Create**
2. Name: `SOS Integration`
3. Role: **Sales / User** at minimum (needs `sale.order` create/confirm/cancel rights)
4. Set a strong password and record it for `ODOO_PASSWORD` env var

### 5.6 Ensure All Event Products Have Barcodes

Run this SQL or use Odoo list view to verify:
```sql
-- In Odoo PostgreSQL DB
SELECT id, name, barcode FROM product_product WHERE active = true AND sale_ok = true AND (barcode IS NULL OR barcode = '');
```
Products without barcodes **cannot be synced**. Add EAN-13 barcodes to all products before the event.

### 5.7 Create SOS Admin User in SOS

In the SOS system, create a dedicated admin user for the integration:
```
Username: integration_admin
Role: ADMIN
Password: (set a strong password)
```

Set these in `integration/.env`:
```
SOS_ADMIN_USERNAME=integration_admin
SOS_ADMIN_PASSWORD=your_strong_password
```

---

## 6. Installation & Startup

### Step 1 — Run DB Migration

The integration adds 3 tables to the existing SOS PostgreSQL database.

```bash
cd "C:\Dev\sos apps\integration"

# Copy and fill environment file
copy .env.example .env
# Edit .env with your values (see Section 7)

# Run migration (requires XREF_DB_URL in .env)
npm run migrate
```

Expected output:
```
Migration applied successfully.
```

Verify in PostgreSQL:
```sql
\c amazing_toys_sos
\dt integration_*
-- Should show: integration_xref, integration_audit, integration_dead_letter
```

### Step 2 — Configure Environment

Edit `integration/.env`. Minimum required values:

```env
SOS_ADMIN_USERNAME=integration_admin
SOS_ADMIN_PASSWORD=your_sos_password

ODOO_BASE_URL=http://localhost:8069
ODOO_DB=odoo18
ODOO_LOGIN=admin
ODOO_PASSWORD=your_odoo_password

ODOO_WALKIN_PARTNER_ID=7

WEBHOOK_SECRET=generate_a_32_char_random_secret_here

XREF_DB_URL=postgresql://postgres:your_db_pass@localhost:3452/amazing_toys_sos
```

Also update `backend/.env`:
```env
INTEGRATION_WEBHOOK_URL=http://localhost:4000
WEBHOOK_SECRET=same_32_char_random_secret_as_above
```

> **Security:** `WEBHOOK_SECRET` must be the **same value** in both files. Generate with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### Step 3 — Install Dependencies

```bash
cd "C:\Dev\sos apps\integration"
npm install
```

### Step 4 — Start the Integration Service

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

Expected startup output:
```
info: SOS: authenticating
info: SOS: authenticated
info: Odoo: authenticating uid=1
info: Odoo startup refs resolved { currencyIdIdr: 4, journals: ['CASH','QRIS','EDC'] }
info: Scheduler started { productSyncMin: 30, stockSyncMin: 30, sweepMin: 5, pollingSec: 60 }
info: Integration service listening on port 4000
```

### Step 5 — Verify Health

```bash
curl http://localhost:4000/health
```

Expected:
```json
{
  "service": "sos-odoo-integration",
  "version": "1.0.0",
  "db": "OK",
  "circuitBreakers": {
    "sos": { "state": "CLOSED", "failures": 0 },
    "odoo": { "state": "CLOSED", "failures": 0 }
  },
  "retryQueueDepth": 0,
  "lastSyncTimes": { "product": null, "stock": null, "sweep": null }
}
```

### Step 6 — Trigger First Product Sync

The scheduler fires automatically on interval. To trigger immediately without waiting 30 minutes, restart the service — the first sync runs within 1 minute of startup as the scheduler fires. Alternatively, watch the logs for the first scheduled sync.

---

## 7. Environment Variables Reference

### Integration Service (`integration/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `4000` | Integration service HTTP port |
| `NODE_ENV` | No | `development` | `production` disables verbose logging |
| `LOG_LEVEL` | No | `info` | `error` / `warn` / `info` / `debug` |
| `SOS_BASE_URL` | No | `http://localhost:3000/api/v1` | SOS API base URL |
| `SOS_ADMIN_USERNAME` | **Yes** | — | SOS ADMIN user for integration |
| `SOS_ADMIN_PASSWORD` | **Yes** | — | SOS ADMIN password |
| `ODOO_BASE_URL` | No | `http://localhost:8069` | Odoo server URL |
| `ODOO_DB` | **Yes** | — | Odoo database name |
| `ODOO_LOGIN` | **Yes** | — | Odoo login username |
| `ODOO_PASSWORD` | **Yes** | — | Odoo login password |
| `ODOO_WALKIN_PARTNER_ID` | **Yes** | — | Integer ID of Walk-in Customer `res.partner` |
| `WEBHOOK_SECRET` | **Yes** | — | HMAC secret for `X-SOS-Signature` validation |
| `XREF_DB_URL` | **Yes** | — | PostgreSQL connection string for xref/audit tables |
| `LOW_STOCK_THRESHOLD` | No | `10` | Units at or below this → `LOW_STOCK` |
| `PRODUCT_SYNC_INTERVAL_MIN` | No | `30` | Product catalogue sync frequency (minutes) |
| `STOCK_SYNC_INTERVAL_MIN` | No | `30` | Stock-only sync frequency (minutes) |
| `SWEEP_INTERVAL_MIN` | No | `5` | Expired transaction sweep frequency (minutes) |
| `POLLING_INTERVAL_SEC` | No | `60` | ORDER_PAID polling fallback interval (seconds) |
| `RETRY_MAX_ATTEMPTS` | No | `3` | Max retry attempts before dead-letter |
| `CIRCUIT_BREAKER_THRESHOLD` | No | `5` | Consecutive failures before breaker opens |
| `CIRCUIT_BREAKER_RESET_MIN` | No | `2` | Minutes before half-open probe attempt |
| `TENANT_PRODUCT_MAPPING` | No | `{}` | JSON: `{"OdooCatName": "T001", ...}` |
| `DEFAULT_TENANT_ID` | No | `T001` | Fallback SOS tenant for unmapped Odoo products |

### SOS Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `INTEGRATION_WEBHOOK_URL` | **Yes** (for integration) | Base URL of integration service, e.g. `http://localhost:4000` |
| `WEBHOOK_SECRET` | **Yes** (for integration) | Same value as integration `WEBHOOK_SECRET` |

> **If `INTEGRATION_WEBHOOK_URL` is empty**, the SOS backend silently skips all webhook calls — the SOS system works normally without the integration service. This means you can run SOS without the integration in development.

---

## 8. How Each Sync Flow Works

### 8.1 Authentication

**File:** [`src/clients/sos.client.js`](../integration/src/clients/sos.client.js), [`src/clients/odoo.client.js`](../integration/src/clients/odoo.client.js)

**SOS:** Uses `POST /auth/login` with `username`/`password` → receives a JWT valid for 8 hours. The JWT is stored in memory. On any `401` response, the client invalidates the cached token and re-authenticates **once** before retrying the original request.

**Odoo:** Uses `POST /web/session/authenticate` with `{db, login, password}` → receives a `session_id` cookie. The cookie is stored in memory and sent as `Cookie: session_id=<value>` on every subsequent JSON-RPC call. On Odoo session expiry error in the response body (not HTTP status — Odoo always returns HTTP 200), the client re-authenticates once.

**Startup:** Both systems are authenticated before the HTTP server starts listening. If authentication fails after 3 attempts, the process exits with code 1.

---

### 8.2 Product Sync (Odoo → SOS)

**File:** [`src/services/product.sync.js`](../integration/src/services/product.sync.js)  
**Trigger:** Cron every `PRODUCT_SYNC_INTERVAL_MIN` minutes  
**FSD Reference:** FR-002

```
1. Fetch all active saleable products from Odoo
   model: product.product
   domain: [['active','=',True], ['sale_ok','=',True]]
   fields: id, name, barcode, list_price, categ_id, qty_available

2. For each product:
   a. Skip if no barcode → log warning, audit SKIP

   b. GET /products/barcode/:barcode  (SOS lookup)
      → 404 Not Found: CREATE new SOS product
          POST /products {product_name, category, price, stock_quantity, barcode, tenant_id}
          tenant_id resolved from TENANT_PRODUCT_MAPPING by Odoo categ_id.name
      → 200 OK: compare price & stock_quantity
          - Changed: PATCH /products/:productId {price, stock_quantity, stock_status}
          - Unchanged: log SKIP (no unnecessary API call)

3. Update integration_xref (odoo product_id → sos_product_id)

4. Log sync summary: processed / created / updated / skipped / failed
```

**Stock status rule:**

| Odoo `qty_available` | SOS `stock_status` |
|---|---|
| `<= 0` | `OUT_OF_STOCK` |
| `1` to `LOW_STOCK_THRESHOLD` (default 10) | `LOW_STOCK` |
| `> LOW_STOCK_THRESHOLD` | `AVAILABLE` |

**Tenant mapping (`TENANT_PRODUCT_MAPPING`):**

```env
# .env example: Odoo category names mapped to SOS tenant IDs
TENANT_PRODUCT_MAPPING={"Hasbro":"T001","Lego":"T002","Mattel":"T003"}
```

If an Odoo product's category name contains `"Hasbro"` (case-insensitive), it is assigned to SOS tenant `T001`. Unmatched categories use `DEFAULT_TENANT_ID`.

---

### 8.3 Customer Sync (SOS → Odoo)

**File:** [`src/services/customer.sync.js`](../integration/src/services/customer.sync.js)  
**Trigger:** Webhook `POST /webhook/customer-registered` OR called inline during order push  
**FSD Reference:** FR-003

**Three-step lookup chain:**

```
Step 1: Search Odoo res.partner WHERE ref = SOS customer_id (UUID)
        → Found: UPDATE name, email → return partner_id

Step 2: Search Odoo res.partner WHERE phone = SOS phone_number
        → Found: WRITE ref = customer_id, UPDATE name, email → return partner_id

Step 3: Not found anywhere → CREATE new res.partner
        → name, phone, mobile, email, customer_rank=1, ref=customer_id, comment=gender
        → return new partner_id

Validation: phone_number must match /^08[0-9]{8,11}$/
            (Indonesian mobile format — e.g. 0812345678901)
            Reject and use walk-in fallback if invalid.
```

**Walk-in fallback:** If all three steps fail (Odoo unreachable, validation failure, etc.), returns `ODOO_WALKIN_PARTNER_ID`. This ensures order creation is **never blocked** by customer sync failures.

---

### 8.4 Order Push (SOS PAID → Odoo)

**File:** [`src/services/order.push.js`](../integration/src/services/order.push.js)  
**Trigger:** Webhook `POST /webhook/order-paid` OR polling fallback (every 60s)  
**FSD Reference:** FR-004, FR-005

```
1. Validate transactionId format: /^TXN-[0-9]{8}-[0-9]{5}$/

2. Idempotency check (CRITICAL — prevents duplicate Odoo orders):
   a. Check integration_xref: transactionId already mapped? → discard
   b. Search Odoo sale.order WHERE x_sos_transaction_id = transactionId → discard

3. Fetch full transaction: GET /orders/:transactionId
   Returns: customer info, items[], payment_method, paid_at, cashier_name

4. Resolve Odoo partner_id (call customer.sync.js lookup chain)

5. Resolve Odoo product_id for each order line:
   Primary:  search product.product WHERE barcode = SOS barcode
   Fallback: search product.product WHERE name ilike SOS product_name
   BLOCK if ANY product unresolved → do NOT create partial orders

6. Build sale.order payload:
   - partner_id: (resolved)
   - date_order: paid_at (UTC, formatted as 'YYYY-MM-DD HH:MM:SS')
   - order_line: [[0,0,{product_id, qty, price_unit, name, tax_id:[]}], ...]
   - x_sos_transaction_id: transactionId
   - x_sos_tenant_id: "T001,T002" (comma-joined unique tenants)
   - note: "Payment Method: CASH | Ref: - | Cash Received: Rp 50000 | ..."

7. odoo.create('sale.order', payload) → gets odooOrderId

8. odoo.execute('sale.order', 'action_confirm', [odooOrderId])
   → Transitions state: draft → sale (confirmed)
   → If action_confirm fails: log CRITICAL, DO NOT retry (manual resolution)

9. Write xref: transactionId → odooOrderId
10. Write audit log: ORDER_PUSH SUCCESS
```

**Price rule (BR-003):** `price_unit` on the Odoo order line uses `unit_price` from SOS (the price **at time of purchase**), NOT the current Odoo `list_price`. This ensures the Odoo total matches the SOS transaction total exactly.

---

### 8.5 Cancellation Sync

**File:** [`src/services/cancel.sync.js`](../integration/src/services/cancel.sync.js)  
**Triggers:**
- Webhook `POST /webhook/order-cancelled` (immediate, customer-cancelled)
- Cron sweep every `SWEEP_INTERVAL_MIN` minutes (catches EXPIRED transactions)

**FSD Reference:** FR-006

```
1. Look up integration_xref: transactionId → odooOrderId
   → Not found: log info (normal — transaction expired before being pushed). Exit.

2. Fetch Odoo order: search_read sale.order WHERE id = odooOrderId, fields: ['state']

3. State-based action:
   - state = 'draft'  → action_cancel([odooOrderId]) ✓
   - state = 'cancel' → already cancelled, log info. No action.
   - state = 'sale'   → log CRITICAL, alert operations. DO NOT auto-cancel.

4. Update xref status → CANCELLED
5. Write audit log
```

**Expiry sweep logic:**

```javascript
// Every SWEEP_INTERVAL_MIN minutes:
GET /cashier/transactions?status=EXPIRED&limit=200
→ For each EXPIRED transaction:
    if xref exists AND xref.status !== 'CANCELLED':
        cancelOrder(transactionId)
```

---

### 8.6 Stock Sync (Odoo → SOS)

**File:** [`src/services/stock.sync.js`](../integration/src/services/stock.sync.js)  
**Trigger:** Cron every `STOCK_SYNC_INTERVAL_MIN` minutes (runs alongside product sync)  
**FSD Reference:** FR-007

```
1. Load all product rows from integration_xref (entity_type = 'product', status = 'ACTIVE')

2. Batch fetch Odoo qty_available:
   search_read product.product WHERE id IN [list of odoo product IDs]
   → Uses batch query (NOT per-product — avoids N+1 API calls)

3. For each product:
   - Compare Odoo qty_available vs last_stock_qty (stored in xref sync_metadata)
   - SKIP if unchanged (no unnecessary SOS API call)
   - PATCH /products/:sosProductId {stock_quantity, stock_status}

4. Update sync_metadata: last_stock_qty = newQty
5. Write audit log per product updated
```

**Important caveat:** SOS decrements stock when a customer adds items to a PENDING order. Odoo is only updated **post-payment**. During peak ordering, there will be a ~30 minute window where Odoo stock is higher than SOS stock. This is **by design** per FSD (BR-008, OS-08).

---

## 9. Data Field Mappings

### Product: Odoo `product.product` → SOS `products`

| Odoo Field | SOS Field | Transformation |
|---|---|---|
| `name` | `product_name` | Direct |
| `barcode` | `barcode` | Direct. Null → skip product |
| `list_price` (float) | `price` (integer) | `Math.round(list_price)` |
| `qty_available` (float) | `stock_quantity` (integer) | `Math.max(0, Math.floor(qty_available))` |
| `categ_id[1]` (category name) | `category` | Direct |
| Derived from `qty_available` | `stock_status` | See stock status rule above |
| `TENANT_PRODUCT_MAPPING[categ_id.name]` | `tenant_id` | Config-based lookup |

### Customer: SOS `customers` → Odoo `res.partner`

| SOS Field | Odoo Field | Notes |
|---|---|---|
| `customer_id` (UUID) | `ref` | Deduplication anchor (primary) |
| `full_name` | `name` | |
| `phone_number` | `phone`, `mobile` | Deduplication anchor (secondary) |
| `email` | `email` | Nullable |
| `gender` | `comment` | Stored as "Gender: Male" |
| Hardcoded | `customer_rank` | Set to `1` |

### Order: SOS `transactions` → Odoo `sale.order`

| SOS Field | Odoo Field | Notes |
|---|---|---|
| Resolved by customer lookup | `partner_id` | Integer |
| `paid_at` | `date_order` | UTC, `'YYYY-MM-DD HH:MM:SS'` format |
| `transaction_id` | `x_sos_transaction_id` | Custom field |
| Unique tenant_ids joined | `x_sos_tenant_id` | Custom field, e.g. `"T001,T002"` |
| Payment details | `note` | See FR-005 format |

### Order Line: SOS `transaction_items` → Odoo `sale.order.line`

| SOS Field | Odoo Field | Notes |
|---|---|---|
| Resolved by barcode | `product_id` | Integer |
| `quantity` | `product_uom_qty` | Cast to float |
| `unit_price` | `price_unit` | **Historical price — NOT current Odoo price** |
| `product_name` | `name` | |
| Hardcoded | `discount` | `0.0` |
| Hardcoded | `tax_id` | `[]` (no taxes for MVP) |

---

## 10. Webhook Events Reference

### Security

Every webhook call from SOS includes an `X-SOS-Signature` header:
```
X-SOS-Signature: sha256=<hmac-hex>
```

The HMAC is computed over the **raw request body bytes** using `WEBHOOK_SECRET` as the key with SHA-256.

The integration verifies this using `crypto.timingSafeEqual()` to prevent timing attacks.

> **Dev mode:** If `WEBHOOK_SECRET` is empty, signature validation is **skipped**. Never deploy to production without a secret.

### `POST /webhook/order-paid`

Fired by: `backend/src/modules/payments/payments.service.js::processPayment()`

```json
{
  "transactionId": "TXN-20260415-00001",
  "status": "PAID",
  "totalAmount": 450000,
  "paidAt": "2026-04-15T10:30:00.000Z",
  "customerId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Integration response: `HTTP 200 { "received": true }` (immediate, async processing)

### `POST /webhook/order-cancelled`

Fired by: `backend/src/modules/orders/orders.service.js::cancelOrder()`

```json
{
  "transactionId": "TXN-20260415-00002",
  "status": "CANCELLED",
  "cancelledAt": "2026-04-15T10:45:00.000Z",
  "customerId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `POST /webhook/customer-registered`

Fired by: `backend/src/modules/auth/auth.service.js::registerCustomer()`

```json
{
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "full_name": "Budi Santoso",
  "phone_number": "08123456789",
  "email": "budi@example.com",
  "gender": "Male"
}
```

### Testing Webhooks Manually

```bash
# Generate signature (replace SECRET with your WEBHOOK_SECRET)
BODY='{"transactionId":"TXN-20260415-00001","status":"PAID","totalAmount":450000,"paidAt":"2026-04-15T10:30:00.000Z","customerId":"550e8400-e29b-41d4-a716-446655440000"}'
SECRET="your_webhook_secret"
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')

curl -X POST http://localhost:4000/webhook/order-paid \
  -H "Content-Type: application/json" \
  -H "X-SOS-Signature: $SIG" \
  -d "$BODY"
```

---

## 11. Retry & Error Handling

**File:** [`src/queue/retry.queue.js`](../integration/src/queue/retry.queue.js)

### Retry Policy

| Attempt | When | Notes |
|---|---|---|
| 1 (original) | Immediate | |
| 2 | 60 seconds after failure | |
| 3 | 5 minutes after attempt 2 | |
| Dead-letter | After attempt 3 fails | Written to `integration_dead_letter` table |

### Error Categories

| Error | Retryable? | Behaviour |
|---|---|---|
| HTTP 5xx, network timeout | Yes | Add to retry queue |
| SOS JWT expiry (401) | Yes | Re-authenticate, then retry immediately |
| Odoo session expiry | Yes | Re-authenticate, then retry immediately |
| HTTP 404 (not found) | No | Log error, skip |
| HTTP 409 (duplicate) | No | Log warning, discard |
| HTTP 422 (validation) | No | Log error, skip |
| `action_confirm` failure | **Never** | Log CRITICAL, manual resolution only |
| Unresolved product in order | No | Block order, add to retry queue for re-attempt |

### Checking the Dead-Letter Queue

```sql
-- In PostgreSQL
SELECT id, operation_type, sos_entity_id, error_message, created_at
FROM integration_dead_letter
WHERE resolved_at IS NULL
ORDER BY created_at DESC;
```

To mark a dead-letter item as resolved after manual fix:
```sql
UPDATE integration_dead_letter
SET resolved_at = NOW(), resolved_by = 'your_name'
WHERE id = 123;
```

---

## 12. Circuit Breaker

**File:** [`src/utils/circuit.breaker.js`](../integration/src/utils/circuit.breaker.js)

Protects against cascading failures when either SOS or Odoo becomes temporarily unavailable.

### States

```
CLOSED ──────────────────────────── Normal operation
   │  (5 consecutive failures)
   ▼
OPEN ────────────────────────────── All requests blocked (2 minutes)
   │  (after 2 min, allow 1 probe)
   ▼
HALF-OPEN ───────────────────────── 1 probe request allowed
   │  probe succeeds → CLOSED
   │  probe fails → back to OPEN (reset 2-min timer)
```

### Configuration

```env
CIRCUIT_BREAKER_THRESHOLD=5    # Failures before OPEN
CIRCUIT_BREAKER_RESET_MIN=2    # Minutes before HALF-OPEN probe
```

### Checking Circuit Breaker State

```bash
curl http://localhost:4000/health
# See: "circuitBreakers": {"sos": {"state": "CLOSED"}, "odoo": {"state": "CLOSED"}}
```

---

## 13. xref Store (Cross-Reference)

**File:** [`src/utils/xref.js`](../integration/src/utils/xref.js)  
**Table:** `integration_xref`

Stores the mapping between SOS IDs and Odoo IDs for every synced entity. This is the **idempotency mechanism** — prevents duplicate Odoo records from retried webhooks.

### Schema

```sql
integration_xref (
  entity_type  VARCHAR(20),   -- 'product', 'customer', 'order'
  sos_id       VARCHAR(100),  -- SOS identifier (UUID, TXN-*, P001-T001)
  odoo_id      INTEGER,       -- Odoo record ID
  status       VARCHAR(20),   -- 'ACTIVE', 'CANCELLED', 'FAILED'
  sync_metadata JSONB,        -- Extra data (sos_product_id, barcode, last_stock_qty)
  UNIQUE (entity_type, sos_id)
)
```

### Querying xrefs

```sql
-- Find Odoo order for a SOS transaction
SELECT * FROM integration_xref WHERE entity_type = 'order' AND sos_id = 'TXN-20260415-00001';

-- Find all synced products
SELECT sos_id AS odoo_product_id, sync_metadata->>'sos_product_id' AS sos_product_id, sync_metadata->>'barcode' AS barcode
FROM integration_xref WHERE entity_type = 'product' AND status = 'ACTIVE';

-- Count total mapped entities
SELECT entity_type, status, COUNT(*) FROM integration_xref GROUP BY entity_type, status;
```

---

## 14. Audit Log

**File:** [`src/utils/audit.js`](../integration/src/utils/audit.js)  
**Table:** `integration_audit`

Every integration operation is recorded asynchronously (never blocks the main flow).

### Schema

```sql
integration_audit (
  operation_id    UUID,
  operation_type  VARCHAR(30),  -- PRODUCT_SYNC, ORDER_PUSH, CANCEL_SYNC, STOCK_SYNC, CUSTOMER_SYNC, AUTH
  entity_type     VARCHAR(20),  -- product, order, customer
  sos_entity_id   VARCHAR(100),
  odoo_entity_id  INTEGER,
  action          VARCHAR(20),  -- CREATE, UPDATE, SKIP, FAIL, RETRY, CANCEL
  status          VARCHAR(20),  -- SUCCESS, FAILED, RETRYING
  attempt_number  SMALLINT,
  duration_ms     INTEGER,
  error_message   TEXT,
  request_summary TEXT,         -- Truncated to 2000 chars
  response_summary TEXT,        -- Truncated to 500 chars
  created_at      TIMESTAMPTZ
)
```

### Useful Queries

```sql
-- All failed operations today
SELECT operation_type, sos_entity_id, error_message, created_at
FROM integration_audit
WHERE status = 'FAILED' AND created_at >= CURRENT_DATE
ORDER BY created_at DESC;

-- Order push history for a specific transaction
SELECT * FROM integration_audit
WHERE sos_entity_id = 'TXN-20260415-00001'
ORDER BY created_at;

-- Product sync summary for last cycle
SELECT action, COUNT(*) as count
FROM integration_audit
WHERE operation_type = 'PRODUCT_SYNC' AND created_at >= NOW() - INTERVAL '35 minutes'
GROUP BY action;

-- Audit log completeness check (AC-014)
SELECT operation_type, COUNT(*) FROM integration_audit
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY operation_type;
```

---

## 15. API Endpoints

The integration service exposes these HTTP endpoints on port 4000:

### `GET /health`

Returns service health status. Used for monitoring.

**Response 200:**
```json
{
  "service": "sos-odoo-integration",
  "version": "1.0.0",
  "startedAt": "2026-04-15T08:00:00.000Z",
  "uptime": 3600.5,
  "db": "OK",
  "circuitBreakers": {
    "sos": { "state": "CLOSED", "failures": 0 },
    "odoo": { "state": "CLOSED", "failures": 0 }
  },
  "retryQueueDepth": 0,
  "lastSyncTimes": {
    "product": "2026-04-15T08:30:00.000Z",
    "stock": "2026-04-15T08:30:00.000Z",
    "sweep": "2026-04-15T08:35:00.000Z"
  }
}
```

**Response 503:** Same body but `"db": "ERROR"` — PostgreSQL unreachable.

### `POST /webhook/order-paid`

See [Section 10](#10-webhook-events-reference).

### `POST /webhook/order-cancelled`

See [Section 10](#10-webhook-events-reference).

### `POST /webhook/customer-registered`

See [Section 10](#10-webhook-events-reference).

---

## 16. Scheduler Schedule

| Job | Interval | What it does |
|---|---|---|
| Product sync | Every `PRODUCT_SYNC_INTERVAL_MIN` min (default: 30) | Fetch Odoo products → create/update SOS |
| Stock sync | Every `STOCK_SYNC_INTERVAL_MIN` min (default: 30) | Fetch Odoo qty_available → update SOS stock |
| Expiry sweep | Every `SWEEP_INTERVAL_MIN` min (default: 5) | Query SOS EXPIRED txns → cancel Odoo draft orders |
| ORDER_PAID poll | Every `POLLING_INTERVAL_SEC` sec (default: 60) | Backup for missed webhooks — scan PAID txns not in xref |
| Retry queue | Every 30 seconds | Process due retry items from in-memory queue |

**Timeline during a typical event day:**

```
08:00  Service starts → authenticates SOS + Odoo → resolves startup refs
08:00  First product sync runs immediately in the scheduler cycle
08:30  Second product sync + first stock sync
08:35  First expiry sweep
09:00  Third product sync + second stock sync
...    (continues every 30 min for product/stock, every 5 min for sweep)
22:00  Event ends — service can be stopped
```

---

## 17. Acceptance Testing Checklist

Use this checklist before go-live to validate the integration against the FSD acceptance criteria.

### Auth (AC-001, AC-002)

- [ ] Start integration service with valid credentials → `GET /health` returns `auth_status=OK`
- [ ] Force SOS 401 (change password temporarily) → service re-authenticates, logs `TOKEN_REFRESH`

### Product Sync (AC-003, AC-004)

```bash
# Create product in Odoo with barcode, trigger sync (wait up to 30 min or restart service)
# Then verify:
curl http://localhost:3000/api/v1/products/barcode/YOUR_BARCODE \
  -H "Authorization: Bearer YOUR_SOS_JWT"
# Expected: product exists with matching price and stock_quantity
```

- [ ] New Odoo product with barcode appears in SOS within 30 minutes
- [ ] Price updated in Odoo → SOS price = `Math.round(odoo_price)` within 30 minutes

### Customer Sync (AC-005, AC-006)

```bash
# Register new customer in SOS
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test User","phone_number":"08123456789","gender":"Male"}'
# Wait ~5 seconds, then check Odoo: search res.partner WHERE phone='08123456789'
```

- [ ] New customer → Odoo `res.partner` created with `ref = SOS customer_id`
- [ ] Same phone number lookup → no duplicate partner created

### Order Push (AC-007, AC-008, AC-009)

```bash
# After a payment is processed in SOS, check Odoo:
# Settings → Sales → Orders → search x_sos_transaction_id = 'TXN-...'
# OR via Odoo shell:
# env['sale.order'].search_read([['x_sos_transaction_id','=','TXN-20260415-00001']], ['state','amount_total'])
```

- [ ] Single-tenant CASH payment → Odoo `sale.order` state=`sale`, `amount_total` matches SOS total
- [ ] Multi-tenant order → single Odoo order with all line items, `x_sos_tenant_id='T001,T002'`
- [ ] Duplicate `ORDER_PAID` webhook → exactly ONE Odoo order (check audit log for SKIP)

### Cancellation (AC-010, AC-011)

- [ ] Customer cancels PENDING order → Odoo draft order → `state='cancel'` within 5 minutes
- [ ] SOS order expires (30 min) → Odoo draft order cancelled by sweep within 5 minutes

### Error Handling (AC-012, AC-013)

```bash
# Test walk-in fallback:
# Temporarily set ODOO_WALKIN_PARTNER_ID to a non-existent ID → process payment
# Check audit log: entry should show WALKIN_FALLBACK warning
```

- [ ] SOS unreachable during order push → retries 3 times, eventually processes
- [ ] Partner creation fails → order created with walk-in partner, audit log shows fallback

### Audit Log (AC-014)

```sql
-- After 10 product syncs, 5 order pushes, 2 cancellations:
SELECT operation_type, COUNT(*) FROM integration_audit GROUP BY operation_type;
-- Should show counts for each operation type
```

- [ ] 100% of operations have audit log entry with `status`, `created_at`, entity IDs

### Stock Sync (AC-015)

- [ ] Process 5 SOS sales → wait 30 min → Odoo `qty_available` updated in SOS stock display

---

## 18. Troubleshooting

### "Odoo auth failed" on startup

**Cause:** Wrong `ODOO_DB`, `ODOO_LOGIN`, or `ODOO_PASSWORD`.

**Fix:** Verify by curling directly:
```bash
curl -s -X POST http://localhost:8069/web/session/authenticate \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"call","params":{"db":"YOUR_DB","login":"admin","password":"YOUR_PASS"}}' \
  | python -m json.tool
# Look for "uid" in result — if null, credentials are wrong
```

---

### "SOS: authenticating" loops on startup

**Cause:** `SOS_ADMIN_USERNAME` user doesn't exist or password wrong.

**Fix:** Create the user via SOS:
```bash
cd "C:\Dev\sos apps\backend"
node add-admin.js
# Or use the /api/v1/admin/users endpoint with existing ADMIN JWT
```

---

### Products not appearing in SOS after sync

**Cause:** Products in Odoo have no barcode (`barcode = null`).

**Check:**
```sql
-- In Odoo PostgreSQL DB
SELECT id, name, barcode FROM product_product WHERE active = true AND sale_ok = true AND barcode IS NULL;
```

**Fix:** Add EAN-13 barcodes to all products in Odoo before syncing.

---

### Odoo order NOT created after SOS payment

**Step 1:** Check integration service logs:
```
grep "ORDER_PUSH" integration.log
```

**Step 2:** Check audit log:
```sql
SELECT * FROM integration_audit WHERE operation_type = 'ORDER_PUSH' ORDER BY created_at DESC LIMIT 10;
```

**Step 3:** Check dead-letter queue:
```sql
SELECT * FROM integration_dead_letter WHERE operation_type = 'ORDER_PUSH' AND resolved_at IS NULL;
```

**Step 4:** Check retry queue depth via health endpoint:
```bash
curl http://localhost:4000/health | python -m json.tool
# Look for retryQueueDepth > 0
```

**Common causes:**

| Symptom | Cause | Fix |
|---|---|---|
| `Unresolved product: XYZ` in audit | Product has no Odoo barcode or name doesn't match | Add barcode to Odoo product matching SOS |
| `action_confirm failed` | Odoo `sale.order` validation error | Check Odoo server logs; manual confirm in Odoo |
| Circuit breaker OPEN | Odoo unreachable | Fix Odoo connection; breaker resets in 2 min |
| `x_sos_transaction_id field not found` | Custom field not created in Odoo | Complete Section 5.1 |

---

### Webhook signature validation failing (HTTP 401)

**Cause:** `WEBHOOK_SECRET` mismatch between SOS backend and integration service.

**Fix:** Ensure both `.env` files have **identical** `WEBHOOK_SECRET` values.

**To disable temporarily for testing:**
```env
# integration/.env
WEBHOOK_SECRET=
# backend/.env
WEBHOOK_SECRET=
```

> Never leave `WEBHOOK_SECRET` empty in production.

---

### `integration_xref` table not found

**Cause:** Migration not run.

**Fix:**
```bash
cd "C:\Dev\sos apps\integration"
npm run migrate
```

---

### Orders being pushed twice (duplicate Odoo orders)

**Cause:** xref not being written (DB issue) AND `x_sos_transaction_id` custom field missing in Odoo (so the secondary idempotency check also fails).

**Fix:**
1. Verify `integration_xref` table exists and is writable
2. Verify `x_sos_transaction_id` field exists on Odoo `sale.order` (Section 5.1)
3. Delete duplicate Odoo orders manually; resolve the root cause

---

### How to run a manual product sync now (without waiting 30 min)

Restart the integration service — the first cron tick fires within 1 minute of startup:
```bash
# Stop service (Ctrl+C) then:
npm start
```

Or call the product sync directly from Node:
```bash
cd "C:\Dev\sos apps\integration"
node -e "
require('dotenv').config();
const sync = require('./src/services/product.sync');
sync.syncProducts().then(() => process.exit(0)).catch(console.error);
"
```

---

## 19. Glossary

| Term | Definition |
|---|---|
| **SOS** | Self-Order System — Amazing Toys event POS (Node.js + PostgreSQL, port 3000) |
| **Odoo** | Odoo 18 ERP system (port 8069) |
| **Integration Service** | This Node.js middleware (port 4000) |
| **xref** | Cross-reference — table mapping SOS IDs ↔ Odoo IDs |
| **JWT** | JSON Web Token — SOS auth token, valid 8 hours |
| **session_id** | Odoo auth cookie, used in every JSON-RPC call |
| **JSON-RPC 2.0** | Protocol used by Odoo API. All requests `POST /web/dataset/call_kw` |
| **sale.order** | Odoo confirmed sales order (created from SOS PAID transaction) |
| **res.partner** | Odoo customer/contact record (created from SOS customer) |
| **product.product** | Odoo product variant (SKU), matched to SOS product by barcode |
| **x_sos_transaction_id** | Custom field on `sale.order` — stores SOS `TXN-YYYYMMDD-NNNNN` |
| **x_sos_tenant_id** | Custom field on `sale.order` — stores comma-joined tenant IDs |
| **walk-in partner** | Fallback Odoo `res.partner` when customer resolution fails |
| **dead-letter** | Persistent queue for operations that failed all 3 retry attempts |
| **circuit breaker** | Fault-tolerance pattern that pauses calls to a failing system |
| **IDR** | Indonesian Rupiah. SOS stores as integer; Odoo stores as float |
| **WIB** | Waktu Indonesia Barat (UTC+7) — event venue timezone |
| **PENDING** | SOS transaction: order placed, QR generated, payment not yet made |
| **PAID** | SOS transaction: payment processed → triggers Odoo order creation |
| **CANCELLED** | SOS transaction: customer cancelled before payment |
| **EXPIRED** | SOS transaction: not paid within 30 minutes → auto-expired |
| **FR-00X** | Functional Requirement ID from FSD-AMZTOYS-2026-001 |
| **AC-0XX** | Acceptance Criteria ID from FSD-AMZTOYS-2026-001 |
