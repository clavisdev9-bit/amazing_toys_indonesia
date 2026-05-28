-- =============================================================================
-- Migration 005: BCA QRIS MPM transaction table
-- =============================================================================

CREATE TABLE IF NOT EXISTS qris_transactions (
  id                    SERIAL          PRIMARY KEY,
  order_id              VARCHAR(100)    NOT NULL UNIQUE,
  bca_reference_no      VARCHAR(100),
  qr_content            TEXT,
  amount                NUMERIC(15,2)   NOT NULL,
  currency              CHAR(3)         DEFAULT 'IDR',
  status                VARCHAR(20)     DEFAULT 'PENDING',  -- PENDING|PAID|EXPIRED|REFUNDED
  paid_at               TIMESTAMPTZ,
  paid_amount           NUMERIC(15,2),
  issuer_name           VARCHAR(100),
  refund_reference_no   VARCHAR(100),
  refund_amount         NUMERIC(15,2),
  refunded_at           TIMESTAMPTZ,
  webhook_received_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ     DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qris_order_id ON qris_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_qris_status   ON qris_transactions (status);
