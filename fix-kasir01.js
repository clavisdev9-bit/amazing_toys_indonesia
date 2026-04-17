#!/usr/bin/env node
'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3452', 10),
  database: process.env.DB_NAME     || 'amazing_toys_sos',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const correctHash = '$2b$10$QJ1eTOg5fFAVfywbJD14ru0ZwpXcj.Isi3n9Xk2KG0ZOEMk6GBRF.';

async function fixKasir01() {
  try {
    console.log('Connecting to database...');

    // First, check current state
    const checkResult = await pool.query(
      `SELECT user_id, username, password_hash, is_active, role FROM users WHERE username = 'kasir01'`
    );

    if (checkResult.rows.length === 0) {
      console.log('❌ User kasir01 not found in database');
      process.exit(1);
    }

    const user = checkResult.rows[0];
    console.log('Current user state:');
    console.log(`  user_id: ${user.user_id}`);
    console.log(`  username: ${user.username}`);
    console.log(`  password_hash: ${user.password_hash}`);
    console.log(`  is_active: ${user.is_active}`);
    console.log(`  role: ${user.role}`);

    // Update password hash and ensure is_active is true
    const updateResult = await pool.query(
      `UPDATE users
       SET password_hash = $1, is_active = TRUE
       WHERE username = 'kasir01'
       RETURNING user_id, username, password_hash, is_active, role`,
      [correctHash]
    );

    if (updateResult.rows.length > 0) {
      const updated = updateResult.rows[0];
      console.log('\n✅ User kasir01 updated successfully:');
      console.log(`  user_id: ${updated.user_id}`);
      console.log(`  username: ${updated.username}`);
      console.log(`  password_hash: ${updated.password_hash}`);
      console.log(`  is_active: ${updated.is_active}`);
      console.log(`  role: ${updated.role}`);
      console.log('\n✅ User kasir01 can now login with password: password123');
    }

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

fixKasir01();
