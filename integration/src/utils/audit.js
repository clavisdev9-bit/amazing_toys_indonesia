'use strict';

const { query } = require('../config/database');
const logger = require('../config/logger');

// Write queue for non-blocking async audit logs
const _queue = [];
let _flushing = false;

async function _flush() {
  if (_flushing || _queue.length === 0) return;
  _flushing = true;
  while (_queue.length > 0) {
    const entry = _queue.shift();
    try {
      await query(
        `INSERT INTO integration_audit
           (operation_type, entity_type, sos_entity_id, odoo_entity_id,
            action, status, attempt_number, duration_ms, error_message,
            request_summary, response_summary)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          entry.operation_type,
          entry.entity_type || null,
          entry.sos_entity_id || null,
          entry.odoo_entity_id || null,
          entry.action || null,
          entry.status,
          entry.attempt_number || 1,
          entry.duration_ms || null,
          entry.error_message || null,
          entry.request_summary ? String(entry.request_summary).slice(0, 2000) : null,
          entry.response_summary ? String(entry.response_summary).slice(0, 500) : null,
        ]
      );
    } catch (err) {
      logger.error('audit write failed', { error: err.message });
    }
  }
  _flushing = false;
}

function log(entry) {
  _queue.push(entry);
  setImmediate(_flush);
}

async function pushDeadLetter(operationType, sosEntityId, payload, errorMessage) {
  try {
    await query(
      `INSERT INTO integration_dead_letter (operation_type, sos_entity_id, payload, error_message)
       VALUES ($1, $2, $3, $4)`,
      [operationType, sosEntityId, JSON.stringify(payload), errorMessage]
    );
    logger.error('Dead-letter queued', { operationType, sosEntityId, errorMessage });
  } catch (err) {
    logger.error('Failed to write dead-letter', { error: err.message });
  }
}

module.exports = { log, pushDeadLetter };
