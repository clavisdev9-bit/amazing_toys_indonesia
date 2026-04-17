'use strict';

const express  = require('express');
const { query: qv, param, body } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate }  = require('../../middlewares/validate.middleware');
const productsSvc   = require('./products.service');

const router = express.Router();

// GET /api/v1/products — public browse (Customer)
router.get('/',
  authenticate,
  [
    qv('tenant_id').optional().isString(),
    qv('category').optional().isString(),
    qv('search').optional().isString(),
    qv('in_stock_only').optional().isBoolean(),
    qv('page').optional().isInt({ min: 1 }).toInt(),
    qv('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
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
router.get('/categories', authenticate, async (req, res, next) => {
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

module.exports = router;
