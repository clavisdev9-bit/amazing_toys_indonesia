'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { query } = require('../../config/database');

const OTP_TTL_MINUTES  = parseInt(process.env.OTP_TTL_MINUTES  || '5',  10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '3',  10);

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

async function hashOTP(plain) {
  return bcrypt.hash(plain, 10);
}

async function storeOTP(customerId, otpHash, ipAddress = null) {
  // Invalidate previous unused OTPs for this customer
  await query(
    `UPDATE customer_otps SET used_at = NOW()
     WHERE customer_id = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [customerId]
  );

  const result = await query(
    `INSERT INTO customer_otps (customer_id, otp_hash, expires_at, ip_address)
     VALUES ($1, $2, NOW() + $3::interval, $4)
     RETURNING id`,
    [customerId, otpHash, `${OTP_TTL_MINUTES} minutes`, ipAddress]
  );
  return result.rows[0];
}

async function verifyOTP(customerId, otpPlain) {
  const result = await query(
    `SELECT id, otp_hash, expires_at, attempt_count
     FROM customer_otps
     WHERE customer_id = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [customerId]
  );

  if (result.rows.length === 0) throw new Error('OTP_NOT_FOUND');

  const otp = result.rows[0];
  if (new Date(otp.expires_at) < new Date()) throw new Error('OTP_EXPIRED');

  // Increment attempts before checking to prevent brute force
  const updated = await query(
    `UPDATE customer_otps SET attempt_count = attempt_count + 1
     WHERE id = $1 RETURNING attempt_count`,
    [otp.id]
  );
  if (updated.rows[0].attempt_count > OTP_MAX_ATTEMPTS) {
    throw new Error('OTP_MAX_ATTEMPTS_EXCEEDED');
  }

  const valid = await bcrypt.compare(otpPlain, otp.otp_hash);
  if (!valid) return false;

  await query(`UPDATE customer_otps SET used_at = NOW() WHERE id = $1`, [otp.id]);
  return true;
}

module.exports = { generateOTP, hashOTP, storeOTP, verifyOTP };
