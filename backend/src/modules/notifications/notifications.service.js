'use strict';

const { query }  = require('../../config/database');
const logger     = require('../../config/logger');

// WebSocket broadcast reference (injected at startup)
let _wsBroadcast = null;

function setWsBroadcast(fn) {
  _wsBroadcast = fn;
}

/**
 * Send push notification to a tenant and persist to DB.
 * Also broadcasts via WebSocket to connected tenant portals.
 */
async function sendOrderNotification(tenant, transactionId) {
  const message = `Pesanan baru PAID untuk booth ${tenant.tenant_name}. TXN: ${transactionId}`;

  // Persist notification record
  await query(
    `INSERT INTO notifications (tenant_id, transaction_id, message)
     VALUES ($1, $2, $3)`,
    [tenant.tenant_id, transactionId, message]
  );

  // WebSocket broadcast
  if (_wsBroadcast) {
    _wsBroadcast({
      event:         'ORDER_PAID',
      tenantId:      tenant.tenant_id,
      transactionId,
      message,
    });
  }

  // FCM push (mock in dev; wire real FCM in production)
  if (tenant.notification_device_token && process.env.FCM_SERVER_KEY) {
    try {
      await sendFCMPush(tenant.notification_device_token, message, { transactionId });
    } catch (err) {
      logger.warn(`[Notifications] FCM failed for tenant ${tenant.tenant_id}: ${err.message}`);
    }
  }

  logger.info(`[Notifications] Sent to tenant ${tenant.tenant_id} for TXN ${transactionId}`);
}

async function sendFCMPush(deviceToken, body, data) {
  // Real implementation: use firebase-admin or HTTP call to FCM API
  logger.debug(`[FCM] Push → ${deviceToken}: ${body}`);
}

async function getUnreadNotifications(tenantId) {
  const result = await query(
    `SELECT * FROM notifications WHERE tenant_id = $1 AND is_read = FALSE ORDER BY sent_at DESC`,
    [tenantId]
  );
  return result.rows;
}

async function markNotificationsRead(tenantId) {
  await query(
    `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE tenant_id = $1 AND is_read = FALSE`,
    [tenantId]
  );
}

module.exports = { setWsBroadcast, sendOrderNotification, getUnreadNotifications, markNotificationsRead };
