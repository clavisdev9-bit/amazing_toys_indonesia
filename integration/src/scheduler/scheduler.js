'use strict';

const cron        = require('node-cron');
const cancelSync  = require('../services/cancel.sync');
const orderPush   = require('../services/order.push');
const voucherSvc  = require('../services/payment-voucher.service');
const retryQueue  = require('../queue/retry.queue');
const { updateSyncTime } = require('../routes/health.router');
const logger = require('../config/logger');
const env = require('../config/env');
const sos = require('../clients/sos.client');
const xref = require('../utils/xref');

// Track last polling cursor (last known PAID transaction processed)
const _pollingState = { lastProcessedAt: null };

const retryHandlers = {
  ORDER_PUSH:      ({ transactionId }) => orderPush.pushOrder(transactionId),
  PAYMENT_VOUCHER: ({ transactionId }) => voucherSvc.pushPaymentVoucher(transactionId),
};

function minuteToCron(min) {
  if (min <= 0) min = 1;
  if (min >= 60) return `0 */${Math.floor(min / 60)} * * *`;
  return `*/${min} * * * *`;
}

function start() {
  // ── Expiry sweep (cancel stale Odoo draft orders) ──────────────────────────
  cron.schedule(minuteToCron(env.SWEEP_INTERVAL_MIN), async () => {
    try {
      await cancelSync.sweepExpired();
      updateSyncTime('sweep');
    } catch (err) {
      logger.error('Scheduler: expiry sweep error', { error: err.message });
    }
  });

  // ── Unified Odoo polling loop ─────────────────────────────────────────────
  // ORDER_PUSH and VoucherPoll run SEQUENTIALLY inside a single setInterval so
  // they can never make concurrent Odoo API calls and accidentally trip the
  // circuit breaker. The _polling guard also prevents a slow cycle from
  // overlapping with the next tick.
  const { query } = require('../config/database');
  let _polling = false;

  setInterval(async () => {
    if (_polling) {
      logger.warn('Polling: previous cycle still running — skipping tick');
      return;
    }
    _polling = true;
    try {
      // ── Phase 1: ORDER_PUSH ────────────────────────────────────────────────
      const orderResult = await query(`
        SELECT t.transaction_id FROM transactions t
        LEFT JOIN integration_xref x
               ON x.entity_type = 'order'
              AND x.sos_id      = t.transaction_id
              AND x.status      = 'ACTIVE'
        WHERE t.status = 'PAID'
          AND (x.odoo_id IS NULL
               OR (x.sync_metadata->>'confirmFailed')::boolean = true
               OR (x.sync_metadata->>'manualConfirmRequired')::boolean = true)
          AND (x.sync_metadata->>'deadLetter')::boolean IS NOT TRUE
        ORDER BY t.paid_at DESC
        LIMIT 5
      `);

      for (const row of orderResult.rows) {
        logger.info('Polling: unpushed PAID transaction detected', { transactionId: row.transaction_id });
        await orderPush.pushOrder(row.transaction_id).catch((err) =>
          logger.error('Polling: order push error', { transactionId: row.transaction_id, error: err.message })
        );
      }

      // ── Phase 2: VoucherPoll ───────────────────────────────────────────────
      const voucherResult = await query(`
        SELECT x.sos_id AS transaction_id
        FROM integration_xref x
        JOIN transactions t ON t.transaction_id = x.sos_id
        WHERE x.entity_type   = 'order'
          AND x.status        = 'ACTIVE'
          AND x.odoo_id       IS NOT NULL
          AND t.status        = 'PAID'
          AND (x.voucher_status IS NULL OR x.voucher_status NOT IN ('PAID', 'FAILED'))
          AND (x.sync_metadata->>'confirmFailed')::boolean IS NOT TRUE
          AND (x.sync_metadata->>'manualConfirmRequired')::boolean IS NOT TRUE
        ORDER BY t.paid_at DESC
        LIMIT 5
      `);

      for (const row of voucherResult.rows) {
        logger.info('VoucherPoll: unpaid voucher detected', { transactionId: row.transaction_id });
        await voucherSvc.pushPaymentVoucher(row.transaction_id).catch((err) =>
          logger.error('VoucherPoll: error', { transactionId: row.transaction_id, error: err.message })
        );
      }
    } catch (err) {
      logger.error('Polling: cycle error', { error: err.message });
    } finally {
      _polling = false;
    }
  }, env.POLLING_INTERVAL_SEC * 1000);

  // ── Retry queue processor (every 30 seconds) ──────────────────────────────
  // Guard prevents overlap if a retry cycle takes longer than 30s.
  const deadLetterHandlers = {
    // When a voucher permanently fails, mark it FAILED so VoucherPoll stops retrying.
    PAYMENT_VOUCHER: async ({ transactionId }) => {
      await query(
        `UPDATE integration_xref SET voucher_status = 'FAILED', voucher_synced_at = NOW()
         WHERE entity_type = 'order' AND sos_id = $1`,
        [transactionId],
      );
      logger.warn('PaymentVoucher: dead-lettered — voucher_status set to FAILED', { transactionId });
    },
  };

  let _retrying = false;
  setInterval(async () => {
    if (_retrying) return;
    _retrying = true;
    try {
      await retryQueue.processDue(retryHandlers, deadLetterHandlers);
    } catch (err) {
      logger.error('Scheduler: retry queue error', { error: err.message });
    } finally {
      _retrying = false;
    }
  }, 30_000);

  logger.info('Scheduler started', {
    sweepMin: env.SWEEP_INTERVAL_MIN,
    pollingSec: env.POLLING_INTERVAL_SEC,
  });
}

module.exports = { start };
