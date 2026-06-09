'use strict';

const express  = require('express');
const { query: qv, param, body } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate }  = require('../../middlewares/validate.middleware');
const productsSvc   = require('./products.service');
const { broadcastProductAvailable } = require('../../ws/websocket');

const router = express.Router();

// GET /api/v1/products — public browse (Customer)
router.get('/',
  [
    qv('tenant_id').optional().isString(),
    qv('category').optional().isString(),
    qv('search').optional().isString(),
    qv('in_stock_only').optional().isBoolean(),
    qv('page').optional().isInt({ min: 1 }).toInt(),
    qv('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await productsSvc.listProducts({
        tenantId:    req.query.tenant_id,
        category:    req.query.category,
        search:      req.query.search,
        inStockOnly: req.query.in_stock_only === 'true',
        page:        req.query.page  || 1,
        limit:       req.query.limit || 20,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/products/categories
router.get('/categories', async (req, res, next) => {
  try {
    const data = await productsSvc.listCategories();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/v1/products/barcode/:barcode — scan lookup
router.get('/barcode/:barcode',
  authenticate,
  async (req, res, next) => {
    try {
      const data = await productsSvc.getProductByBarcode(req.params.barcode);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/products/:productId
router.get('/:productId', authenticate, async (req, res, next) => {
  try {
    const data = await productsSvc.getProductById(req.params.productId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/v1/products — Leader/Admin only
router.post('/',
  authenticate, authorize('LEADER', 'ADMIN'),
  [
    body('product_id').trim().notEmpty(),
    body('product_name').trim().notEmpty(),
    body('category').trim().notEmpty(),
    body('price').isFloat({ gt: 0 }),
    body('tenant_id').trim().notEmpty(),
    body('barcode').trim().notEmpty(),
    body('stock_quantity').isInt({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await productsSvc.createProduct(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// PATCH /api/v1/products/:productId — Leader/Admin only
router.patch('/:productId',
  authenticate, authorize('LEADER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = await productsSvc.updateProduct(req.params.productId, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// PATCH /api/v1/products/:productId/hold — toggle is_on_hold (Leader/Admin)
// Body: { is_on_hold: boolean }
// Side-effect: broadcasts PRODUCT_AVAILABLE via WebSocket when un-holding.
router.patch('/:productId/hold',
  authenticate, authorize('LEADER', 'ADMIN'),
  [body('is_on_hold').isBoolean().withMessage('is_on_hold harus boolean.')],
  validate,
  async (req, res, next) => {
    try {
      const { is_on_hold } = req.body;
      const { product, wasOnHold } = await productsSvc.toggleProductHold(
        req.params.productId,
        is_on_hold
      );

      // Broadcast WS only on true → false transition (stok tersedia kembali)
      if (wasOnHold && is_on_hold === false) {
        broadcastProductAvailable(product.product_id, product.product_name);
      }

      res.json({
        success: true,
        message: is_on_hold
          ? `Produk "${product.product_name}" ditahan (on hold).`
          : `Produk "${product.product_name}" tersedia kembali.`,
        data: product,
      });
    } catch (err) { next(err); }
  }
);

module.exports = router;
