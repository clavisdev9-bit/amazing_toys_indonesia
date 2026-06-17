'use strict';

const { query, withTransaction } = require('../../../config/database');
const { writeAuditLog } = require('../../../utils/auditLog');
const logger = require('../../../config/logger');
const waSvc      = require('../../wa/wa.service');
const emailSvc   = require('../../../services/email.service');
const { broadcastToAll } = require('../../../ws/websocket');

const JOB_NAME = 'txn.expire.sweep';

/**
 * Restore stock for a single transaction (non-fatal per-item).
 * Used when RESERVED or WAITING_PAYMENT orders expire — stock was
 * deducted at creation and must be returned.
 */
async function restoreStock(client, transactionId) {
  try {
    await client.query(
      `UPDATE products p
          SET stock_quantity = stock_quantity + ti.quantity
         FROM transaction_items ti
        WHERE ti.transaction_id = $1
          AND ti.product_id = p.product_id
          AND ti.approval_status != 'REJECTED'`,
      [transactionId],
    );
  } catch (err) {
    logger.warn(`[${JOB_NAME}] stock restore failed for ${transactionId}`, { error: err.message });
  }
}

/**
 * Sweep transactions whose expires_at has passed and mark them EXPIRED.
 *
 * Statuses swept:
 *  - RESERVED        → stock deducted at creation → must restore stock on expire
 *  - WAITING_PAYMENT → inherited from RESERVED    → must restore stock on expire
 *  - PENDING         → legacy self-order          → stock handled by Odoo cancel sync, no restore here
 *
 * Never touches PENDING_APPROVAL (expires_at = NULL), PAID, CANCELLED, COMPLETED.
 */
async function execute() {
  logger.info(`[${JOB_NAME}] sweep starting`);

  // ── Step 1: Expire RESERVED + WAITING_PAYMENT and restore their stock ──────
  let stockStatuses = [];
  try {
    const result = await query(`
      UPDATE transactions
         SET status = 'EXPIRED'
       WHERE status IN ('RESERVED', 'WAITING_PAYMENT')
         AND expires_at IS NOT NULL
         AND expires_at < NOW()
      RETURNING transaction_id, status AS new_status
    `);
    stockStatuses = result.rows;
  } catch (err) {
    logger.error(`[${JOB_NAME}] sweep RESERVED/WAITING_PAYMENT failed`, { error: err.message });
  }

  if (stockStatuses.length > 0) {
    logger.info(`[${JOB_NAME}] expired ${stockStatuses.length} RESERVED/WAITING_PAYMENT transaction(s)`, {
      ids: stockStatuses.map(r => r.transaction_id),
    });

    // Restore stock + audit (each in its own transaction, non-fatal)
    for (const row of stockStatuses) {
      try {
        await withTransaction(async (client) => {
          await restoreStock(client, row.transaction_id);
          await writeAuditLog({
            action: 'TXN_EXPIRED', actorId: null, actorRole: 'SYSTEM',
            entityType: 'TRANSACTION', entityId: row.transaction_id,
            oldValue: { status: 'RESERVED' },
            newValue: { status: 'EXPIRED', stockRestored: true },
          });
        });
      } catch { /* non-critical */ }
    }
  }

  // ── Step 2: Expire PENDING — no stock restore (Odoo cancel sync handles it) ─
  // CR-050: fetch order_type + customer contact so we can send WA for pre-order PENDING expiry
  let pendingExpired = [];
  try {
    const result = await query(`
      UPDATE transactions t
         SET status = 'EXPIRED'
       WHERE t.status = 'PENDING'
         AND t.expires_at IS NOT NULL
         AND t.expires_at < NOW()
      RETURNING t.transaction_id, t.order_type,
                t.customer_phone,
                (SELECT c.phone_number FROM customers c WHERE c.customer_id = t.customer_id) AS reg_phone,
                (SELECT c.full_name FROM customers c WHERE c.customer_id = t.customer_id) AS customer_name,
                (SELECT c.email FROM customers c WHERE c.customer_id = t.customer_id) AS customer_email
    `);
    pendingExpired = result.rows;
  } catch (err) {
    logger.error(`[${JOB_NAME}] sweep PENDING failed`, { error: err.message });
  }

  if (pendingExpired.length > 0) {
    logger.info(`[${JOB_NAME}] expired ${pendingExpired.length} PENDING transaction(s)`, {
      ids: pendingExpired.map(r => r.transaction_id),
    });
    for (const row of pendingExpired) {
      try {
        await writeAuditLog({
          action: 'TXN_EXPIRED', actorId: null, actorRole: 'SYSTEM',
          entityType: 'TRANSACTION', entityId: row.transaction_id,
          oldValue: { status: 'PENDING' },
          newValue: { status: 'EXPIRED' },
        });
      } catch { /* non-critical */ }

      // CR-050: fire-and-forget WA for pre-order PENDING expiry (no stock restore — never deducted)
      if (row.order_type === 'PREORDER') {
        const phone = row.reg_phone || row.customer_phone;
        const name  = row.customer_name || 'Customer';
        if (phone) {
          waSvc.sendPreorderExpired(phone, name)
            .catch(err => logger.warn(`[${JOB_NAME}] sendPreorderExpired WA failed for ${row.transaction_id}`, { error: err.message }));
        }
        if (row.customer_email) {
          emailSvc.sendPreorderExpiredEmail(row.customer_email, name)
            .catch(err => logger.warn(`[${JOB_NAME}] sendPreorderExpired email failed for ${row.transaction_id}`, { error: err.message }));
        }
      }
    }
  }

  const total = stockStatuses.length + pendingExpired.length;
  if (total === 0) logger.debug(`[${JOB_NAME}] no expired transactions found`);

  // Notify all connected clients so cashier queue auto-refreshes (BUG-076)
  if (total > 0) {
    try {
      broadcastToAll({ event: 'txn:expired', data: { count: total } });
    } catch { /* non-critical — WebSocket may not be initialized yet */ }
  }

  return { expired: total, withStockRestore: stockStatuses.length, pendingOnly: pendingExpired.length };
}

module.exports = { JOB_NAME, execute };
