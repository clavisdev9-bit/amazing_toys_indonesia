'use strict';

const express  = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate } = require('../../middlewares/validate.middleware');
const { param }    = require('express-validator');
const ordersSvc    = require('./orders.service');

const router = express.Router();

/**
 * POST /api/v1/orders
 * Customer creates an order (checkout)
 */
router.post('/',
  authenticate, authorize('CUSTOMER'),
  [
    body('items').isArray({ min: 1 }).withMessage('Keranjang tidak boleh kosong.'),
    body('items.*.product_id').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await ordersSvc.createOrder(req.user.customerId, req.body.items);
      res.status(201).json({ success: true, message: 'Pesanan berhasil dibuat.', data });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/orders/my
 * Customer views their own order history
 */
router.get('/my',
  authenticate, authorize('CUSTOMER'),
  async (req, res, next) => {
    try {
      const data = await ordersSvc.getCustomerOrders(req.user.customerId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/orders/:transactionId
 * Get transaction detail (Customer, Cashier, Tenant, Leader)
 */
router.get('/:transactionId',
  authenticate,
  async (req, res, next) => {
    try {
      const requesterId = req.user.customerId || req.user.userId;
      const data = await ordersSvc.getTransaction(
        req.params.transactionId,
        requesterId,
        req.user.role
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

/**
 * PATCH /api/v1/orders/:transactionId/items/:productId
 * Customer updates quantity of one item in their own PENDING order
 */
router.patch('/:transactionId/items/:productId',
  authenticate, authorize('CUSTOMER'),
  [
    body('quantity').isInt({ min: 1 }).withMessage('Quantity minimal 1.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await ordersSvc.updateItemQuantity(
        req.params.transactionId,
        req.user.customerId,
        req.params.productId,
        req.body.quantity,
      );
      res.json({ success: true, message: 'Qty berhasil diperbarui.', data });
    } catch (err) { next(err); }
  }
);

/**
 * DELETE /api/v1/orders/:transactionId
 * Customer cancels their own PENDING order
 */
router.delete('/:transactionId',
  authenticate, authorize('CUSTOMER'),
  async (req, res, next) => {
    try {
      const data = await ordersSvc.cancelOrder(req.params.transactionId, req.user.customerId);
      res.json({ success: true, message: 'Pesanan dibatalkan.', data });
    } catch (err) { next(err); }
  }
);

module.exports = router;
