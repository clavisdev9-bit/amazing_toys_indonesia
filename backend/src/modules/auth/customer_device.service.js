'use strict';

const { query } = require('../../config/database');

const DEVICE_TRUST_DAYS = parseInt(process.env.DEVICE_TRUST_DAYS || '30', 10);

async function checkTrustedDevice(customerId, deviceId) {
  const result = await query(
    `SELECT id FROM customer_trusted_devices
     WHERE customer_id = $1 AND device_id = $2 AND expires_at > NOW()`,
    [customerId, deviceId]
  );
  if (result.rows.length === 0) return false;

  await query(
    `UPDATE customer_trusted_devices SET last_seen_at = NOW() WHERE id = $1`,
    [result.rows[0].id]
  );
  return true;
}

async function registerTrustedDevice(customerId, deviceId, deviceInfo = {}) {
  const { deviceName = 'Unknown', browser = '-', ipAddress = null } = deviceInfo;
  await query(
    `INSERT INTO customer_trusted_devices
       (customer_id, device_id, device_name, browser, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + $6::interval)
     ON CONFLICT (customer_id, device_id) DO UPDATE
       SET device_name  = EXCLUDED.device_name,
           browser      = EXCLUDED.browser,
           ip_address   = EXCLUDED.ip_address,
           last_seen_at = NOW(),
           expires_at   = NOW() + $6::interval`,
    [customerId, deviceId, deviceName, browser, ipAddress, `${DEVICE_TRUST_DAYS} days`]
  );
}

async function revokeDevice(customerId, deviceId) {
  await query(
    `DELETE FROM customer_trusted_devices
     WHERE customer_id = $1 AND device_id = $2`,
    [customerId, deviceId]
  );
}

module.exports = { checkTrustedDevice, registerTrustedDevice, revokeDevice };
