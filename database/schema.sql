-- =============================================================================
-- AMAZING TOYS FAIR 2026 — Self-Order System
-- PostgreSQL Schema  |  Host: localhost  |  Port: 3452  |  DB: amazing_toys_sos
-- Version: 1.1  |  Date: April 2026
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE gender_enum         AS ENUM ('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY');
CREATE TYPE stock_status_enum   AS ENUM ('AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK');
CREATE TYPE txn_status_enum     AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED');
CREATE TYPE payment_method_enum AS ENUM ('CASH', 'QRIS', 'EDC', 'TRANSFER');
CREATE TYPE pickup_status_enum  AS ENUM ('READY', 'DONE');
CREATE TYPE user_role_enum      AS ENUM ('CASHIER', 'TENANT', 'LEADER', 'ADMIN');
CREATE TYPE return_status_enum  AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE actor_role_enum     AS ENUM ('CUSTOMER', 'CASHIER', 'TENANT', 'LEADER', 'SYSTEM');

-- =============================================================================
-- TABLE: customers
-- Stores visitor/customer accounts registered at the event kiosk or mobile app
-- =============================================================================
CREATE TABLE customers (
    customer_id     UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(150)    NOT NULL,
    phone_number    VARCHAR(20)     NOT NULL UNIQUE,   -- Indonesian format, uniqueness per event
    email           VARCHAR(150),
    gender          gender_enum     NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    registered_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customers_phone ON customers (phone_number);

-- =============================================================================
-- TABLE: tenants
-- Booth vendors participating in the event (100 booths max per FSD)
-- =============================================================================
CREATE TABLE tenants (
    tenant_id               VARCHAR(20)     PRIMARY KEY,              -- e.g. T001, T002
    tenant_name             VARCHAR(150)    NOT NULL,
    booth_location          VARCHAR(50)     NOT NULL,                  -- e.g. Hall A, Stand A1
    floor_label             VARCHAR(10),                               -- UG / GF / 2F
    contact_name            VARCHAR(100)    NOT NULL,
    contact_phone           VARCHAR(20)     NOT NULL,
    contact_email           VARCHAR(150),
    notification_device_token TEXT,                                    -- FCM push token
    revenue_share_pct       DECIMAL(5,2)    NOT NULL DEFAULT 100.00,  -- % share to tenant
    bank_account            VARCHAR(50),
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: products
-- Product catalog loaded before event opens; manageable by Leader during event
-- =============================================================================
CREATE TABLE products (
    product_id      VARCHAR(20)         PRIMARY KEY,              -- e.g. P001-T001
    product_name    VARCHAR(150)        NOT NULL,
    category        VARCHAR(80)         NOT NULL,                 -- Lego, Diecast, Boneka, etc.
    price           DECIMAL(12,2)       NOT NULL CHECK (price > 0),
    tenant_id       VARCHAR(20)         NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    barcode         VARCHAR(50)         NOT NULL UNIQUE,          -- EAN-13 or Code128
    stock_quantity  INTEGER             NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    stock_status    stock_status_enum   NOT NULL DEFAULT 'AVAILABLE',
    image_url       VARCHAR(500),
    description     TEXT,
    odoo_categ_id   INTEGER,                                      -- Odoo product.category id
    is_active       BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_tenant    ON products (tenant_id);
CREATE INDEX idx_products_barcode   ON products (barcode);
CREATE INDEX idx_products_category  ON products (category);
CREATE INDEX idx_products_status    ON products (stock_status) WHERE is_active = TRUE;

-- Trigger: auto-update stock_status based on stock_quantity
CREATE OR REPLACE FUNCTION fn_update_stock_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.stock_quantity = 0 THEN
        NEW.stock_status := 'OUT_OF_STOCK';
    ELSIF NEW.stock_quantity <= 5 THEN
        NEW.stock_status := 'LOW_STOCK';
    ELSE
        NEW.stock_status := 'AVAILABLE';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_stock_status
BEFORE INSERT OR UPDATE OF stock_quantity ON products
FOR EACH ROW EXECUTE FUNCTION fn_update_stock_status();

-- =============================================================================
-- TABLE: users
-- Internal system users: Cashier, Tenant (portal login), Leader, Admin
-- =============================================================================
CREATE TABLE users (
    user_id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(80)     NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    role            user_role_enum  NOT NULL,
    tenant_id       VARCHAR(20)     REFERENCES tenants(tenant_id) ON DELETE SET NULL,  -- only for TENANT role
    display_name    VARCHAR(150)    NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_role      ON users (role);
CREATE INDEX idx_users_tenant    ON users (tenant_id);

-- =============================================================================
-- TABLE: transactions
-- Core transaction record; TXN ID format: TXN-YYYYMMDD-NNNNN (per FSD)
-- =============================================================================
CREATE TABLE transactions (
    transaction_id      VARCHAR(25)         PRIMARY KEY,              -- TXN-20260415-00001
    customer_id         UUID                NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    status              txn_status_enum     NOT NULL DEFAULT 'PENDING',
    total_amount        DECIMAL(14,2)       NOT NULL CHECK (total_amount > 0),
    payment_method      payment_method_enum,                           -- set when PAID
    payment_reference   VARCHAR(100),                                  -- approval code / transfer ref
    cash_received       DECIMAL(14,2),                                 -- for CASH method
    cash_change         DECIMAL(14,2),                                 -- for CASH method
    cashier_id          UUID                REFERENCES users(user_id) ON DELETE SET NULL,
    qr_payload          TEXT,                                          -- raw QR code data
    expires_at          TIMESTAMPTZ         NOT NULL,                  -- PENDING timeout (30 min)
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    paid_at             TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT
);
CREATE INDEX idx_txn_customer   ON transactions (customer_id);
CREATE INDEX idx_txn_status     ON transactions (status);
CREATE INDEX idx_txn_cashier    ON transactions (cashier_id);
CREATE INDEX idx_txn_created    ON transactions (created_at DESC);

-- Sequence for TXN ID generation (daily counter)
CREATE SEQUENCE txn_daily_seq START 1 MAXVALUE 99999 CYCLE;

-- =============================================================================
-- TABLE: transaction_items
-- Line items within a transaction; one row per product per transaction
-- =============================================================================
CREATE TABLE transaction_items (
    item_id             UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      VARCHAR(25)         NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    product_id          VARCHAR(20)         NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    tenant_id           VARCHAR(20)         NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
    quantity            INTEGER             NOT NULL CHECK (quantity > 0),
    unit_price          DECIMAL(12,2)       NOT NULL,                  -- snapshot at time of order
    subtotal            DECIMAL(14,2)       NOT NULL,                  -- quantity * unit_price
    pickup_status       pickup_status_enum  NOT NULL DEFAULT 'READY',
    handed_over_at      TIMESTAMPTZ,
    handed_over_by      UUID                REFERENCES users(user_id) ON DELETE SET NULL
);
CREATE INDEX idx_items_transaction  ON transaction_items (transaction_id);
CREATE INDEX idx_items_product      ON transaction_items (product_id);
CREATE INDEX idx_items_tenant       ON transaction_items (tenant_id);

-- =============================================================================
-- TABLE: return_requests
-- Leader-controlled return/cancellation workflow
-- =============================================================================
CREATE TABLE return_requests (
    request_id      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  VARCHAR(25)         NOT NULL REFERENCES transactions(transaction_id) ON DELETE RESTRICT,
    requested_by    UUID                NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    reason          TEXT                NOT NULL,
    status          return_status_enum  NOT NULL DEFAULT 'PENDING',
    processed_by    UUID                REFERENCES users(user_id) ON DELETE SET NULL,
    rejection_note  TEXT,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);
CREATE INDEX idx_returns_txn    ON return_requests (transaction_id);
CREATE INDEX idx_returns_status ON return_requests (status);

-- =============================================================================
-- TABLE: audit_log
-- Immutable append-only log; all actor actions recorded here
-- =============================================================================
CREATE TABLE audit_log (
    log_id          BIGSERIAL           PRIMARY KEY,
    action          VARCHAR(80)         NOT NULL,    -- e.g. TXN_CREATED, PAYMENT_PROCESSED
    actor_id        VARCHAR(50)         NOT NULL,    -- UUID string or 'SYSTEM'
    actor_role      actor_role_enum     NOT NULL,
    entity_type     VARCHAR(50)         NOT NULL,    -- 'TRANSACTION', 'PRODUCT', etc.
    entity_id       VARCHAR(50)         NOT NULL,
    old_value       JSONB,
    new_value       JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_actor    ON audit_log (actor_id);
CREATE INDEX idx_audit_entity   ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_created  ON audit_log (created_at DESC);

-- =============================================================================
-- TABLE: notifications
-- Push notification log for tenant order alerts
-- =============================================================================
CREATE TABLE notifications (
    notification_id UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(20)     NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    transaction_id  VARCHAR(25)     NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    message         TEXT            NOT NULL,
    is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
    sent_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    read_at         TIMESTAMPTZ
);
CREATE INDEX idx_notif_tenant ON notifications (tenant_id, is_read);

-- =============================================================================
-- TABLE: cashier_sessions
-- Daily shift tracking per cashier; used for recap report
-- =============================================================================
CREATE TABLE cashier_sessions (
    session_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    cashier_id      UUID        NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    shift_date      DATE        NOT NULL,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    txn_count       INTEGER     NOT NULL DEFAULT 0,
    total_cash      DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_qris      DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_edc       DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_transfer  DECIMAL(14,2) NOT NULL DEFAULT 0,
    UNIQUE (cashier_id, shift_date)
);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Transaction summary with customer info
CREATE OR REPLACE VIEW v_transaction_summary AS
SELECT
    t.transaction_id,
    t.status,
    t.total_amount,
    t.payment_method,
    t.created_at,
    t.paid_at,
    t.expires_at,
    c.full_name    AS customer_name,
    c.phone_number AS customer_phone,
    u.display_name AS cashier_name,
    COUNT(ti.item_id) AS item_count
FROM transactions t
JOIN customers c ON c.customer_id = t.customer_id
LEFT JOIN users u ON u.user_id = t.cashier_id
LEFT JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
GROUP BY t.transaction_id, c.full_name, c.phone_number, u.display_name;

-- Tenant sales view
CREATE OR REPLACE VIEW v_tenant_sales AS
SELECT
    ten.tenant_id,
    ten.tenant_name,
    ten.booth_location,
    COUNT(DISTINCT ti.transaction_id)   AS total_orders,
    SUM(ti.quantity)                    AS total_items_sold,
    SUM(ti.subtotal)                    AS gross_revenue,
    SUM(ti.subtotal * ten.revenue_share_pct / 100) AS net_revenue
FROM transaction_items ti
JOIN tenants ten ON ten.tenant_id = ti.tenant_id
JOIN transactions t ON t.transaction_id = ti.transaction_id
WHERE t.status = 'PAID'
GROUP BY ten.tenant_id, ten.tenant_name, ten.booth_location, ten.revenue_share_pct;

-- =============================================================================
-- SEED: initial admin user (password: admin123 — change in production)
-- =============================================================================
INSERT INTO users (user_id, username, password_hash, role, display_name)
VALUES (
    gen_random_uuid(),
    'admin',
    '$2b$10$examplehashreplacewithbcrypt',
    'ADMIN',
    'System Administrator'
);
