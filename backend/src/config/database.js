'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3452', 10),
  database: process.env.DB_NAME     || 'amazing_toys_sos',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  min:      parseInt(process.env.DB_POOL_MIN || '2',  10),
  max:      parseInt(process.env.DB_POOL_MAX || '10', 10),
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a single parameterised query.
 * @param {string} text   SQL query with $1, $2 … placeholders
 * @param {any[]}  params Parameter values
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.debug('[DB]', { query: text, duration, rows: result.rowCount });
  }
  return result;
}

/**
 * Run multiple queries inside a single transaction.
 * @param {Function} fn  async (client) => { ... }
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
