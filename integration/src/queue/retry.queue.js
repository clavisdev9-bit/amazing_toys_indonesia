'use strict';

const logger = require('../config/logger');
const audit = require('../utils/audit');
const env = require('../config/env');

// Backoff delays: attempt 2 = 60s, attempt 3 = 300s, then dead-letter
const BACKOFF_MS = [0, 60_000, 300_000];

const _queue = [];

function enqueue(item) {
  _queue.push({ ...item, attempt: item.attempt || 1, nextRunAt: Date.now() });
  logger.warn('Retry queued', { type: item.type, id: item.id, attempt: item.attempt || 1 });
}

function size() {
  return _queue.length;
}

async function processDue(handlers) {
  const now = Date.now();
  const due = _queue.filter(i => i.nextRunAt <= now);

  for (const item of due) {
    const idx = _queue.indexOf(item);
    _queue.splice(idx, 1);

    const handler = handlers[item.type];
    if (!handler) {
      logger.error('No handler for retry type', { type: item.type });
      continue;
    }

    try {
      await handler(item.payload);
      audit.log({
        operation_type: item.type,
        sos_entity_id: item.id,
        action: 'RETRY',
        status: 'SUCCESS',
        attempt_number: item.attempt,
      });
      logger.info('Retry succeeded', { type: item.type, id: item.id, attempt: item.attempt });
    } catch (err) {
      const nextAttempt = item.attempt + 1;
      audit.log({
        operation_type: item.type,
        sos_entity_id: item.id,
        action: 'RETRY',
        status: 'FAILED',
        attempt_number: item.attempt,
        error_message: err.message,
      });

      if (nextAttempt > env.RETRY_MAX_ATTEMPTS) {
        await audit.pushDeadLetter(item.type, item.id, item.payload, err.message);
      } else {
        const delay = BACKOFF_MS[item.attempt] || 300_000;
        _queue.push({ ...item, attempt: nextAttempt, nextRunAt: now + delay });
        logger.warn('Retry re-queued', { type: item.type, id: item.id, nextAttempt, delayMs: delay });
      }
    }
  }
}

module.exports = { enqueue, size, processDue };
