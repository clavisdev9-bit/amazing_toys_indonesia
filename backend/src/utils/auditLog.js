'use strict';

const { query } = require('../config/database');

/**
 * Append an entry to the audit_log table.
 *
 * @param {object} opts
 * @param {string} opts.action      e.g. 'TXN_CREATED', 'PAYMENT_PROCESSED'
 * @param {string} opts.actorId     UUID string or 'SYSTEM'
 * @param {string} opts.actorRole   CUSTOMER | CASHIER | TENANT | LEADER | SYSTEM
 * @param {string} opts.entityType  'TRANSACTION' | 'PRODUCT' | 'USER' …
 * @param {string} opts.entityId    Primary key of the entity
 * @param {object} [opts.oldValue]
 * @param {object} [opts.newValue]
 * @param {string} [opts.ipAddress]
 */
async function writeAuditLog({ action, actorId, actorRole, entityType, entityId, oldValue, newValue, ipAddress }) {
  await query(
    `INSERT INTO audit_log (action, actor_id, actor_role, entity_type, entity_id, old_value, new_value, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      action,
      String(actorId),
      actorRole,
      entityType,
      String(entityId),
      oldValue  ? JSON.stringify(oldValue)  : null,
      newValue  ? JSON.stringify(newValue)  : null,
      ipAddress || null,
    ]
  );
}

module.exports = { writeAuditLog };
