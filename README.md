# Amazing Toys Fair 2026 — Self-Order System (SOS)

**Version:** 1.1 | **Status:** Development
**Event:** Amazing Toys Fair 2026 — Exhibition Mall

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     AMAZING TOYS SOS — Architecture                │
│                    (Modular Monolith + REST + WebSocket)            │
└────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐
  │   Customer   │  │   Cashier    │  │    Tenant    │  │   Leader   │
  │  PWA/Mobile  │  │  Web POS     │  │  Web Portal  │  │ Dashboard  │
  │  (Tablet /   │  │  (Desktop)   │  │  (Tablet)    │  │ (Desktop)  │
  │   Kiosk)     │  │              │  │              │  │            │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘
         │                 │                 │                 │
         └─────────────────┴─────────────────┴─────────────────┘
                                     │
                        ┌────────────▼───────────────┐
                        │   HTTPS REST API  +  WSS   │
                        │   Express.js  (Port 3000)  │
                        │                            │
                        │  ┌──────────────────────┐  │
                        │  │  Modules             │  │
                        │  │  ├─ auth             │  │
                        │  │  ├─ products         │  │
                        │  │  ├─ tenants          │  │
                        │  │  ├─ orders           │  │
                        │  │  ├─ payments         │  │
                        │  │  ├─ cashier          │  │
                        │  │  ├─ tenant-orders    │  │
                        │  │  ├─ leader           │  │
                        │  │  └─ notifications    │  │
                        │  └──────────────────────┘  │
                        └────────────┬───────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
   ┌──────────▼──────────┐  ┌────────▼────────┐  ┌─────────▼──────────┐
   │   PostgreSQL DB     │  │  WebSocket      │  │  External Services │
   │   Port 3452         │  │  (ws://...)     │  │  ├─ Payment GW     │
   │                     │  │  Real-time:     │  │  │  (QRIS/EDC)      │
   │  Tables:            │  │  ├─ PAID alert  │  │  ├─ FCM Push       │
   │  ├─ customers       │  │  ├─ pickup done │  │  └─ Thermal Print  │
   │  ├─ tenants         │  │  └─ status sync │  └────────────────────┘
   │  ├─ products        │  └─────────────────┘
   │  ├─ transactions    │
   │  ├─ txn_items       │
   │  ├─ users           │
   │  ├─ return_requests │
   │  ├─ audit_log       │
   │  ├─ notifications   │
   │  └─ cashier_sessions│
   └─────────────────────┘
```

---

## ERD (Entity Relationship Diagram)

```
CUSTOMERS ──────────────────────────────────┐
│ PK customer_id (UUID)                     │
│    full_name                              │
│    phone_number (UNIQUE)                  │
│    email, gender, registered_at           │
└──────────────┬────────────────────────────┘
               │ 1:N
               ▼
TRANSACTIONS ─────────────────────────────────────────────────────┐
│ PK transaction_id (TXN-YYYYMMDD-NNNNN)                            │
│ FK customer_id → CUSTOMERS                                        │
│ FK cashier_id  → USERS                                            │
│    status: PENDING | PAID | CANCELLED | EXPIRED                   │
│    total_amount, payment_method, payment_reference                │
│    cash_received, cash_change, qr_payload                         │
│    expires_at, created_at, paid_at, cancelled_at                  │
└──────────────┬────────────────────────────────────────────────────┘
               │ 1:N
               ▼
TRANSACTION_ITEMS ─────────────────────────────────────────────────┐
│ PK item_id (UUID)                                                 │
│ FK transaction_id → TRANSACTIONS                                  │
│ FK product_id     → PRODUCTS                                      │
│ FK tenant_id      → TENANTS                                       │
│    quantity, unit_price, subtotal                                 │
│    pickup_status: READY | DONE                                    │
│    handed_over_at, handed_over_by                                 │
└───────────────────────────────────────────────────────────────────┘

TENANTS ────────────────────────────────────┐
│ PK tenant_id (T001, T002 …)              │
│    tenant_name, booth_location            │
│    floor_label (UG/GF/2F)                │
│    contact_name, contact_phone            │
│    notification_device_token (FCM)        │
│    revenue_share_pct, bank_account        │
│    is_active, created_at                  │
└──────────────┬────────────────────────────┘
               │ 1:N
               ▼
PRODUCTS ──────────────────────────────────────────────────────────┐
│ PK product_id (P001-T001 …)                                       │
│ FK tenant_id → TENANTS                                            │
│    product_name, category, price                                  │
│    barcode (UNIQUE), stock_quantity                               │
│    stock_status: AVAILABLE | LOW_STOCK | OUT_OF_STOCK             │
│    image_url, description, is_active                              │
│    created_at, updated_at                                         │
└───────────────────────────────────────────────────────────────────┘

USERS ──────────────────────────────────────┐
│ PK user_id (UUID)                         │
│    username (UNIQUE), password_hash        │
│    role: CASHIER | TENANT | LEADER | ADMIN│
│ FK tenant_id → TENANTS (nullable)         │
│    display_name, is_active                │
└───────────────────────────────────────────┘

RETURN_REQUESTS ─────────────────────────────
│ PK request_id (UUID)
│ FK transaction_id → TRANSACTIONS
│ FK requested_by   → USERS
│ FK processed_by   → USERS (nullable)
│    reason, status: PENDING|APPROVED|REJECTED
│    rejection_note, created_at, processed_at

AUDIT_LOG ───────────────────────────────────
│ PK log_id (BIGSERIAL)
│    action, actor_id, actor_role
│    entity_type, entity_id
│    old_value (JSONB), new_value (JSONB)
│    ip_address, created_at
```

---

## Workflow

```
CUSTOMER FLOW
─────────────
[C1] Register ──► [C2] Browse Tenants ──► [C2T] Gallery ──► [C4] Product Detail
                  [C3] Search (manual / barcode)                    │
                                                                    │ Add to Cart
                                                              [C5] Cart & Checkout
                                                                    │
                                                              [C6] QR Code (PENDING)
                                                                    │
                                            ┌───────────────────────┘
                                            │ Cashier scans QR
CASHIER FLOW                                ▼
────────────  [K1] Scan QR ──► [K2] Review Order ──► [K3] Payment ──► [K4] Success
                                                             │                │
                                                       Print receipt     Notify Tenant
                                                             │
                                                   Status → PAID (WebSocket)
                                                             │
CUSTOMER RECEIVES                                           ▼
                                                  [C7] Confirmed ──► [C8] Digital Receipt
                                                                            │
                                                                    [C9] Pickup Status

TENANT FLOW
───────────
  [T1] Orders (PAID, READY) ──► [T2] Handover (scan/input TXN) ──► Status → DONE
  [T4] Dashboard (own sales)

LEADER FLOW
───────────
  [L1] Live Dashboard KPI ──► [L2] Sales Report ──► [L4] By Tenant
  [L3] Return Approvals ──► Approve/Reject ──► Stock restored (if approved)
  [L5] Payment Method Breakdown ──► [L6] Visitors ──► [L7] Cashier Activity
```

---

## Quick Start

### 1. Prerequisites
- Node.js 20+
- Docker Desktop
- PostgreSQL client (optional)

### 2. Start Database
```bash
# Using Docker (recommended)
docker-compose up -d postgres

# OR connect to existing PostgreSQL on port 3452
# Then run: psql -h localhost -p 3452 -U postgres -d amazing_toys_sos -f database/schema.sql
#           psql -h localhost -p 3452 -U postgres -d amazing_toys_sos -f database/seed.sql
```

### 3. Configure Backend
```bash
cd backend
cp .env.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET
npm install
npm run dev        # starts on http://localhost:3000
```

### 4. Run Tests
```bash
cd backend
npm test                    # all 60 unit tests
npm run test:coverage       # with coverage report
```

### 5. Using Docker Compose (full stack)
```bash
cp backend/.env.example .env
docker-compose up -d
# API: http://localhost:3000
# Health: http://localhost:3000/health
# pgAdmin: docker-compose --profile tools up -d  → http://localhost:5050
```

---

## Project Structure

```
sos apps/
├── backend/
│   ├── src/
│   │   ├── app.js                          # Express + HTTP + WebSocket entry
│   │   ├── config/
│   │   │   ├── database.js                 # pg Pool + helpers
│   │   │   └── logger.js                   # Winston logger
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js           # JWT authenticate + authorize
│   │   │   ├── error.middleware.js          # Global error handler + AppError
│   │   │   └── validate.middleware.js       # express-validator collector
│   │   ├── modules/
│   │   │   ├── auth/                       # Register, Login (Customer + Internal)
│   │   │   ├── products/                   # Catalog, browse, barcode lookup
│   │   │   ├── tenants/                    # Tenant list, tenant portal
│   │   │   ├── orders/                     # Checkout, cart management, TXN
│   │   │   ├── payments/                   # Cashier payment processing
│   │   │   ├── cashier/                    # Daily recap, session tracking
│   │   │   ├── leader/                     # KPI, reports, return approvals
│   │   │   └── notifications/              # Push + WebSocket broadcasts
│   │   ├── utils/
│   │   │   ├── txnId.js                    # TXN-YYYYMMDD-NNNNN generator
│   │   │   ├── qrcode.js                   # QR code PNG generator
│   │   │   └── auditLog.js                 # Immutable audit trail writer
│   │   └── ws/
│   │       └── websocket.js                # WS server + tenant/customer broadcast
│   ├── tests/
│   │   └── unit/
│   │       ├── auth.test.js                # UT-001 to UT-006
│   │       ├── products.test.js            # UT-007 to UT-015
│   │       ├── orders.test.js              # UT-016 to UT-025
│   │       ├── cashier.test.js             # UT-026 to UT-040
│   │       └── tenant.test.js              # UT-041 to UT-060
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
├── database/
│   ├── schema.sql                          # Full PostgreSQL schema + triggers
│   └── seed.sql                            # Sample tenants, products, users
├── docs/
│   └── api.md                              # Full REST API documentation
├── docker-compose.yml
└── README.md                               # This file
```

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Architecture | **Modular Monolith** | Simpler than microservices for single-event deployment; easy to debug during high-traffic exhibition |
| Backend | **Node.js 20 + Express 4** | Fast I/O, large ecosystem, WebSocket-friendly |
| Database | **PostgreSQL 16** (port 3452) | ACID compliance, JSONB audit log, row-level locking for stock |
| Real-time | **ws (WebSocket)** | Lightweight, no broker required; push PAID status to customers & tenants |
| Auth | **JWT (jsonwebtoken)** | Stateless, role-encoded; supports offline kiosk scenarios |
| Validation | **express-validator** | Declarative input validation per FSD requirements |
| Testing | **Jest + Supertest** | 60 test cases matching Unit_Test_AmazingToys.docx |
| Container | **Docker + Docker Compose** | Reproducible dev/prod environment |

---

## Actors & Access Matrix

| Feature | Customer | Tenant | Cashier | Leader |
|---|:---:|:---:|:---:|:---:|
| Register / Login | ✓ | ✓ | ✓ | ✓ |
| Browse & Search Products | ✓ | View | View | ✓ |
| Add to Cart & Checkout | ✓ | — | — | — |
| Process Payment | — | — | ✓ | — |
| View Own Orders | ✓ | Booth only | Processed | All |
| Tenant Handover/Pickup | — | ✓ (own booth) | — | — |
| Sales Dashboard | — | Own booth | Own txns | All |
| Approve Return | Request only | — | Request only | ✓ |
| Manage Master Data | — | — | — | ✓ |
| Export Reports | — | — | — | ✓ |

---

## Non-Functional Requirements

| Requirement | Target |
|---|---|
| Product list load | < 3 seconds |
| Transaction lookup (scan) | < 2 seconds |
| Status update (PENDING → PAID) | < 5 seconds via WebSocket |
| Concurrent users | ≥ 500 simultaneous (exhibition peak) |
| Data integrity | All transactions in DB transactions (ACID) |
| Security | JWT auth, role-based access, rate limiting, Helmet headers |
| Audit trail | 100% of state-changing actions logged to `audit_log` |

---

## Environment Variables Reference

See `backend/.env.example` for full list. Key variables:

| Variable | Description |
|---|---|
| `DB_HOST` | PostgreSQL host (default: localhost) |
| `DB_PORT` | PostgreSQL port (default: 3452) |
| `DB_NAME` | Database name: `amazing_toys_sos` |
| `JWT_SECRET` | Minimum 64-char random string |
| `TXN_PENDING_TIMEOUT_MINUTES` | Transaction expiry (default: 30) |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging for push notifications |
