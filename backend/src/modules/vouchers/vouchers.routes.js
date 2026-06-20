'use strict';

const express  = require('express');
const { body, query: qv } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate }  = require('../../middlewares/validate.middleware');
const voucherSvc    = require('./vouchers.service');

// ── Customer / Cashier routes (/api/v1/vouchers) ─────────────────────────────

const router = express.Router();

/**
 * POST /api/v1/vouchers/validate
 * Validate a voucher code against the current cart.
 * Auth: CUSTOMER, CASHIER, LEADER
 */
router.post('/validate',
  authenticate, authorize('CUSTOMER', 'CASHIER', 'LEADER'),
  [
    body('code').trim().notEmpty().withMessage('Kode voucher wajib diisi.'),
    body('cart_total').isFloat({ min: 0 }).withMessage('cart_total harus angka positif.'),
    body('tenant_ids').isArray().withMessage('tenant_ids harus array.'),
    body('items').optional().isArray(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const customerId = req.user.customerId || null;
      // items: [{ price, quantity, tenant_id }] — provided by frontend for tenant-scoped discount
      const items = (req.body.items || []).map(i => ({
        price:     parseFloat(i.price || 0),
        quantity:  parseInt(i.quantity, 10) || 0,
        tenant_id: i.tenant_id || '',
      }));
      const result = await voucherSvc.validateVoucher({
        code:      req.body.code,
        customerId,
        cartTotal: parseFloat(req.body.cart_total),
        tenantIds: req.body.tenant_ids || [],
        items,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      // Surface structured voucher errors as 400 with error code
      if (err.statusCode === 400 || err.status === 400) {
        return res.status(400).json({
          success: false,
          error: { code: err.message, minPurchase: err.minPurchase },
        });
      }
      next(err);
    }
  }
);

/**
 * GET /api/v1/vouchers/active-promos?product_ids=P001-T001,P002-T001
 * Ambil active product promo rules untuk product_ids di cart.
 * Public — tidak perlu auth karena info promosi bersifat publik.
 */
router.get('/active-promos',
  [
    qv('product_ids')
      .optional()
      .isString()
      .withMessage('product_ids harus string CSV.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const raw = (req.query.product_ids || '').trim();
      const productIds = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
      const rules = await voucherSvc.getActiveProductPromos(productIds);
      res.json({ success: true, data: rules });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/vouchers/apply
 * Internal: record voucher usage after order is created.
 * Auth: ADMIN only (called by integration or internal flows)
 */
router.post('/apply',
  authenticate, authorize('ADMIN'),
  [
    body('code').trim().notEmpty(),
    body('transaction_id').notEmpty(),
    body('discount_amount').isFloat({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await voucherSvc.applyVoucher({
        code:           req.body.code,
        transactionId:  req.body.transaction_id,
        customerId:     req.body.customer_id || null,
        discountAmount: parseFloat(req.body.discount_amount),
      });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

// ── Admin routes (/api/v1/admin/vouchers) ────────────────────────────────────

const adminRouter = express.Router();

adminRouter.get('/',
  authenticate, authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const activeOnly = req.query.active === 'true';
      const data = await voucherSvc.listVouchers({ activeOnly });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// ── Admin: Product Promo Vouchers (/api/v1/admin/vouchers/product-promos) ────
// MUST be registered BEFORE /:code to avoid Express capturing 'product-promos' as a code param

adminRouter.get('/product-promos',
  authenticate, authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const activeOnly = req.query.active === 'true';
      const data = await voucherSvc.listProductPromoVouchers({ activeOnly });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

adminRouter.post('/product-promos',
  authenticate, authorize('ADMIN'),
  [
    body('code').trim().notEmpty().withMessage('Kode voucher wajib diisi.'),
    body('valid_from').isISO8601().withMessage('valid_from harus format ISO8601.'),
    body('valid_until').isISO8601().withMessage('valid_until harus format ISO8601.'),
    body('rules').isArray({ min: 1 }).withMessage('Minimal 1 rule produk.'),
    body('rules.*.buy_product_id').notEmpty().withMessage('buy_product_id wajib.'),
    body('rules.*.buy_qty').isInt({ min: 1 }).withMessage('buy_qty minimal 1.'),
    body('rules.*.free_qty').isInt({ min: 1 }).withMessage('free_qty minimal 1.'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await voucherSvc.createProductPromoVoucher({
        ...req.body,
        created_by: req.user.userId || req.user.username,
      });
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// ── Generic voucher CRUD (/:code must come AFTER specific sub-paths above) ────

adminRouter.get('/:code',
  authenticate, authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const data = await voucherSvc.getVoucherByCode(req.params.code);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

adminRouter.post('/',
  authenticate, authorize('ADMIN'),
  [
    body('code').trim().notEmpty(),
    body('discount_type').isIn(['PERCENT', 'FIXED']),
    body('discount_value').isFloat({ min: 0.01 }),
    body('valid_from').isISO8601(),
    body('valid_until').isISO8601(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await voucherSvc.createVoucher({
        ...req.body,
        created_by: req.user.userId || req.user.username,
      });
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }
);

adminRouter.patch('/:code',
  authenticate, authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const data = await voucherSvc.updateVoucher(req.params.code, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

adminRouter.delete('/:code',
  authenticate, authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const data = await voucherSvc.deactivateVoucher(req.params.code);
      res.json({ success: true, message: 'Voucher dinonaktifkan.', data });
    } catch (err) { next(err); }
  }
);

module.exports = { voucherRouter: router, adminVoucherRouter: adminRouter };
