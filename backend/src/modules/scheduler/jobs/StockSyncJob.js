'use strict';

const logger             = require('../../../config/logger');
const jobRunLog          = require('../JobRunLogRepository');
const { StockSyncService } = require('../../stock-sync/application/services/StockSyncService');

const JOB_NAME   = 'odoo.stock.sync';
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let _running = false;

/**
 * Execute the Stock Sync job.
 *
 * @param {{ triggeredBy?: string, configSnapshot?: object }} [opts]
 * @returns {Promise<{ job_name, status, total?, synced?, failed?, skipped?, duration_ms }>}
 */
async function execute({ triggeredBy = 'scheduler', configSnapshot = {} } = {}) {
  if (_running) {
    const runId = await jobRunLog.start(JOB_NAME, triggeredBy, configSnapshot);
    await jobRunLog.finish(runId, { status: 'skipped', errorMessage: 'SKIPPED — already running' });
    logger.warn(`[${JOB_NAME}] SKIPPED — previous run still active`);
    return { job_name: JOB_NAME, status: 'skipped' };
  }

  _running = true;
  const runId = await jobRunLog.start(JOB_NAME, triggeredBy, configSnapshot);
  // CP-2 — job_run_log row created; confirms scheduler fired and handler entered
  logger.info(`[SYNC-TRACE][CP-2] PASS | job_run_log row created runId=${runId} triggeredBy=${triggeredBy}`);
  const t0    = Date.now();

  let timedOut = false;
  const timeoutHandle = setTimeout(async () => {
    if (_running) {
      timedOut = true;
      _running = false;
      try {
        await jobRunLog.finish(runId, {
          status:       'timeout',
          errorMessage: `Job exceeded ${TIMEOUT_MS / 60000}-minute hard limit`,
        });
      } catch { /* best-effort */ }
      logger.error(`[${JOB_NAME}] TIMEOUT after ${TIMEOUT_MS / 60000} minutes`);
    }
  }, TIMEOUT_MS);

  try {
    const svc        = new StockSyncService();
    const dto        = await svc.syncStock({ triggeredBy });
    const durationMs = Date.now() - t0;

    if (!timedOut) {
      await jobRunLog.finish(runId, {
        status:        'success',
        totalRecords:  dto.total,
        synced:        dto.success,
        failedRecords: dto.failed,
      });
      logger.info(
        `[${JOB_NAME}] success — ` +
        `synced:${dto.success} failed:${dto.failed} skipped:${dto.skipped} ` +
        `total:${dto.total} in ${durationMs}ms`
      );
    }

    return {
      job_name: JOB_NAME, status: 'success',
      total: dto.total, synced: dto.success, failed: dto.failed, skipped: dto.skipped,
      duration_ms: durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - t0;
    if (!timedOut) {
      await jobRunLog.finish(runId, {
        status:       'failed',
        errorMessage: err.message,
        errorDetail:  { stack: err.stack },
      }).catch(() => {});
      logger.error(`[${JOB_NAME}] failed: ${err.message}`);
    }
    return { job_name: JOB_NAME, status: 'failed', error: err.message, duration_ms: durationMs };
  } finally {
    clearTimeout(timeoutHandle);
    _running = false;
  }
}

module.exports = { JOB_NAME, execute };
