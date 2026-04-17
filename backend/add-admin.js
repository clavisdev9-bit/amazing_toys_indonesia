'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('./src/config/database');

async function addAdmin() {
  const username = 'admin';
  const password = 'admin123';
  const displayName = 'Administrator';

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    console.log('Adding admin user...');
    console.log('Username:', username);
    console.log('Password:', password);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2, role = $3
       RETURNING user_id, username, role, display_name`,
      [username, passwordHash, 'ADMIN', displayName]
    );

    console.log('\n✅ Admin user created/updated:');
    console.log(result.rows[0]);
    console.log('\nYou can now login with:');
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

addAdmin();
