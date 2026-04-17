'use strict';

const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { sendEReceiptEmail } = require('./receipts.service');
const { AppError } = require('../../middlewares/error.middleware');

const router = express.Router();

router.post('/send-email',
  authenticate,
  authorize('CASHIER', 'LEADER', 'ADMIN'),
  [
    body('to').isEmail().withMessage('Alamat email tidak valid.'),
    body('transactionId').notEmpty().withMessage('transactionId wajib diisi.'),
    body('customerName').notEmpty().withMessage('customerName wajib diisi.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new AppError('Konfigurasi email belum diatur di server.', 503);
      }
      await sendEReceiptEmail(req.body);
      res.json({ success: true, message: 'E-receipt berhasil dikirim.' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
