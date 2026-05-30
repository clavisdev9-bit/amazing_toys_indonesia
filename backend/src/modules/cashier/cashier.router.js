'use strict';

const express  = require('express');
const { body, query: qv } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate }  = require('../../middlewares/validate.middleware');
const cashierSvc    = require('./cashier.service');
const ordersSvc     = require('../orders/orders.service');

const router = express.Router();

// GET /api/v1/cashier/recap — cashier's own daily recap
router.get('/recap',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [qv('date').optional().isDate()],
  validate,
  async (req, res, next) => {
    try {
      const cashierId = req.query.cashier_id && req.user.role !== 'CASHIER'
        ? req.query.cashier_id
        : req.user.userId;
      const data = await cashierSvc.getDailyRecap(cashierId, req.query.date);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/cashier/transactions — transactions handled today (scoped to caller's session)
// CASHIER: always sees only their own transactions.
// LEADER/ADMIN: sees their own by default; pass ?cashier_id=<uuid> to inspect another cashier.
router.get('/transactions',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [qv('date').optional().isDate(), qv('cashier_id').optional().isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const cashierId = req.user.role === 'CASHIER'
        ? req.user.userId
        : (req.query.cashier_id || null);
      const data = await cashierSvc.getCashierTransactions(cashierId, req.query.date);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/cashier/orders — cashier creates a walk-in order
router.post('/orders',
  authenticate, authorize('CASHIER', 'LEADER'),
  [
    body('items').isArray({ min: 1 }).withMessage('Keranjang tidak boleh kosong.'),
    body('items.*.product_id').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await ordersSvc.createOrderByCashier(req.user.userId, req.body.items);
      res.status(201).json({ success: true, message: 'Pesanan berhasil dibuat.', data });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/cashier/orders/:transactionId/items — cashier adds item to existing PENDING transaction
router.post('/orders/:transactionId/items',
  authenticate, authorize('CASHIER', 'LEADER'),
  [
    body('product_id').notEmpty(),
    body('quantity').isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await ordersSvc.addItemToTransaction(
        req.params.transactionId,
        req.user.userId,
        req.body.product_id,
        req.body.quantity,
      );
      res.json({ success: true, message: 'Produk berhasil ditambahkan.', data });
    } catch (err) { next(err); }
  }
);

module.exports = router;
