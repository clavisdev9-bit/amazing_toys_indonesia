'use strict';

const logger           = require('../../config/logger');
const schedulerService = require('./SchedulerService');
const productSyncJob   = require('./jobs/ProductSyncJob');
const stockSyncJob     = require('./jobs/StockSyncJob');

const DEFAULT_PRODUCT_INTERVAL = 60; // minutes
const DEFAULT_STOCK_INTERVAL   = 60;

/**
 * Read config, validate intervals, clear stale jobs, register fresh ones.
 * Must be called AFTER the DB connection pool is ready.
 *
 * @param {() => Promise<object>} getConfigFn  Returns the raw integration config object.
 */
async function initializeScheduledJobs(getConfigFn) {
  try {
    const cfg = await getConfigFn();

    const rawProd  = parseInt(cfg.odoo_product_sync_interval_min, 10);
    const rawStock = parseInt(cfg.odoo_stock_sync_interval_min,   10);

    const prodMins  = Number.isFinite(rawProd)  && rawProd  > 0 ? rawProd  : DEFAULT_PRODUCT_INTERVAL;
    const stockMins = Number.isFinite(rawStock) && rawStock > 0 ? rawStock : DEFAULT_STOCK_INTERVAL;

    // Clear any stale instances from a previous hot-reload or restart
    schedulerService.removeJob(productSyncJob.JOB_NAME);
    schedulerService.removeJob(stockSyncJob.JOB_NAME);

    schedulerService.registerJob(
      productSyncJob.JOB_NAME,
      prodMins,
      () => productSyncJob.execute({
        triggeredBy:    'scheduler',
        configSnapshot: { interval_minutes: prodMins },
      }),
    );

    schedulerService.registerJob(
      stockSyncJob.JOB_NAME,
      stockMins,
      () => stockSyncJob.execute({
        triggeredBy:    'scheduler',
        configSnapshot: { interval_minutes: stockMins },
      }),
    );

    // CP-1 — confirm odoo.stock.sync is in the registry after registration
    const registered = schedulerService.listJobs().find(j => j.name === stockSyncJob.JOB_NAME);
    if (registered) {
      logger.info(
        `[SYNC-TRACE][CP-1] PASS | ${stockSyncJob.JOB_NAME} registered — ` +
        `interval=${registered.intervalMinutes}m typeof=${typeof registered.intervalMinutes}`
      );
    } else {
      logger.error(`[SYNC-TRACE][CP-1] FAIL | ${stockSyncJob.JOB_NAME} not found in registry after registerJob()`);
    }

    logger.info(
      `[Scheduler] initialized — ProductSync every ${prodMins}m, StockSync every ${stockMins}m`
    );
  } catch (err) {
    // Non-fatal: app still starts; admin can fix config and call re-init via API.
    logger.error(`[Scheduler] initializeScheduledJobs failed: ${err.message}`);
  }
}

module.exports = { initializeScheduledJobs };
