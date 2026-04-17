'use strict';

const { query } = require('../config/database');

/**
 * Generate a transaction ID in the format: TXN-YYYYMMDD-NNNNN
 * Uses a PostgreSQL sequence for the daily counter (resets via cron or on new day).
 *
 * NOTE: For true per-day reset, schedule a daily: ALTER SEQUENCE txn_daily_seq RESTART;
 * or handle it in the DB with a date-keyed counter table.
 */
async function generateTxnId() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const result = await query("SELECT nextval('txn_daily_seq') AS seq");
  const counter = String(result.rows[0].seq).padStart(5, '0');
  return `TXN-${datePart}-${counter}`;
}

module.exports = { generateTxnId };
