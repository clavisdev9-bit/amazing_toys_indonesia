'use strict';

const bcrypt   = require('bcrypt');
const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const { query } = require('../../config/database');
const { AppError } = require('../../middlewares/error.middleware');
const { sendLoginAlert, sendOTPEmail, sendNewDeviceAlert } = require('../../services/email.service');
const { fireWebhook } = require('../../utils/webhook');
const logger   = require('../../config/logger');
const otpSvc   = require('./otp.service');
const deviceSvc = require('./device.service');

// ── Token helpers ─────────────────────────────────────────────────────────────

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

function signTempToken(payload) {
  const ttl = parseInt(process.env.OTP_TTL_MINUTES || '5', 10);
  return jwt.sign({ ...payload, _step: 'OTP_PENDING' }, process.env.JWT_SECRET, {
    expiresIn: `${ttl}m`,
  });
}

function verifyTempToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded._step !== 'OTP_PENDING') throw new Error('bad_step');
    return decoded;
  } catch {
    throw new AppError('Token verifikasi tidak valid atau sudah kedaluwarsa.', 401);
  }
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  const visible = local.length > 2 ? local.slice(0, 2) : local[0] || '*';
  return `${visible}***@${domain}`;
}

async function issueFullTokens(user, deviceId) {
  const payload = {
    userId:   user.user_id,
    username: user.username,
    role:     user.role,
    tenantId: user.tenant_id,
    name:     user.display_name,
    ...(deviceId && { deviceId }),
  };

  const accessToken = signAccessToken(payload);

  let refreshToken;
  if (deviceId) {
    const raw       = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    await deviceSvc.storeRefreshToken(user.user_id, deviceId, tokenHash);
    refreshToken = raw;
  }

  return { token: accessToken, refreshToken, user: payload };
}

// ── Internal user login (Cashier / Tenant / Leader / Admin) ──────────────────

async function loginUser({ username, password, deviceId, fingerprintHash, deviceInfo = {} }) {
  const result = await query(
    `SELECT user_id, username, password_hash, role, tenant_id, display_name, is_active,
            email, otp_enabled
     FROM users WHERE username = $1`,
    [username]
  );
  const user = result.rows[0];
  if (!user || !user.is_active) throw new AppError('Username atau password salah.', 401);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError('Username atau password salah.', 401);

  await query(`UPDATE users SET last_login_at = NOW() WHERE user_id = $1`, [user.user_id]);

  // Legacy / OTP disabled → issue access token directly
  if (!user.otp_enabled || !user.email) {
    const payload = {
      userId:   user.user_id,
      username: user.username,
      role:     user.role,
      tenantId: user.tenant_id,
      name:     user.display_name,
    };
    const token = signAccessToken(payload);
    sendLoginAlert({ ...payload, loginAt: new Date() }).catch(() => {});
    return { token, user: payload, requiresOtp: false };
  }

  // OTP enabled: check if device is already trusted
  if (deviceId) {
    const { trusted } = await deviceSvc.checkTrustedDevice(
      user.user_id,
      deviceId,
      fingerprintHash || null
    );
    if (trusted) {
      const tokens = await issueFullTokens(user, deviceId);
      sendLoginAlert({ ...tokens.user, loginAt: new Date() }).catch(() => {});
      return { ...tokens, requiresOtp: false };
    }
  }

  // Untrusted device → generate and send OTP
  const otpPlain = otpSvc.generateOTP();
  const otpHash  = await otpSvc.hashOTP(otpPlain);
  await otpSvc.storeOTP(user.user_id, otpHash, deviceInfo.ipAddress || null);

  sendOTPEmail(user.email, otpPlain, user.display_name).catch((err) => {
    logger.warn('[OTP] sendOTPEmail failed:', err.message);
  });

  const tempToken = signTempToken({
    userId:          user.user_id,
    deviceId:        deviceId || null,
    fingerprintHash: fingerprintHash || null,
  });

  return {
    requiresOtp:  true,
    tempToken,
    maskedEmail:  maskEmail(user.email),
  };
}

// ── Verify OTP + issue full tokens ────────────────────────────────────────────

async function verifyOtpAndLogin({ tempToken, otpCode, deviceId, fingerprintHash, deviceInfo = {} }) {
  const decoded       = verifyTempToken(tempToken);
  const userId        = decoded.userId;
  const finalDeviceId = deviceId || decoded.deviceId;
  const finalFp       = fingerprintHash || decoded.fingerprintHash || null;

  const result = await query(
    `SELECT user_id, username, role, tenant_id, display_name, email, is_active
     FROM users WHERE user_id = $1`,
    [userId]
  );
  const user = result.rows[0];
  if (!user || !user.is_active) throw new AppError('Akun tidak ditemukan.', 404);

  try {
    const valid = await otpSvc.verifyOTP(userId, otpCode);
    if (!valid) throw new AppError('Kode OTP salah.', 401);
  } catch (e) {
    if (e instanceof AppError) throw e;
    const msgMap = {
      OTP_NOT_FOUND:             'Kode OTP tidak ditemukan atau sudah digunakan.',
      OTP_EXPIRED:               'Kode OTP sudah kedaluwarsa. Silakan login ulang.',
      OTP_MAX_ATTEMPTS_EXCEEDED: 'Terlalu banyak percobaan OTP. Silakan login ulang.',
    };
    throw new AppError(msgMap[e.message] || 'Verifikasi OTP gagal.', 401);
  }

  if (finalDeviceId) {
    await deviceSvc.registerTrustedDevice(userId, finalDeviceId, finalFp, {
      deviceName: deviceInfo.deviceName || 'Unknown Device',
      browser:    deviceInfo.browser    || '-',
      ipAddress:  deviceInfo.ipAddress  || null,
    });
  }

  const tokens = await issueFullTokens(user, finalDeviceId);

  sendLoginAlert({ ...tokens.user, loginAt: new Date() }).catch(() => {});

  if (user.email) {
    sendNewDeviceAlert(user.email, {
      browser:   deviceInfo.browser   || '-',
      ipAddress: deviceInfo.ipAddress || '-',
      loginAt:   new Date(),
    }).catch(() => {});
  }

  return tokens;
}

// ── Refresh access token ──────────────────────────────────────────────────────

async function refreshAccessToken(rawRefreshToken) {
  if (!rawRefreshToken) throw new AppError('Refresh token diperlukan.', 400);
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const record    = await deviceSvc.verifyRefreshToken(tokenHash);
  if (!record) throw new AppError('Refresh token tidak valid atau sudah kedaluwarsa.', 401);

  const payload = {
    userId:   record.user_id,
    username: record.username,
    role:     record.role,
    tenantId: record.tenant_id,
    name:     record.display_name,
    deviceId: record.device_id,
  };
  const token = signAccessToken(payload);
  return { token, user: payload };
}

// ── Logout / device management ────────────────────────────────────────────────

async function logoutDevice(userId, deviceId) {
  if (deviceId) await deviceSvc.revokeDevice(userId, deviceId);
}

async function getUserDevices(userId) {
  return deviceSvc.listUserDevices(userId);
}

async function revokeUserDevice(userId, deviceId) {
  await deviceSvc.revokeDevice(userId, deviceId);
}

// ── Customer auth ─────────────────────────────────────────────────────────────

const customerOtpSvc    = require('./customer_otp.service');
const customerDeviceSvc = require('./customer_device.service');
const { sendOTP, sendGreeting } = require('../wa/wa.service');

async function registerCustomer({ full_name, phone_number, email, gender, birth_date }) {
  const exists = await query(
    `SELECT customer_id FROM customers WHERE phone_number = $1`,
    [phone_number]
  );
  if (exists.rows.length > 0) {
    throw new AppError('Nomor telepon sudah terdaftar, silakan login.', 409);
  }

  const result = await query(
    `INSERT INTO customers (full_name, phone_number, email, gender, birth_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING customer_id, full_name, phone_number, email, gender, birth_date, registered_at`,
    [full_name, phone_number, email || null, gender, birth_date || null]
  );
  const customer = result.rows[0];
  const token    = issueCustomerToken(customer);

  fireWebhook('/webhook/customer-registered', {
    customer_id:  customer.customer_id,
    full_name:    customer.full_name,
    phone_number: customer.phone_number,
    email:        customer.email || null,
    gender:       customer.gender || null,
  });

  // Kirim greeting WA — fire-and-forget, tidak blocking
  sendGreeting(phone_number, full_name).catch(() => {});

  return { token, customer };
}

async function loginCustomer({ phone_number, deviceId = null, deviceInfo = {} }) {
  const result = await query(
    `SELECT customer_id, full_name, phone_number, email, gender, registered_at
     FROM customers WHERE phone_number = $1 AND is_active = TRUE`,
    [phone_number]
  );
  const customer = result.rows[0];
  if (!customer) throw new AppError('Akun tidak ditemukan. Silakan daftar terlebih dahulu.', 404);

  // Cek trusted device — skip OTP bila device masih terpercaya dan belum logout
  if (deviceId) {
    const trusted = await customerDeviceSvc.checkTrustedDevice(customer.customer_id, deviceId);
    if (trusted) {
      const token = issueCustomerToken(customer, deviceId);
      return { requiresOtp: false, token, customer };
    }
  }

  // Generate dan kirim OTP via WA
  const otpPlain = customerOtpSvc.generateOTP();
  const otpHash  = await customerOtpSvc.hashOTP(otpPlain);
  await customerOtpSvc.storeOTP(
    customer.customer_id,
    otpHash,
    deviceInfo.ipAddress || null
  );

  const waResult = await sendOTP(phone_number, otpPlain, customer.full_name);
  if (waResult.status === 'FAILED') {
    throw new AppError('Gagal mengirim OTP via WhatsApp. Pastikan nomor aktif dan coba lagi.', 503);
  }

  const tempToken = signTempToken({
    customerId: customer.customer_id,
    deviceId:   deviceId || null,
  });

  return {
    requiresOtp: true,
    tempToken,
    maskedPhone: phone_number.slice(0, 4) + '****' + phone_number.slice(-3),
  };
}

async function verifyCustomerOtp({ tempToken, otpCode, deviceId, deviceInfo = {} }) {
  const decoded      = verifyTempToken(tempToken);
  const customerId   = decoded.customerId;
  if (!customerId) throw new AppError('Token tidak valid.', 401);

  const finalDeviceId = deviceId || decoded.deviceId;

  const result = await query(
    `SELECT customer_id, full_name, phone_number, email, gender, registered_at
     FROM customers WHERE customer_id = $1 AND is_active = TRUE`,
    [customerId]
  );
  const customer = result.rows[0];
  if (!customer) throw new AppError('Akun tidak ditemukan.', 404);

  try {
    const valid = await customerOtpSvc.verifyOTP(customerId, otpCode);
    if (!valid) throw new AppError('Kode OTP salah.', 401);
  } catch (e) {
    if (e instanceof AppError) throw e;
    const msgMap = {
      OTP_NOT_FOUND:             'Kode OTP tidak ditemukan atau sudah digunakan.',
      OTP_EXPIRED:               'Kode OTP sudah kedaluwarsa. Silakan login ulang.',
      OTP_MAX_ATTEMPTS_EXCEEDED: 'Terlalu banyak percobaan OTP. Silakan login ulang.',
    };
    throw new AppError(msgMap[e.message] || 'Verifikasi OTP gagal.', 401);
  }

  // Daftarkan device sebagai trusted setelah OTP berhasil
  if (finalDeviceId) {
    await customerDeviceSvc.registerTrustedDevice(customerId, finalDeviceId, {
      deviceName: deviceInfo.deviceName || 'Unknown Device',
      browser:    deviceInfo.browser    || '-',
      ipAddress:  deviceInfo.ipAddress  || null,
    });
  }

  const token = issueCustomerToken(customer, finalDeviceId);
  return { token, customer };
}

async function logoutCustomer(customerId, deviceId) {
  if (deviceId) {
    await customerDeviceSvc.revokeDevice(customerId, deviceId);
  }
}

function issueCustomerToken(customer, deviceId) {
  return jwt.sign(
    {
      customerId: customer.customer_id,
      role:       'CUSTOMER',
      phone:      customer.phone_number,
      ...(deviceId && { deviceId }),
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.CUSTOMER_TOKEN_EXPIRES_IN || '24h' }
  );
}

module.exports = {
  loginUser,
  verifyOtpAndLogin,
  refreshAccessToken,
  logoutDevice,
  getUserDevices,
  revokeUserDevice,
  registerCustomer,
  loginCustomer,
  verifyCustomerOtp,
  logoutCustomer,
};
