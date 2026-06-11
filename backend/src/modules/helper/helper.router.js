'use strict';

const express  = require('express');
const { body, query: qv, param } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const helperSvc = require('./helper.service');

const router = express.Router();

/**
 * GET /api/v1/helper/products
 * Helper views all products for their booth.
 */
router.get('/products',
  authenticate, authorize('HELPER'),
  async (req, res, next) => {
    try {
      const data = await helperSvc.getBoothProducts(req.user.tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

/**
 * GET /api/v1/helper/orders
 * Helper lists orders for their booth (optionally filtered).
 */
router.get('/orders',
  authenticate, authorize('HELPER'),
  [
    qv('status').optional().isString(),
    qv('date').optional().isDate(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await helperSvc.getBoothOrders(req.user.tenantId, {
        status: req.query.status,
        date:   req.query.date,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

/**
 * GET /api/v1/helper/orders/:transactionId
 * Helper views a single order detail.
 */
router.get('/orders/:transactionId',
  authenticate, authorize('HELPER'),
  async (req, res, next) => {
    try {
      const data = await helperSvc.getBoothOrder(req.params.transactionId, req.user.tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

/**
 * POST /api/v1/helper/orders
 * Helper creates a RESERVED order for a customer.
 * Body: { items: [{ product_id, qty }], customer_phone?, customer_id? }
 */
router.post('/orders',
  authenticate, authorize('HELPER'),
  [
    body('items').isArray({ min: 1 }).withMessage('Pilih minimal satu produk.'),
    body('items.*.product_id').notEmpty().withMessage('product_id wajib diisi.'),
    body('items.*.qty').isInt({ min: 1 }).withMessage('qty minimal 1.'),
    body('customer_phone')
      .optional({ nullable: true })
      .matches(/^(08|\+628)\d{8,11}$/).withMessage('Format nomor telepon tidak valid.'),
    body('customer_id')
      .optional({ nullable: true })
      .isUUID().withMessage('customer_id harus UUID.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await helperSvc.createHelperOrder({
        helperId:       req.user.userId,
        helperTenantId: req.user.tenantId,
        items:          req.body.items,
        customerPhone:  req.body.customer_phone || null,
        customerId:     req.body.customer_id    || null,
      });
      res.status(201).json({ success: true, message: 'Order berhasil dibuat.', data });
    } catch (err) { next(err); }
  },
);

/**
 * POST /api/v1/helper/orders/:transactionId/cancel
 * Helper cancels a RESERVED order.
 */
router.post('/orders/:transactionId/cancel',
  authenticate, authorize('HELPER'),
  async (req, res, next) => {
    try {
      const data = await helperSvc.cancelHelperOrder(
        req.params.transactionId,
        req.user.userId,
        req.user.tenantId,
      );
      res.json({ success: true, message: 'Order dibatalkan.', data });
    } catch (err) { next(err); }
  },
);

/**
 * POST /api/v1/helper/orders/:transactionId/resend-wa
 * CR-036: Kirim ulang WA ke customer (atau nomor baru di body).
 * Hanya jika token belum expire & status RESERVED / WAITING_PAYMENT.
 */
router.post('/orders/:transactionId/resend-wa',
  authenticate, authorize('HELPER'),
  [
    body('phone')
      .optional({ nullable: true })
      .matches(/^(08|\+628)\d{8,11}$/).withMessage('Format nomor telepon tidak valid.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await helperSvc.resendWa(
        req.params.transactionId,
        req.user.userId,
        req.body.phone || null,
      );
      res.json({ success: true, message: 'WA dikirim ulang.', data });
    } catch (err) { next(err); }
  },
);

/**
 * POST /api/v1/helper/orders/:transactionId/handover
 * Helper confirms physical handover → HANDED_OVER → COMPLETED.
 */
router.post('/orders/:transactionId/handover',
  authenticate, authorize('HELPER'),
  async (req, res, next) => {
    try {
      const data = await helperSvc.handoverOrder(
        req.params.transactionId,
        req.user.userId,
        req.user.tenantId,
      );
      res.json({ success: true, message: 'Serah terima berhasil.', data });
    } catch (err) { next(err); }
  },
);

// ── CR-040: HELPER_APPROVE endpoints ─────────────────────────────────────────

/**
 * GET /api/v1/helper/approval-queue
 * Returns all PENDING_APPROVAL orders for this helper's booth.
 */
router.get('/approval-queue',
  authenticate, authorize('HELPER'),
  async (req, res, next) => {
    try {
      const data = await helperSvc.getApprovalQueue(req.user.tenantId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

/**
 * POST /api/v1/helper/orders/:transactionId/approve
 * Approve a PENDING_APPROVAL order → deduct stock, start timer, status = PENDING.
 * Body: { note? }
 */
router.post('/orders/:transactionId/approve',
  authenticate, authorize('HELPER'),
  [
    param('transactionId').notEmpty(),
    body('note').optional({ nullable: true }).isString().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await helperSvc.approveOrder(
        req.params.transactionId,
        req.user.userId,
        req.user.tenantId,
        req.body.note || null,
      );
      res.json({ success: true, message: 'Pesanan disetujui.', data });
    } catch (err) { next(err); }
  },
);

/**
 * POST /api/v1/helper/orders/:transactionId/reject
 * Reject a PENDING_APPROVAL order → status = CANCELLED (no stock to restore).
 * Body: { reason? }
 */
router.post('/orders/:transactionId/reject',
  authenticate, authorize('HELPER'),
  [
    param('transactionId').notEmpty(),
    body('reason').optional({ nullable: true }).isString().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await helperSvc.rejectOrder(
        req.params.transactionId,
        req.user.userId,
        req.user.tenantId,
        req.body.reason || undefined,
      );
      res.json({ success: true, message: 'Pesanan ditolak.', data });
    } catch (err) { next(err); }
  },
);

/**
 * POST /api/v1/helper/orders/:transactionId/items/:itemId/approve
 * Approve a single item, optionally with reduced quantity.
 * Body: { approved_qty?, note? }
 */
router.post('/orders/:transactionId/items/:itemId/approve',
  authenticate, authorize('HELPER'),
  [
    param('transactionId').notEmpty(),
    param('itemId').isUUID().withMessage('itemId harus UUID.'),
    body('approved_qty').optional({ nullable: true }).isInt({ min: 1 }).withMessage('approved_qty minimal 1.'),
    body('note').optional({ nullable: true }).isString().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await helperSvc.approveItem(
        req.params.transactionId,
        req.params.itemId,
        req.user.userId,
        req.user.tenantId,
        req.body.approved_qty ?? null,
        req.body.note || null,
      );
      res.json({ success: true, message: 'Item disetujui.', data });
    } catch (err) { next(err); }
  },
);

/**
 * POST /api/v1/helper/orders/:transactionId/items/:itemId/reject
 * Reject a single item.
 * Body: { reason? }
 */
router.post('/orders/:transactionId/items/:itemId/reject',
  authenticate, authorize('HELPER'),
  [
    param('transactionId').notEmpty(),
    param('itemId').isUUID().withMessage('itemId harus UUID.'),
    body('reason').optional({ nullable: true }).isString().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await helperSvc.rejectItem(
        req.params.transactionId,
        req.params.itemId,
        req.user.userId,
        req.user.tenantId,
        req.body.reason || null,
      );
      res.json({ success: true, message: 'Item ditolak.', data });
    } catch (err) { next(err); }
  },
);

module.exports = router;
