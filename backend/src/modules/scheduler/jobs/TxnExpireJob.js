'use strict';

const { query } = require('../../../config/database');
const { writeAuditLog } = require('../../../utils/auditLog');
const logger = require('../../../config/logger');

const JOB_NAME = 'txn.expire.sweep';

/**
 * Sweep PENDING transactions whose expires_at has passed and mark them EXPIRED.
 *
 * Safety rules:
 * - Only touches status = 'PENDING' (never PENDING_APPROVAL — those have expires_at = NULL)
 * - Requires expires_at IS NOT NULL (avoids NULL comparison edge cases)
 * - Does NOT restore stock — stock was deducted when the transaction became PENDING;
 *   a separate Odoo cancel sync handles downstream cleanup.
 */
async function execute() {
  logger.info(`[${JOB_NAME}] sweep starting`);

  let expired = [];
  try {
    const result = await query(`
      UPDATE transactions
         SET status     = 'EXPIRED',
             updated_at = NOW()
       WHERE status     = 'PENDING'
         AND expires_at IS NOT NULL
         AND expires_at < NOW()
      RETURNING transaction_id
    `);
    expired = result.rows;
  } catch (err) {
    logger.error(`[${JOB_NAME}] DB update failed`, { error: err.message });
    return { expired: 0, error: err.message };
  }

  if (expired.length > 0) {
    logger.info(`[${JOB_NAME}] expired ${expired.length} transaction(s)`, {
      ids: expired.map(r => r.transaction_id),
    });

    // Audit each expired transaction (non-fatal)
    for (const row of expired) {
      try {
        await writeAuditLog({
          action: 'TXN_EXPIRED', actorId: null, actorRole: 'SYSTEM',
          entityType: 'TRANSACTION', entityId: row.transaction_id,
          oldValue: { status: 'PENDING' },
          newValue: { status: 'EXPIRED' },
        });
      } catch { /* non-critical */ }
    }
  } else {
    logger.debug(`[${JOB_NAME}] no expired transactions found`);
  }

  return { expired: expired.length };
}

module.exports = { JOB_NAME, execute };
