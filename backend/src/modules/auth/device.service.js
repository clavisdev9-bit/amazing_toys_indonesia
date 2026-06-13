'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../../config/database');

const DEVICE_TRUST_DAYS = parseInt(process.env.DEVICE_TRUST_DAYS || '30', 10);

async function checkTrustedDevice(userId, deviceId, fingerprintHash) {
  const result = await query(
    `SELECT id, device_id, device_name, browser, last_login, expires_at
     FROM trusted_devices
     WHERE user_id = $1 AND device_id = $2 AND expires_at > NOW()`,
    [userId, deviceId]
  );

  if (result.rows.length === 0) return { trusted: false };

  const device = result.rows[0];

  // Verify fingerprint if provided
  if (fingerprintHash && device.fingerprint_hash) {
    const match = await bcrypt.compare(fingerprintHash, device.fingerprint_hash);
    if (!match) return { trusted: false };
  }

  // Update last_login
  await query(
    `UPDATE trusted_devices SET last_login = NOW() WHERE id = $1`,
    [device.id]
  );

  return { trusted: true, device };
}

async function registerTrustedDevice(userId, deviceId, fingerprintHash, deviceInfo = {}) {
  const { deviceName = 'Unknown Device', browser = '-', ipAddress = null } = deviceInfo;

  const hashedFingerprint = fingerprintHash
    ? await bcrypt.hash(fingerprintHash, 8)
    : null;

  const result = await query(
    `INSERT INTO trusted_devices
       (user_id, device_id, fingerprint_hash, device_name, browser, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + $7::interval)
     ON CONFLICT (user_id, device_id) DO UPDATE
       SET fingerprint_hash = EXCLUDED.fingerprint_hash,
           device_name      = EXCLUDED.device_name,
           browser          = EXCLUDED.browser,
           ip_address       = EXCLUDED.ip_address,
           last_login       = NOW(),
           expires_at       = NOW() + $7::interval
     RETURNING *`,
    [userId, deviceId, hashedFingerprint, deviceName, browser, ipAddress, `${DEVICE_TRUST_DAYS} days`]
  );
  return result.rows[0];
}

async function listUserDevices(userId) {
  const result = await query(
    `SELECT id, device_id, device_name, browser, ip_address, last_login, expires_at, created_at
     FROM trusted_devices
     WHERE user_id = $1
     ORDER BY last_login DESC`,
    [userId]
  );
  return result.rows;
}

async function revokeDevice(userId, deviceId) {
  await query(
    `DELETE FROM trusted_devices WHERE user_id = $1 AND device_id = $2`,
    [userId, deviceId]
  );
  await query(
    `UPDATE refresh_tokens SET revoked = TRUE
     WHERE user_id = $1 AND device_id = $2`,
    [userId, deviceId]
  );
}

async function revokeAllOtherDevices(userId, currentDeviceId) {
  await query(
    `DELETE FROM trusted_devices WHERE user_id = $1 AND device_id != $2`,
    [userId, currentDeviceId]
  );
  await query(
    `UPDATE refresh_tokens SET revoked = TRUE
     WHERE user_id = $1 AND device_id != $2`,
    [userId, currentDeviceId]
  );
}

async function storeRefreshToken(userId, deviceId, tokenHash) {
  // Revoke old tokens for this device first
  await query(
    `UPDATE refresh_tokens SET revoked = TRUE
     WHERE user_id = $1 AND device_id = $2`,
    [userId, deviceId]
  );

  const result = await query(
    `INSERT INTO refresh_tokens (user_id, device_id, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + $4::interval)
     RETURNING id, expires_at`,
    [userId, deviceId, tokenHash, `${DEVICE_TRUST_DAYS} days`]
  );
  return result.rows[0];
}

async function verifyRefreshToken(tokenHash) {
  const result = await query(
    `SELECT rt.*, u.user_id, u.username, u.role, u.tenant_id, u.display_name, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.user_id = rt.user_id
     WHERE rt.token_hash = $1
       AND rt.revoked = FALSE
       AND rt.expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0] ?? null;
}

module.exports = {
  checkTrustedDevice,
  registerTrustedDevice,
  listUserDevices,
  revokeDevice,
  revokeAllOtherDevices,
  storeRefreshToken,
  verifyRefreshToken,
};
