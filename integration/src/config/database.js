'use strict';

const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({ connectionString: env.XREF_DB_URL });

pool.on('error', (err) => {
  require('./logger').error('pg pool error', { error: err.message });
});

async function query(sql, params) {
  return pool.query(sql, params);
}

module.exports = { pool, query };
