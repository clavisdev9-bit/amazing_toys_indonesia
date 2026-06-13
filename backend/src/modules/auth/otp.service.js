'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { query } = require('../../config/database');

const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || '5', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10);

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

async function hashOTP(otpPlain) {
  return bcrypt.hash(otpPlain, 10);
}

async function storeOTP(userId, otpHash, ipAddress = null) {
  // Invalidate any previous unused OTPs for this user first
  await query(
    `UPDATE login_otps SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [userId]
  );

  const result = await query(
    `INSERT INTO login_otps (user_id, otp_hash, expires_at, ip_address)
     VALUES ($1, $2, NOW() + $3::interval, $4)
     RETURNING id`,
    [userId, otpHash, `${OTP_TTL_MINUTES} minutes`, ipAddress]
  );
  return result.rows[0];
}

async function verifyOTP(userId, otpPlain) {
  // Get the latest active OTP for this user
  const result = await query(
    `SELECT id, otp_hash, expires_at, attempt_count
     FROM login_otps
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('OTP_NOT_FOUND');
  }

  const otp = result.rows[0];

  if (new Date(otp.expires_at) < new Date()) {
    throw new Error('OTP_EXPIRED');
  }

  // Increment attempt count before checking — prevents brute force even on error
  const updatedAttempt = await query(
    `UPDATE login_otps SET attempt_count = attempt_count + 1
     WHERE id = $1
     RETURNING attempt_count`,
    [otp.id]
  );
  const attempts = updatedAttempt.rows[0].attempt_count;

  if (attempts > OTP_MAX_ATTEMPTS) {
    throw new Error('OTP_MAX_ATTEMPTS_EXCEEDED');
  }

  const valid = await bcrypt.compare(otpPlain, otp.otp_hash);
  if (!valid) return false;

  // Mark as used
  await query(`UPDATE login_otps SET used_at = NOW() WHERE id = $1`, [otp.id]);
  return true;
}

async function cleanExpiredOTPs() {
  await query(
    `DELETE FROM login_otps WHERE expires_at < NOW() OR used_at IS NOT NULL`
  );
}

module.exports = { generateOTP, hashOTP, storeOTP, verifyOTP, cleanExpiredOTPs };
