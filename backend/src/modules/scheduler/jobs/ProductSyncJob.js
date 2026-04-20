'use strict';

const logger    = require('../../../config/logger');
const jobRunLog = require('../JobRunLogRepository');
const adminSvc  = require('../../admin/admin.service');

const JOB_NAME     = 'odoo.product.sync';
const TIMEOUT_MS   = 10 * 60 * 1000; // 10 minutes

let _running = false;

/**
 * Execute the Product Sync job.
 *
 * @param {{ triggeredBy?: string, configSnapshot?: object }} [opts]
 * @returns {Promise<{ job_name, status, total?, created?, updated?, skipped?, failed?, duration_ms }>}
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
  const t0    = Date.now();

  // Hard 10-minute timeout
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
    const result     = await adminSvc.syncOdooProducts(false);
    const durationMs = Date.now() - t0;
    const stats      = result.stats ?? {};

    if (!timedOut) {
      await jobRunLog.finish(runId, {
        status:        'success',
        totalRecords:  stats.total,
        synced:        (stats.created ?? 0) + (stats.updated ?? 0) + (stats.skipped ?? 0),
        failedRecords: stats.failed ?? 0,
      });
      logger.info(
        `[${JOB_NAME}] success — created:${stats.created} updated:${stats.updated} ` +
        `skipped:${stats.skipped} failed:${stats.failed} in ${durationMs}ms`
      );
    }

    return { job_name: JOB_NAME, status: 'success', ...stats, duration_ms: durationMs };
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
