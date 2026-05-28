'use strict';

const express  = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate }    = require('../../middlewares/validate.middleware');
const logger          = require('../../config/logger');
const bcaQrisSvc      = require('./bca-qris.service');

const router        = express.Router(); // mounted at /api/v1/payments/bca
const webhookRouter = express.Router(); // mounted at /api/v1/webhook

// ── Generate QRIS ─────────────────────────────────────────────────────────────
// POST /api/v1/payments/bca/generate-qr
// Called by cashier or after customer checkout to create a payment QR code.

router.post('/generate-qr',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [
    body('order_id').trim().notEmpty().withMessage('order_id wajib diisi.'),
    body('amount').isFloat({ gt: 0 }).withMessage('amount harus lebih dari 0.'),
    body('fee_amount').optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await bcaQrisSvc.generateQris({
        orderId:   req.body.order_id,
        amount:    req.body.amount,
        feeAmount: req.body.fee_amount ? String(parseFloat(req.body.fee_amount).toFixed(2)) : '0.00',
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// ── Query status ──────────────────────────────────────────────────────────────
// POST /api/v1/payments/bca/query-status
// Polling fallback when webhook hasn't arrived within 30 s.

router.post('/query-status',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [
    body('order_id').trim().notEmpty().withMessage('order_id wajib diisi.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await bcaQrisSvc.queryStatus(req.body.order_id);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// ── Refund ────────────────────────────────────────────────────────────────────
// POST /api/v1/payments/bca/refund

router.post('/refund',
  authenticate, authorize('LEADER', 'ADMIN'),
  [
    body('order_id').trim().notEmpty().withMessage('order_id wajib diisi.'),
    body('refund_amount').isFloat({ gt: 0 }).withMessage('refund_amount harus lebih dari 0.'),
    body('reason').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await bcaQrisSvc.refundTransaction({
        orderId:      req.body.order_id,
        refundAmount: req.body.refund_amount,
        reason:       req.body.reason,
      });
      res.json({ success: true, message: 'Refund berhasil diproses.', data });
    } catch (err) { next(err); }
  }
);

// ── BCA Webhook ───────────────────────────────────────────────────────────────
// POST /api/v1/webhook/bca-qris   (public — no auth, BCA calls this endpoint)
// Reply 200 immediately to avoid BCA retry timeout (< 10 s).

webhookRouter.post('/bca-qris', async (req, res) => {
  res.json({ responseCode: '2000000', responseMessage: 'Successful' });
  bcaQrisSvc.handleWebhook(req.body).catch((err) => {
    logger.error('[BCA QRIS] Async webhook handler failed', { err: err.message });
  });
});

module.exports = { paymentsRouter: router, webhookRouter };
