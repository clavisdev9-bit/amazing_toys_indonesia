'use strict';

const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const { query } = require('../../config/database');
const { AppError } = require('../../middlewares/error.middleware');
const { sendLoginAlert } = require('../../services/email.service');

// ── Internal users (Cashier / Tenant / Leader / Admin) ──────────────────────

async function loginUser({ username, password }) {
  const result = await query(
    `SELECT user_id, username, password_hash, role, tenant_id, display_name, is_active
     FROM users WHERE username = $1`,
    [username]
  );
  const user = result.rows[0];
  if (!user || !user.is_active) throw new AppError('Username atau password salah.', 401);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError('Username atau password salah.', 401);

  const payload = {
    userId:    user.user_id,
    username:  user.username,
    role:      user.role,
    tenantId:  user.tenant_id,
    name:      user.display_name,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  await query(`UPDATE users SET last_login_at = NOW() WHERE user_id = $1`, [user.user_id]);

  sendLoginAlert({ ...payload, loginAt: new Date() }).catch(() => {});

  return { token, user: payload };
}

// ── Customer auth (phone-number based, no password) ─────────────────────────

async function registerCustomer({ full_name, phone_number, email, gender }) {
  const exists = await query(
    `SELECT customer_id FROM customers WHERE phone_number = $1`,
    [phone_number]
  );
  if (exists.rows.length > 0) {
    throw new AppError('Nomor telepon sudah terdaftar, silakan login.', 409);
  }

  const result = await query(
    `INSERT INTO customers (full_name, phone_number, email, gender)
     VALUES ($1, $2, $3, $4)
     RETURNING customer_id, full_name, phone_number, email, gender, registered_at`,
    [full_name, phone_number, email || null, gender]
  );
  const customer = result.rows[0];
  const token = issueCustomerToken(customer);
  return { token, customer };
}

async function loginCustomer({ phone_number }) {
  const result = await query(
    `SELECT customer_id, full_name, phone_number, email, gender, registered_at
     FROM customers WHERE phone_number = $1 AND is_active = TRUE`,
    [phone_number]
  );
  const customer = result.rows[0];
  if (!customer) throw new AppError('Akun tidak ditemukan. Silakan daftar terlebih dahulu.', 404);

  const token = issueCustomerToken(customer);
  return { token, customer };
}

function issueCustomerToken(customer) {
  return jwt.sign(
    { customerId: customer.customer_id, role: 'CUSTOMER', phone: customer.phone_number },
    process.env.JWT_SECRET,
    { expiresIn: process.env.CUSTOMER_TOKEN_EXPIRES_IN || '24h' }
  );
}

module.exports = { loginUser, registerCustomer, loginCustomer };
