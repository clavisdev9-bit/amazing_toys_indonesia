-- Migration 009: Stock sync audit log table
-- Required by backend/src/modules/stock-sync — StockSyncRepository.
-- Missing from original schema.sql; this migration makes existing deployments consistent.

CREATE TABLE IF NOT EXISTS stock_sync_log (
  sync_id          TEXT                     NOT NULL,
  batch_id         TEXT                     NOT NULL,
  triggered_by     TEXT                     NOT NULL,
  triggered_at     TIMESTAMPTZ              NOT NULL,
  direction        TEXT                     NOT NULL DEFAULT 'SOS_TO_ODOO',
  sos_product_id   TEXT                     REFERENCES products (product_id) ON DELETE SET NULL,
  odoo_product_id  BIGINT,
  odoo_quant_id    BIGINT,
  location_id      BIGINT,
  qty_before       NUMERIC(12,3),
  qty_sent         NUMERIC(12,3),
  qty_confirmed    NUMERIC(12,3),
  eligibility_rule TEXT,
  status           TEXT                     NOT NULL DEFAULT 'pending',
  error_code       TEXT,
  error_message    TEXT,
  odoo_response    JSONB,
  duration_ms      INTEGER,
  created_at       TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sync_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_sync_log_batch   ON stock_sync_log (batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_sync_log_product ON stock_sync_log (sos_product_id);
CREATE INDEX IF NOT EXISTS idx_stock_sync_log_created ON stock_sync_log (created_at DESC);
