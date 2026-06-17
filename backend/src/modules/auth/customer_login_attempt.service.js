'use strict';

const { query } = require('../../config/database');

const MAX_ATTEMPTS    = parseInt(process.env.LOGIN_MAX_ATTEMPTS   || '5',  10);
const LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '5', 10);

// identifier = phone_number atau email tergantung metode login customer
async function checkLockout(identifier) {
  const result = await query(
    `SELECT attempt_count, locked_until
     FROM customer_login_attempts
     WHERE identifier = $1`,
    [identifier]
  );
  if (!result.rows[0]) return { locked: false, remainingSeconds: 0 };

  const row = result.rows[0];
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    const remainingSeconds = Math.ceil(
      (new Date(row.locked_until) - new Date()) / 1000
    );
    return { locked: true, remainingSeconds };
  }
  return { locked: false, remainingSeconds: 0 };
}

async function recordFailedAttempt(identifier) {
  const result = await query(
    `INSERT INTO customer_login_attempts (identifier, phone_number, attempt_count, last_attempt)
     VALUES ($1, $1, 1, NOW())
     ON CONFLICT (identifier) DO UPDATE
       SET attempt_count = CASE
             WHEN customer_login_attempts.locked_until IS NOT NULL
               AND customer_login_attempts.locked_until <= NOW()
             THEN 1
             ELSE customer_login_attempts.attempt_count + 1
           END,
           locked_until = CASE
             WHEN (CASE
                     WHEN customer_login_attempts.locked_until IS NOT NULL
                       AND customer_login_attempts.locked_until <= NOW()
                     THEN 1
                     ELSE customer_login_attempts.attempt_count + 1
                   END) >= $2
             THEN NOW() + ($3 || ' minutes')::interval
             ELSE NULL
           END,
           notif_sent   = CASE
             WHEN (CASE
                     WHEN customer_login_attempts.locked_until IS NOT NULL
                       AND customer_login_attempts.locked_until <= NOW()
                     THEN 1
                     ELSE customer_login_attempts.attempt_count + 1
                   END) >= $2
             THEN FALSE
             ELSE customer_login_attempts.notif_sent
           END,
           last_attempt = NOW()
     RETURNING attempt_count, locked_until, notif_sent`,
    [identifier, MAX_ATTEMPTS, String(LOCKOUT_MINUTES)]
  );

  const row = result.rows[0];
  const isNowLocked = row.locked_until && new Date(row.locked_until) > new Date();
  const shouldSendNotif = isNowLocked && !row.notif_sent;

  return {
    locked:           !!isNowLocked,
    remainingSeconds: isNowLocked
      ? Math.ceil((new Date(row.locked_until) - new Date()) / 1000)
      : 0,
    shouldSendNotif,
  };
}

async function markNotifSent(identifier) {
  await query(
    `UPDATE customer_login_attempts SET notif_sent = TRUE WHERE identifier = $1`,
    [identifier]
  );
}

async function resetAttempts(identifier) {
  await query(
    `DELETE FROM customer_login_attempts WHERE identifier = $1`,
    [identifier]
  );
}

module.exports = { checkLockout, recordFailedAttempt, markNotifSent, resetAttempts };
