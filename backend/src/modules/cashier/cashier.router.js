'use strict';

const fs     = require('fs');
const path   = require('path');
const express  = require('express');
const { body, query: qv } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate }  = require('../../middlewares/validate.middleware');
const cashierSvc    = require('./cashier.service');
const paymentsSvc   = require('../payments/payments.service');
const ordersSvc     = require('../orders/orders.service');
const { AppError }  = require('../../middlewares/error.middleware');
const { broadcastToLeaders } = require('../../ws/websocket');

const _SYSTEM_CONFIG_PATH = path.join(__dirname, '../../../data/system-config.json');

function _getOrderMode() {
  try {
    const cfg = JSON.parse(fs.readFileSync(_SYSTEM_CONFIG_PATH, 'utf8'));
    return cfg.order_mode || 'HELPER_INPUT';
  } catch { return 'HELPER_INPUT'; }
}

const router = express.Router();

// GET /api/v1/cashier/customer-lookup?phone=08xx — CR-060/CR-061: preview info customer by phone
// HELPER juga diizinkan (CR-061: digunakan di /helper order panel)
router.get('/customer-lookup',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN', 'HELPER'),
  [qv('phone').notEmpty().withMessage('phone wajib diisi.')],
  validate,
  async (req, res, next) => {
    try {
      const customer = await cashierSvc.lookupCustomerByPhone(req.query.phone);
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer tidak ditemukan.' });
      }
      res.json({ success: true, data: customer });
    } catch (err) { next(err); }
  }
);

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

// POST /api/v1/cashier/orders — cashier creates a walk-in order (POS Langsung)
// Works in both SELF_ORDER and HELPER_INPUT mode — walk-in at cashier counter is
// always a valid flow regardless of booth order_mode.
router.post('/orders',
  authenticate, authorize('CASHIER', 'LEADER'),
  [
    body('items').isArray({ min: 1 }).withMessage('Keranjang tidak boleh kosong.'),
    body('items.*.product_id').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('customerPhone').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { items, customerPhone, voucherCode, skipProductPromo } = req.body;
      const data = await ordersSvc.createOrderByCashier(
        req.user.userId, items, voucherCode || null, customerPhone || null, !!skipProductPromo
      );
      res.status(201).json({ success: true, message: 'Pesanan berhasil dibuat.', data });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/cashier/orders/:transactionId/voucher — apply voucher to existing PENDING transaction
router.post('/orders/:transactionId/voucher',
  authenticate, authorize('CASHIER', 'LEADER'),
  [body('voucherCode').notEmpty().withMessage('Kode voucher wajib diisi.')],
  validate,
  async (req, res, next) => {
    try {
      const data = await ordersSvc.applyVoucherToTransaction(
        req.params.transactionId,
        req.user.userId,
        req.body.voucherCode,
      );
      res.json({ success: true, message: 'Voucher berhasil diterapkan.', data });
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
      if (_getOrderMode() === 'HELPER_INPUT' && req.user.role === 'CASHIER') {
        throw new AppError('Kasir tidak bisa mengubah item dalam mode HELPER_INPUT.', 403);
      }
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

// DELETE /api/v1/cashier/orders/:transactionId — kasir membatalkan transaksi aktif
router.delete('/orders/:transactionId',
  authenticate, authorize('CASHIER', 'LEADER'),
  async (req, res, next) => {
    try {
      const data = await ordersSvc.cancelOrderByCashier(
        req.params.transactionId,
        req.user.userId,
      );
      res.json({ success: true, message: 'Transaksi berhasil dibatalkan.', data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/cashier/queue — list RESERVED + PENDING orders waiting for cashier (Model C)
// CR-053: includes PENDING pre-orders from any date (no date filter for pre-orders)
router.get('/queue',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [qv('date').optional().isDate()],
  validate,
  async (req, res, next) => {
    try {
      const data = await cashierSvc.getPaymentQueue(req.query.date);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/cashier/preorder-queue — CR-053: dedicated list of PENDING pre-orders (no date filter)
router.get('/preorder-queue',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = await cashierSvc.getPreorderPaymentQueue();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/cashier/expired — list EXPIRED transactions for a given date (default today)
router.get('/expired',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [qv('date').optional().isDate()],
  validate,
  async (req, res, next) => {
    try {
      const data = await cashierSvc.getExpiredQueue(req.query.date);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/cashier/delete-requests — cashier submits a delete request
router.post('/delete-requests',
  authenticate, authorize('CASHIER'),
  [
    body('product_id').notEmpty().withMessage('product_id wajib diisi.'),
    body('product_name').trim().notEmpty().withMessage('product_name wajib diisi.'),
    body('qty').isInt({ min: 1 }).withMessage('qty harus angka positif.'),
    body('subtotal').isNumeric().withMessage('subtotal harus angka.'),
    body('transaction_id').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { product_id, product_name, qty, subtotal, transaction_id } = req.body;
      const cashierName = req.user.name || req.user.username || 'Kasir';
      const request = await cashierSvc.createDeleteRequest(req.user.userId, cashierName, {
        transaction_id, product_id, product_name, qty, subtotal,
      });
      broadcastToLeaders({ event: 'delete_request:new', data: request });
      res.status(201).json({ success: true, data: { request_id: request.request_id, status: 'PENDING' } });
    } catch (err) { next(err); }
  }
);

// ── Group Checkout endpoints ──────────────────────────────────────────────────

/**
 * GET /api/v1/cashier/customer-transactions
 * Cari TRX aktif milik customer berdasarkan nomor HP atau nama.
 * Query: ?phone=08xx atau ?name=Budi (bisa keduanya)
 */
router.get('/customer-transactions',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [
    qv('phone').optional().isString(),
    qv('name').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await cashierSvc.getCustomerActiveTrx({
        phone: req.query.phone || null,
        name:  req.query.name  || null,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

/**
 * POST /api/v1/cashier/group-checkout
 * Merge satu atau beberapa TRX (multi-booth) lalu proses pembayaran sekaligus.
 * Jika hanya 1 TRX, diperlakukan sebagai pembayaran tunggal (Jalur A).
 */
router.post('/group-checkout',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [
    body('transaction_ids').isArray({ min: 1 }).withMessage('Pilih minimal 1 transaksi.'),
    body('transaction_ids.*').isString().notEmpty().withMessage('transaction_id tidak valid.'),
    body('payment_method')
      .isIn(['CASH', 'QRIS', 'EDC', 'TRANSFER'])
      .withMessage('Metode pembayaran tidak valid.'),
    body('cash_received').optional().isFloat({ gt: 0 }),
    body('payment_ref').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { transaction_ids, payment_method, cash_received, payment_ref } = req.body;
      const data = await cashierSvc.groupCheckout({
        transactionIds: transaction_ids,
        cashierId:      req.user.userId,
        paymentMethod:  payment_method,
        cashReceived:   cash_received,
        paymentRef:     payment_ref,
      });
      res.json({ success: true, message: 'Pembayaran berhasil.', data });
    } catch (err) { next(err); }
  },
);

/**
 * GET /api/v1/cashier/groups
 * List group invoice hari ini.
 */
router.get('/groups',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = await cashierSvc.listGroups();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

/**
 * GET /api/v1/cashier/groups/:groupId
 * Detail group beserta semua TRX dan item-nya.
 * groupId bisa berupa UUID atau group_code (GRP-xxx).
 */
router.get('/groups/:groupId',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = await cashierSvc.getGroupDetail(req.params.groupId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
);

// GET /api/v1/cashier/edc-log — list EDC transactions for reconciliation
router.get('/edc-log',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [qv('date').optional().isDate(), qv('cashier_id').optional().isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const cashierId = req.user.role === 'CASHIER'
        ? req.user.userId
        : (req.query.cashier_id || null);
      const data = await cashierSvc.getEdcLog(cashierId, req.query.date);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/cashier/shift-report — comprehensive printable shift handover report
router.get('/shift-report',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [qv('date').optional().isDate(), qv('cashier_id').optional().isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const cashierId = req.user.role === 'CASHIER'
        ? req.user.userId
        : (req.query.cashier_id || null);
      const data = await cashierSvc.getShiftReport(cashierId, req.query.date);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/cashier/delete-requests/pending — list this cashier's pending delete requests
router.get('/delete-requests/pending',
  authenticate, authorize('CASHIER'),
  async (req, res, next) => {
    try {
      const data = await cashierSvc.getPendingDeleteRequests(req.user.userId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

module.exports = router;
