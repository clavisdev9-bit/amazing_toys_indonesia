'use strict';

const logger = require('../config/logger');
const audit  = require('../utils/audit');
const env    = require('../config/env');

// Backoff delays per attempt index: attempt 1 = 60s, attempt 2 = 300s, then dead-letter
const BACKOFF_MS  = [0, 60_000, 300_000];
const MAX_QUEUE   = 500;

// Map of `${type}:${id}` → queued item for O(1) deduplication lookups.
const _map   = new Map();
// Ordered list of pending items (source of truth for scheduling).
let   _queue = [];

function _key(item) { return `${item.type}:${item.id}`; }

function enqueue(item) {
  if (_queue.length >= MAX_QUEUE) {
    logger.error('Retry queue full — dropping item', { type: item.type, id: item.id });
    return;
  }
  const key      = _key(item);
  const attempt  = item.attempt || 1;
  const existing = _map.get(key);
  // Keep the higher-attempt entry so we don't reset backoff progress.
  if (existing && existing.attempt >= attempt) return;

  const entry = { ...item, attempt, nextRunAt: Date.now() };
  if (existing) {
    _queue = _queue.filter(i => _key(i) !== key);
  }
  _queue.push(entry);
  _map.set(key, entry);
  logger.warn('Retry queued', { type: item.type, id: item.id, attempt });
}

function size() { return _queue.length; }

async function processDue(handlers, onDeadLetter = {}) {
  const now = Date.now();
  const due = _queue.filter(i => i.nextRunAt <= now);
  // Remove all due items at once — O(n) single pass.
  _queue = _queue.filter(i => i.nextRunAt > now);
  due.forEach(i => _map.delete(_key(i)));

  for (const item of due) {
    const handler = handlers[item.type];
    if (!handler) {
      logger.error('No handler for retry type', { type: item.type });
      continue;
    }

    try {
      const result = await handler(item.payload);
      if (result && result.success === false) {
        throw new Error(result.error || 'handler returned success=false');
      }
      audit.log({
        operation_type: item.type,
        sos_entity_id:  item.id,
        action:         'RETRY',
        status:         'SUCCESS',
        attempt_number: item.attempt,
      });
      logger.info('Retry succeeded', { type: item.type, id: item.id, attempt: item.attempt });
    } catch (err) {
      const nextAttempt = item.attempt + 1;
      audit.log({
        operation_type: item.type,
        sos_entity_id:  item.id,
        action:         'RETRY',
        status:         'FAILED',
        attempt_number: item.attempt,
        error_message:  err.message,
      });

      if (nextAttempt > env.RETRY_MAX_ATTEMPTS) {
        await audit.pushDeadLetter(item.type, item.id, item.payload, err.message);
        if (onDeadLetter[item.type]) {
          await onDeadLetter[item.type](item.payload, err.message).catch(() => {});
        }
      } else {
        const delay = BACKOFF_MS[item.attempt] || 300_000;
        const next  = { ...item, attempt: nextAttempt, nextRunAt: now + delay };
        _queue.push(next);
        _map.set(_key(next), next);
        logger.warn('Retry re-queued', { type: item.type, id: item.id, nextAttempt, delayMs: delay });
      }
    }
  }
}

module.exports = { enqueue, size, processDue };
