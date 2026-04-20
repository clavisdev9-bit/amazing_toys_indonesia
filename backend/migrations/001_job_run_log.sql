-- Migration 001: job_run_log
-- Records every scheduled and manual job execution for audit and admin UI.

CREATE TABLE IF NOT EXISTS job_run_log (
  run_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name        VARCHAR(50)  NOT NULL,
  triggered_by    VARCHAR(30)  NOT NULL DEFAULT 'scheduler',
  started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  duration_ms     INTEGER,
  status          VARCHAR(20)  NOT NULL DEFAULT 'running',
  total_records   INTEGER,
  synced          INTEGER,
  failed_records  INTEGER,
  error_message   TEXT,
  error_detail    JSONB,
  config_snapshot JSONB
);

CREATE INDEX IF NOT EXISTS idx_job_run_log_name_started
  ON job_run_log (job_name, started_at DESC);
