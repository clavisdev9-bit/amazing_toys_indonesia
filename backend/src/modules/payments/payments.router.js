'use strict';

const express  = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate }   = require('../../middlewares/validate.middleware');
const paymentsSvc    = require('./payments.service');

const router = express.Router();

/**
 * GET /api/v1/payments/lookup/:transactionId
 * Cashier looks up PENDING transaction before payment
 */
router.get('/lookup/:transactionId',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = await paymentsSvc.lookupTransaction(req.params.transactionId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/payments/process
 * Cashier processes payment for a transaction
 */
router.post('/process',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [
    body('transaction_id').trim().notEmpty().withMessage('Transaction ID wajib diisi.'),
    body('payment_method')
      .isIn(['CASH', 'QRIS', 'EDC', 'TRANSFER'])
      .withMessage('Metode pembayaran tidak valid.'),
    body('cash_received').optional().isFloat({ gt: 0 }),
    body('payment_ref').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await paymentsSvc.processPayment({
        transactionId: req.body.transaction_id,
        paymentMethod: req.body.payment_method,
        cashReceived:  req.body.cash_received,
        paymentRef:    req.body.payment_ref,
        cashierId:     req.user.userId,
      });
      res.json({ success: true, message: 'Pembayaran berhasil.', data });
    } catch (err) { next(err); }
  }
);

module.exports = router;
