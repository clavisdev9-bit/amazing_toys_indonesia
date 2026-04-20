-- Integration Service Tables
-- Run against: amazing_toys_sos database

-- Cross-reference table: maps SOS IDs ↔ Odoo IDs
CREATE TABLE IF NOT EXISTS integration_xref (
  id              BIGSERIAL PRIMARY KEY,
  entity_type     VARCHAR(20) NOT NULL,   -- 'product', 'customer', 'order'
  sos_id          VARCHAR(100) NOT NULL,
  odoo_id         INTEGER,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, CANCELLED, FAILED
  sync_metadata   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, sos_id)
);

CREATE INDEX IF NOT EXISTS idx_xref_entity_sos ON integration_xref (entity_type, sos_id);
CREATE INDEX IF NOT EXISTS idx_xref_entity_odoo ON integration_xref (entity_type, odoo_id);

-- Audit log table for integration operations
CREATE TABLE IF NOT EXISTS integration_audit (
  id              BIGSERIAL PRIMARY KEY,
  operation_id    UUID NOT NULL DEFAULT gen_random_uuid(),
  operation_type  VARCHAR(30) NOT NULL,   -- PRODUCT_SYNC, ORDER_PUSH, CANCEL_SYNC, STOCK_SYNC, AUTH, CUSTOMER_SYNC
  entity_type     VARCHAR(20),
  sos_entity_id   VARCHAR(100),
  odoo_entity_id  INTEGER,
  action          VARCHAR(20),            -- CREATE, UPDATE, SKIP, FAIL, RETRY, CANCEL
  status          VARCHAR(20) NOT NULL,   -- SUCCESS, FAILED, RETRYING
  attempt_number  SMALLINT DEFAULT 1,
  duration_ms     INTEGER,
  error_message   TEXT,
  request_summary TEXT,
  response_summary TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_type ON integration_audit (operation_type);
CREATE INDEX IF NOT EXISTS idx_audit_status ON integration_audit (status);
CREATE INDEX IF NOT EXISTS idx_audit_sos_id ON integration_audit (sos_entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON integration_audit (created_at);

-- Shared key-value config store (admin UI → integration service)
CREATE TABLE IF NOT EXISTS system_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dead-letter queue for operations that failed all retries
CREATE TABLE IF NOT EXISTS integration_dead_letter (
  id              BIGSERIAL PRIMARY KEY,
  operation_type  VARCHAR(30) NOT NULL,
  sos_entity_id   VARCHAR(100),
  payload         JSONB NOT NULL,
  error_message   TEXT,
  attempt_count   SMALLINT DEFAULT 3,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     VARCHAR(100)
);
