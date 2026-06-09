'use strict';

const express       = require('express');
const { body }      = require('express-validator');
const rateLimit     = require('express-rate-limit');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate }  = require('../../middlewares/validate.middleware');
const { param }     = require('express-validator');
const ordersSvc     = require('./orders.service');
const { query }     = require('../../config/database');
const { AppError }  = require('../../middlewares/error.middleware');

const router = express.Router();

// Rate limiter untuk endpoint publik (tanpa auth): 30 req / 1 menit per IP
const publicTokenLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, message: 'Terlalu banyak permintaan. Coba lagi dalam 1 menit.' },
});

/**
 * GET /api/v1/orders/:txnId/public?token=<public_token>
 * CR-036: Endpoint publik — TANPA JWT.
 * Customer membuka link WA dan melihat QR tanpa login.
 */
router.get('/:txnId/public',
  publicTokenLimiter,
  async (req, res, next) => {
    try {
      const { txnId }    = req.params;
      const publicToken  = req.query.token;

      if (!publicToken) {
        throw new AppError('Token tidak ditemukan.', 400);
      }

      // Validasi token + expiry + status — satu query, parameterized
      const txResult = await query(
        `SELECT t.transaction_id, t.status, t.total_amount, t.qr_payload,
                t.expires_at, t.public_token_exp, t.public_token,
                t.subtotal_amount, t.tax_rate, t.tax_amount,
                ten.tenant_name, ten.booth_location
         FROM transactions t
         JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
         JOIN tenants ten ON ten.tenant_id = ti.tenant_id
         WHERE t.transaction_id = $1
           AND t.public_token    = $2
         LIMIT 1`,
        [txnId, publicToken],
      );

      const txn = txResult.rows[0];

      if (!txn) {
        // Jangan bedakan "not found" vs "token salah" — cegah enumeration
        throw new AppError('Link tidak valid atau sudah kedaluwarsa.', 404);
      }

      // Token expired?
      if (txn.public_token_exp && new Date(txn.public_token_exp) < new Date()) {
        throw new AppError('Link sudah kedaluwarsa. Minta petugas booth untuk membuat order baru.', 410);
      }

      // Order cancelled / expired?
      if (['CANCELLED', 'EXPIRED'].includes(txn.status)) {
        throw new AppError('Pesanan ini sudah dibatalkan atau kedaluwarsa.', 410);
      }

      // Ambil items — TIDAK mengekspos data customer
      const itemsResult = await query(
        `SELECT p.product_name, ti.quantity, ti.unit_price
         FROM transaction_items ti
         JOIN products p ON p.product_id = ti.product_id
         WHERE ti.transaction_id = $1`,
        [txnId],
      );

      const paid = ['PAID', 'HANDED_OVER', 'COMPLETED'].includes(txn.status);

      // Response — TANPA nama/HP customer
      res.json({
        success: true,
        data: {
          txnId:        txn.transaction_id,
          boothName:    txn.tenant_name,
          boothLocation: txn.booth_location,
          status:       txn.status,
          totalAmount:  parseFloat(txn.total_amount),
          expiresAt:    txn.public_token_exp,
          qrData:       paid ? null : txn.qr_payload,   // sembunyikan QR setelah PAID
          paid,
          items: itemsResult.rows.map(r => ({
            name:      r.product_name,
            qty:       r.quantity,
            unitPrice: parseFloat(r.unit_price),
          })),
        },
      });
    } catch (err) { next(err); }
  },
);

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
    body('voucher_code').optional({ nullable: true }).isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await ordersSvc.createOrder(
        req.user.customerId,
        req.body.items,
        req.body.voucher_code || null
      );
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
 * DELETE /api/v1/orders/:transactionId/items/:productId
 * Customer removes one item from their own PENDING order
 */
router.delete('/:transactionId/items/:productId',
  authenticate, authorize('CUSTOMER'),
  async (req, res, next) => {
    try {
      const data = await ordersSvc.removeOrderItem(
        req.params.transactionId,
        req.user.customerId,
        req.params.productId,
      );
      res.json({ success: true, message: 'Item berhasil dihapus.', data });
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

/**
 * POST /api/v1/orders/:transactionId/partial-process
 * Customer triggers partial checkout: approved items proceed, pending items go to wishlist.
 */
router.post('/:transactionId/partial-process',
  authenticate, authorize('CUSTOMER'),
  async (req, res, next) => {
    try {
      const result = await ordersSvc.partialProcessOrder(
        req.params.transactionId,
        req.user.customerId,
      );
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

module.exports = router;
