'use strict';

const express = require('express');
const { body, query: qv, param } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const preorderSvc = require('./preorder.service');

const router = express.Router();

/**
 * GET /api/v1/preorder
 * Admin/Helper: list semua transaksi pre-order.
 * Query: ?status=awaiting|shipped|arrived|handover|completed|active|all
 */
router.get('/',
  authenticate, authorize('ADMIN', 'HELPER', 'LEADER'),
  [
    qv('status').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await preorderSvc.getPreorderList({ status: req.query.status });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

/**
 * PATCH /api/v1/preorder/:txnId/ship
 * Admin: input resi pengiriman → AWAITING_SHIPMENT → SHIPPED.
 * Body: { courier: string, tracking_number: string }
 */
router.patch('/:txnId/ship',
  authenticate, authorize('ADMIN', 'LEADER'),
  [
    param('txnId').isString().notEmpty(),
    body('courier').isString().notEmpty().withMessage('Nama ekspedisi wajib diisi.'),
    body('tracking_number').isString().notEmpty().withMessage('Nomor resi wajib diisi.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await preorderSvc.updateShipment(
        req.params.txnId,
        { courier: req.body.courier, tracking_number: req.body.tracking_number },
        req.user.userId,
        req.user.role,
      );
      res.json({ success: true, message: 'Status diperbarui ke SHIPPED.', data });
    } catch (err) { next(err); }
  },
);

/**
 * PATCH /api/v1/preorder/:txnId/arrived
 * Admin: konfirmasi barang sudah sampai di Indonesia → SHIPPED → ARRIVED.
 */
router.patch('/:txnId/arrived',
  authenticate, authorize('ADMIN', 'LEADER'),
  [
    param('txnId').isString().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await preorderSvc.confirmArrived(req.params.txnId, req.user.userId, req.user.role);
      res.json({ success: true, message: 'Status diperbarui ke ARRIVED.', data });
    } catch (err) { next(err); }
  },
);

/**
 * PATCH /api/v1/preorder/:txnId/handover
 * Helper/Admin: serahkan barang ke customer → ARRIVED → PREORDER_HANDOVER → COMPLETED.
 */
router.patch('/:txnId/handover',
  authenticate, authorize('HELPER', 'ADMIN', 'LEADER'),
  [
    param('txnId').isString().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await preorderSvc.handover(
        req.params.txnId,
        req.user.userId,
        req.user.role,
      );
      res.json({ success: true, message: 'Barang berhasil diserahkan. Transaksi COMPLETED.', data });
    } catch (err) { next(err); }
  },
);

module.exports = router;
