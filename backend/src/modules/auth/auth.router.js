'use strict';

const express  = require('express');
const { body } = require('express-validator');
const { validate }   = require('../../middlewares/validate.middleware');
const authService    = require('./auth.service');

const router = express.Router();

/**
 * POST /api/v1/auth/register
 * Customer self-registration (phone + name + gender)
 */
router.post('/register',
  [
    body('full_name').trim().notEmpty().withMessage('Nama lengkap wajib diisi.'),
    body('phone_number')
      .trim().notEmpty()
      .matches(/^(08|\+628)\d{8,11}$/).withMessage('Format nomor telepon tidak valid.'),
    body('gender').isIn(['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY']).withMessage('Gender tidak valid.'),
    body('email').optional().isEmail().withMessage('Format email tidak valid.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await authService.registerCustomer(req.body);
      res.status(201).json({ success: true, message: 'Registrasi berhasil.', data });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/auth/login/customer
 * Customer login via phone number
 */
router.post('/login/customer',
  [
    body('phone_number').trim().notEmpty().withMessage('Nomor telepon wajib diisi.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await authService.loginCustomer(req.body);
      res.json({ success: true, message: 'Login berhasil.', data });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/auth/login
 * Internal user login (Cashier / Tenant / Leader)
 */
router.post('/login',
  [
    body('username').trim().notEmpty(),
    body('password').notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await authService.loginUser(req.body);
      res.json({ success: true, message: 'Login berhasil.', data });
    } catch (err) { next(err); }
  }
);

module.exports = router;
