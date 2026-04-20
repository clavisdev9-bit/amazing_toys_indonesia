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

  // ── ORDER_PAID polling fallback (every POLLING_INTERVAL_SEC seconds) ───────
  setInterval(async () => {
    try {
      const data = await sos.get('/cashier/transactions?status=PAID&limit=50');
      const txns = data.transactions || data.data || [];

      for (const txn of txns) {
        const existing = await xref.getXref('order', txn.transaction_id);
        if (existing) continue; // already pushed
        logger.info('Polling: detected unpushed PAID transaction', { transactionId: txn.transaction_id });
        orderPush.pushOrder(txn.transaction_id).catch(() => {});
      }
    } catch (err) {
      // Polling is best-effort; swallow errors silently
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
