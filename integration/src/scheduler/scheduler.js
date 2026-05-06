'use strict';

const cron = require('node-cron');
const productSync = require('../services/product.sync');
const stockSync = require('../services/stock.sync');
const cancelSync = require('../services/cancel.sync');
const orderPush = require('../services/order.push');
const retryQueue = require('../queue/retry.queue');
const { updateSyncTime } = require('../routes/health.router');
const logger = require('../config/logger');
const env = require('../config/env');
const sos = require('../clients/sos.client');
const xref = require('../utils/xref');

// Track last polling cursor (last known PAID transaction processed)
const _pollingState = { lastProcessedAt: null };

const retryHandlers = {
  ORDER_PUSH: ({ transactionId }) => orderPush.pushOrder(transactionId),
};

function minuteToCron(min) {
  if (min <= 0) min = 1;
  if (min >= 60) return `0 */${Math.floor(min / 60)} * * *`;
  return `*/${min} * * * *`;
}

function start() {
  // ── Product sync (Odoo → SOS) ──────────────────────────────────────────────
  cron.schedule(minuteToCron(env.PRODUCT_SYNC_INTERVAL_MIN), async () => {
    try {
      await productSync.syncProducts();
      updateSyncTime('product');
    } catch (err) {
      logger.error('Scheduler: product sync error', { error: err.message });
    }
  });

  // ── Stock sync (Odoo qty → SOS) ────────────────────────────────────────────
  const stockInterval = Math.min(env.STOCK_SYNC_INTERVAL_MIN, env.PRODUCT_SYNC_INTERVAL_MIN);
  cron.schedule(minuteToCron(stockInterval), async () => {
    try {
      await stockSync.syncStock();
      updateSyncTime('stock');
    } catch (err) {
      logger.error('Scheduler: stock sync error', { error: err.message });
    }
  });

  // ── Expiry sweep (cancel stale Odoo draft orders) ──────────────────────────
  cron.schedule(minuteToCron(env.SWEEP_INTERVAL_MIN), async () => {
    try {
      await cancelSync.sweepExpired();
      updateSyncTime('sweep');
    } catch (err) {
      logger.error('Scheduler: expiry sweep error', { error: err.message });
    }
  });

  // ── ORDER_PAID polling fallback (every POLLING_INTERVAL_SEC seconds) ──────
  // Queries the shared DB directly so ALL historical PAID transactions are
  // covered — not just today's (which a date-filtered cashier API would miss).
  const { query } = require('../config/database');
  setInterval(async () => {
    try {
      const result = await query(`
        SELECT t.transaction_id FROM transactions t
        LEFT JOIN integration_xref x
               ON x.entity_type = 'order'
              AND x.sos_id      = t.transaction_id
              AND x.status      = 'ACTIVE'
        WHERE t.status = 'PAID'
          AND (x.odoo_id IS NULL OR (x.sync_metadata->>'confirmFailed')::boolean = true)
        ORDER BY t.paid_at DESC
        LIMIT 100
      `);

      for (const row of result.rows) {
        logger.info('Polling: unpushed PAID transaction detected', {
          transactionId: row.transaction_id,
        });
        orderPush.pushOrder(row.transaction_id).catch((err) =>
          logger.error('Polling: order push error', {
            transactionId: row.transaction_id,
            error: err.message,
          })
        );
      }
    } catch (err) {
      logger.error('Polling: DB query failed', { error: err.message });
    }
  }, env.POLLING_INTERVAL_SEC * 1000);

  // ── Retry queue processor (every 30 seconds) ──────────────────────────────
  setInterval(async () => {
    try {
      await retryQueue.processDue(retryHandlers);
    } catch (err) {
      logger.error('Scheduler: retry queue error', { error: err.message });
    }
  }, 30_000);

  logger.info('Scheduler started', {
    productSyncMin: env.PRODUCT_SYNC_INTERVAL_MIN,
    stockSyncMin: stockInterval,
    sweepMin: env.SWEEP_INTERVAL_MIN,
    pollingSec: env.POLLING_INTERVAL_SEC,
  });
}

module.exports = { start };
