'use strict';

const express  = require('express');
const { body, param } = require('express-validator');
const { validate }    = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const authService     = require('./auth.service');

const router = express.Router();

// ── Customer routes ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Customer self-registration
 */
router.post('/register',
  [
    body('full_name').trim().notEmpty().withMessage('Nama lengkap wajib diisi.'),
    body('phone_number').optional().trim()
      .matches(/^(08|\+628)\d{8,11}$/).withMessage('Format nomor telepon tidak valid.'),
    body('email').optional().trim().isEmail().withMessage('Format email tidak valid.'),
    body().custom((_, { req }) => {
      if (!req.body.phone_number && !req.body.email)
        throw new Error('Nomor HP atau email wajib diisi.');
      return true;
    }),
    body('gender').isIn(['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY']).withMessage('Gender tidak valid.'),
    body('birth_date').optional({ checkFalsy: true }).isDate({ format: 'YYYY-MM-DD' }).withMessage('Format tanggal lahir tidak valid.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await authService.registerCustomer(req.body);
      const message = data.identifierType === 'email'
        ? 'Kode OTP dikirim ke email Anda.'
        : 'Kode OTP dikirim ke WhatsApp Anda.';
      res.status(202).json({ success: true, message, data });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/auth/register/verify-otp
 * Step 2 registrasi: verifikasi OTP WA → akun aktif → issue token
 * Body: { tempToken, otpCode }
 */
router.post('/register/verify-otp',
  [
    body('tempToken').notEmpty().withMessage('tempToken wajib diisi.'),
    body('otpCode').trim().notEmpty().isLength({ min: 6, max: 6 }).isNumeric()
      .withMessage('Kode OTP harus 6 digit angka.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await authService.verifyRegisterOtp(req.body);
      res.status(201).json({ success: true, message: 'Registrasi berhasil. Selamat datang!', data });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/auth/login/customer
 * Step 1: masukkan nomor telepon ATAU email → kirim OTP via WA/Email (atau langsung token bila trusted device)
 * Body: { phone_number?, email?, deviceId? }  — phone_number ATAU email wajib ada
 * Response A — trusted device: { requiresOtp: false, token, customer }
 * Response B — OTP dikirim:    { requiresOtp: true, tempToken, maskedIdentifier, identifierType }
 */
router.post('/login/customer',
  [
    body('phone_number').optional().trim(),
    body('email').optional().trim().isEmail().withMessage('Format email tidak valid.'),
    body().custom((_, { req }) => {
      if (!req.body.phone_number && !req.body.email)
        throw new Error('Nomor HP atau email wajib diisi.');
      return true;
    }),
    body('deviceId').optional().isUUID().withMessage('deviceId harus berformat UUID.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { phone_number, email, deviceId, deviceInfo } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
      const data = await authService.loginCustomer({
        phone_number: phone_number || null,
        email:        email        || null,
        deviceId:     deviceId    || null,
        deviceInfo:   { ...(deviceInfo || {}), ipAddress },
      });
      const message = data.requiresOtp
        ? (data.identifierType === 'email' ? 'OTP dikirim ke email Anda.' : 'OTP dikirim ke WhatsApp Anda.')
        : 'Login berhasil.';
      res.json({ success: true, message, data });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/auth/verify-otp/customer
 * Step 2: verifikasi OTP → issue token
 * Body: { tempToken, otpCode, deviceId?, deviceInfo? }
 */
router.post('/verify-otp/customer',
  [
    body('tempToken').notEmpty().withMessage('tempToken wajib diisi.'),
    body('otpCode').trim().notEmpty().isLength({ min: 6, max: 6 }).isNumeric()
      .withMessage('Kode OTP harus 6 digit angka.'),
    body('deviceId').optional().isUUID().withMessage('deviceId harus berformat UUID.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { tempToken, otpCode, deviceId, deviceInfo } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
      const data = await authService.verifyCustomerOtp({
        tempToken,
        otpCode,
        deviceId:   deviceId || null,
        deviceInfo: { ...(deviceInfo || {}), ipAddress },
      });
      res.json({ success: true, message: 'Login berhasil.', data });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/auth/logout/customer
 * Hapus trusted device sehingga login berikutnya wajib OTP kembali.
 * Body: { deviceId? }
 */
router.post('/logout/customer',
  authenticate,
  async (req, res, next) => {
    try {
      const deviceId = req.body.deviceId || req.user.deviceId || null;
      await authService.logoutCustomer(req.user.customerId, deviceId);
      res.json({ success: true, message: 'Logout berhasil.' });
    } catch (err) { next(err); }
  }
);

// ── Internal staff login ──────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/login
 * Internal user login.
 * Body: { username, password, deviceId?, fingerprintHash?, deviceInfo? }
 * Response A — OTP disabled / trusted device:
 *   { requiresOtp: false, token, refreshToken?, user }
 * Response B — OTP required (new device):
 *   { requiresOtp: true, tempToken, maskedEmail }
 */
router.post('/login',
  [
    body('username').trim().notEmpty(),
    body('password').notEmpty(),
    body('deviceId').optional().isUUID().withMessage('deviceId harus berformat UUID.'),
    body('fingerprintHash').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { username, password, deviceId, fingerprintHash, deviceInfo } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
      const data = await authService.loginUser({
        username,
        password,
        deviceId:        deviceId || null,
        fingerprintHash: fingerprintHash || null,
        deviceInfo:      { ...(deviceInfo || {}), ipAddress },
      });
      res.json({ success: true, message: data.requiresOtp ? 'OTP dikirim ke email.' : 'Login berhasil.', data });
    } catch (err) { next(err); }
  }
);

// ── OTP verification ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/verify-otp
 * Body: { tempToken, otpCode, deviceId?, fingerprintHash?, deviceInfo? }
 */
router.post('/verify-otp',
  [
    body('tempToken').notEmpty().withMessage('tempToken wajib diisi.'),
    body('otpCode').trim().notEmpty().isLength({ min: 6, max: 6 }).isNumeric()
      .withMessage('Kode OTP harus 6 digit angka.'),
    body('deviceId').optional().isUUID().withMessage('deviceId harus berformat UUID.'),
    body('fingerprintHash').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { tempToken, otpCode, deviceId, fingerprintHash, deviceInfo } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
      const data = await authService.verifyOtpAndLogin({
        tempToken,
        otpCode,
        deviceId:        deviceId || null,
        fingerprintHash: fingerprintHash || null,
        deviceInfo:      { ...(deviceInfo || {}), ipAddress },
      });
      res.json({ success: true, message: 'Login berhasil.', data });
    } catch (err) { next(err); }
  }
);

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/refresh
 * Body: { refreshToken }
 */
router.post('/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token wajib diisi.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await authService.refreshAccessToken(req.body.refreshToken);
      res.json({ success: true, message: 'Token diperbarui.', data });
    } catch (err) { next(err); }
  }
);

// ── Authenticated endpoints ───────────────────────────────────────────────────

/**
 * POST /api/v1/auth/logout
 * Revokes current device's refresh token + trusted device entry.
 * Body: { deviceId? } — falls back to req.user.deviceId from JWT
 */
router.post('/logout',
  authenticate,
  async (req, res, next) => {
    try {
      const deviceId = req.body.deviceId || req.user.deviceId || null;
      await authService.logoutDevice(req.user.userId, deviceId);
      res.json({ success: true, message: 'Logout berhasil.' });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/auth/devices
 * Returns list of trusted devices for the authenticated user.
 */
router.get('/devices',
  authenticate,
  async (req, res, next) => {
    try {
      const devices = await authService.getUserDevices(req.user.userId);
      res.json({ success: true, data: devices });
    } catch (err) { next(err); }
  }
);

/**
 * DELETE /api/v1/auth/devices/:deviceId
 * Revokes a specific trusted device.
 */
router.delete('/devices/:deviceId',
  authenticate,
  [
    param('deviceId').isUUID().withMessage('deviceId tidak valid.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      await authService.revokeUserDevice(req.user.userId, req.params.deviceId);
      res.json({ success: true, message: 'Perangkat berhasil dicabut.' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
