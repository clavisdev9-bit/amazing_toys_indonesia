# Amazing Toys SOS — REST API Documentation
**Base URL:** `http://localhost:3000/api/v1`
**Auth:** Bearer JWT in `Authorization` header
**Content-Type:** `application/json`

---

## Authentication

### POST `/auth/register`
Customer self-registration.
**Auth required:** No

**Request:**
```json
{
  "full_name": "Budi Santoso",
  "phone_number": "08123456789",
  "email": "budi@email.com",
  "gender": "MALE"
}
```
**Response 201:**
```json
{
  "success": true,
  "message": "Registrasi berhasil.",
  "data": {
    "token": "<jwt>",
    "customer": { "customer_id": "uuid", "full_name": "Budi Santoso", "phone_number": "08123456789" }
  }
}
```
**Errors:** `409` phone already registered | `422` validation failed

---

### POST `/auth/login/customer`
Customer login via phone number.
**Auth required:** No

**Request:** `{ "phone_number": "08123456789" }`
**Response 200:** `{ "success": true, "data": { "token": "...", "customer": {...} } }`
**Errors:** `404` account not found

---

### POST `/auth/login`
Internal user login (Cashier / Tenant / Leader).
**Auth required:** No

**Request:** `{ "username": "kasir01", "password": "password123" }`
**Response 200:** `{ "success": true, "data": { "token": "...", "user": { "role": "CASHIER", ... } } }`
**Errors:** `401` invalid credentials

---

## Products

### GET `/products`
Browse product catalog. Supports filtering and search.
**Auth required:** Yes (all roles)

**Query params:**
| Param | Type | Description |
|---|---|---|
| `tenant_id` | string | Filter by tenant |
| `category` | string | Filter by category |
| `search` | string | Full-text search on name/description |
| `in_stock_only` | boolean | Show only available products |
| `page` | integer | Default: 1 |
| `limit` | integer | Default: 20, max: 50 |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "product_id": "P001-T001",
        "product_name": "LEGO City 60350 Moon Base",
        "category": "Lego",
        "price": 350000,
        "stock_quantity": 15,
        "stock_status": "AVAILABLE",
        "image_url": null,
        "tenant_id": "T001",
        "tenant_name": "ToysWorld",
        "booth_location": "Hall A, Stand A1",
        "floor_label": "GF"
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

---

### GET `/products/categories`
List all product categories.
**Response 200:** `{ "success": true, "data": ["Action Figure", "Board Games", "Diecast", ...] }`

---

### GET `/products/barcode/:barcode`
Look up product by barcode (scan feature).
**Auth required:** Yes

**Response 200:** Single product object (same shape as above)
**Errors:** `404` product not found → `"Produk tidak ditemukan, silakan cari manual."`

---

### GET `/products/:productId`
Get product detail.
**Response 200:** Single product with full description and stock info.

---

### POST `/products`
Create product. **Leader/Admin only.**

**Request:**
```json
{
  "product_id": "P016-T001",
  "product_name": "LEGO Star Wars",
  "category": "Lego",
  "price": 420000,
  "tenant_id": "T001",
  "barcode": "8999999001300",
  "stock_quantity": 10
}
```
**Response 201:** Created product object.

---

### PATCH `/products/:productId`
Update product fields. **Leader/Admin only.**
Supports: `product_name`, `category`, `price`, `stock_quantity`, `image_url`, `description`, `is_active`.

---

## Tenants

### GET `/tenants`
List tenants, grouped optionally by floor.

**Query params:** `floor` (UG/GF/2F) | `search` | `active_only` (default true)

**Response 200:** Array of tenants with `product_count`.

---

### GET `/tenants/:tenantId`
Tenant detail with product count.

---

### GET `/tenants/:tenantId/products`
All active products for a tenant.

---

### POST `/tenants`
Create tenant. **Leader/Admin only.**

---

### PATCH `/tenants/:tenantId`
Update tenant. **Leader/Admin** or **own TENANT**.

---

## Orders

### POST `/orders`
Customer checkout — creates a PENDING transaction.
**Auth required:** CUSTOMER

**Request:**
```json
{
  "items": [
    { "product_id": "P001-T001", "quantity": 1 },
    { "product_id": "P005-T002", "quantity": 2 }
  ]
}
```
**Response 201:**
```json
{
  "success": true,
  "message": "Pesanan berhasil dibuat.",
  "data": {
    "transactionId": "TXN-20260415-00001",
    "totalAmount": 710000,
    "expiresAt": "2026-04-15T10:30:00.000Z",
    "qrPayload": "data:image/png;base64,...",
    "status": "PENDING"
  }
}
```
**Errors:** `400` out-of-stock item | `400` empty cart

---

### GET `/orders/my`
Customer's own order history.
**Auth required:** CUSTOMER

---

### GET `/orders/:transactionId`
Full transaction detail including items, pickup status, cashier info.
**Auth required:** Any authenticated role (customers see own only)

---

### DELETE `/orders/:transactionId`
Customer cancels their own PENDING order. Restores stock.
**Auth required:** CUSTOMER

---

## Payments

### GET `/payments/lookup/:transactionId`
Cashier looks up a PENDING transaction before processing payment.
**Auth required:** CASHIER / LEADER / ADMIN

**Response 200:** Transaction with customer info and line items.
**Errors:** `404` not found | `409` already PAID | `410` expired

---

### POST `/payments/process`
Cashier processes payment. Triggers tenant push notifications.
**Auth required:** CASHIER / LEADER / ADMIN

**Request:**
```json
{
  "transaction_id": "TXN-20260415-00001",
  "payment_method": "CASH",
  "cash_received": 800000,
  "payment_ref": null
}
```
*For QRIS/EDC:*
```json
{
  "transaction_id": "TXN-20260415-00002",
  "payment_method": "QRIS",
  "payment_ref": "QRIS-REF-123456"
}
```
**Response 200:**
```json
{
  "success": true,
  "message": "Pembayaran berhasil.",
  "data": {
    "transactionId": "TXN-20260415-00001",
    "status": "PAID",
    "paymentMethod": "CASH",
    "cashChange": 250000,
    "paidAt": "2026-04-15T10:05:00.000Z"
  }
}
```

---

## Cashier

### GET `/cashier/recap`
Cashier's daily session recap.
**Auth required:** CASHIER / LEADER / ADMIN

**Query:** `date` (YYYY-MM-DD, default today) | `cashier_id` (Leader only)

**Response 200:**
```json
{
  "data": {
    "cashier_name": "Kasir Satu",
    "shift_date": "2026-04-15",
    "txn_count": 42,
    "total_cash": 5200000,
    "total_qris": 3100000,
    "total_edc": 1800000,
    "total_transfer": 0,
    "grand_total": 10100000
  }
}
```

---

### GET `/cashier/transactions`
Transactions processed by cashier today.
**Query:** `date` | `cashier_id`

---

## Tenant Orders

### GET `/tenant-orders`
Tenant views paid orders for their booth (READY items first).
**Auth required:** TENANT

---

### POST `/tenant-orders/handover`
Tenant validates pickup and marks items as DONE.
**Auth required:** TENANT

**Request:** `{ "transaction_id": "TXN-20260415-00001" }`
**Response 200:** `{ "success": true, "message": "Handover selesai. Status item diperbarui ke DONE." }`

---

### GET `/tenant-orders/dashboard`
Tenant's sales dashboard for today.
**Query:** `date`

---

## Leader

### GET `/leader/dashboard`
Live KPI dashboard — revenue, transaction counts, top tenants.
**Auth required:** LEADER / ADMIN
**Query:** `date` (default today)

**Response 200:**
```json
{
  "data": {
    "date": "2026-04-15",
    "summary": {
      "total_revenue": "85200000",
      "paid_count": "312",
      "pending_count": "5",
      "cancelled_count": "8"
    },
    "paymentBreakdown": [
      { "payment_method": "CASH", "count": "120", "amount": "32000000" },
      { "payment_method": "QRIS", "count": "150", "amount": "41200000" },
      { "payment_method": "EDC",  "count": "42",  "amount": "12000000" }
    ],
    "uniqueVisitors": "245",
    "topTenants": [...]
  }
}
```

---

### GET `/leader/sales`
Detailed sales report.
**Query:** `start_date` | `end_date` | `tenant_id`

---

### GET `/leader/visitors`
Visitor registrations breakdown by date and gender.
**Query:** `start_date` | `end_date`

---

### GET `/leader/returns`
List return/cancellation requests.
**Query:** `status` (PENDING | APPROVED | REJECTED)

---

### POST `/leader/returns`
Create a return request (Cashier or Leader).
**Request:** `{ "transaction_id": "TXN-...", "reason": "Barang rusak" }`

---

### PATCH `/leader/returns/:requestId`
Approve or reject a return request. **Leader only.**
**Request:** `{ "approved": true }` or `{ "approved": false, "rejection_note": "..." }`

---

## Notifications

### GET `/notifications`
Tenant's unread notifications.
**Auth required:** TENANT

---

### POST `/notifications/read`
Mark all notifications as read.
**Auth required:** TENANT

---

## WebSocket Events

**URL:** `ws://localhost:3000/ws`

**Authentication (send after connect):**
```json
{ "type": "AUTH", "token": "<jwt>" }
```

**Events received by clients:**

| Event | Audience | Payload |
|---|---|---|
| `AUTH_OK` | All | `{ "event": "AUTH_OK", "role": "TENANT" }` |
| `ORDER_PAID` | Tenant | `{ "event": "ORDER_PAID", "transactionId": "TXN-...", "message": "Pesanan baru PAID..." }` |
| `PICKUP_DONE` | Customer | `{ "event": "PICKUP_DONE", "transactionId": "TXN-...", "tenantId": "T001" }` |

---

## Error Response Format

All errors follow this format:
```json
{
  "success": false,
  "message": "Human-readable error message.",
  "errors": [
    { "field": "phone_number", "message": "Format nomor telepon tidak valid." }
  ]
}
```

**HTTP Status Codes:**
| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Business Logic Error |
| 401 | Unauthenticated |
| 403 | Forbidden (wrong role) |
| 404 | Not Found |
| 409 | Conflict (already processed) |
| 410 | Gone (expired) |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Internal Server Error |
