'use strict';

const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { query }  = require('../../config/database');
const { param }  = require('express-validator');
const { validate } = require('../../middlewares/validate.middleware');

const validProductId = param('product_id')
  .trim().notEmpty().isLength({ max: 20 }).withMessage('product_id tidak valid.');

const router = express.Router();

// All wishlist routes require customer auth
router.use(authenticate, authorize('CUSTOMER'));

/**
 * GET /api/v1/wishlist
 * Returns all product_ids in the current customer's wishlist.
 */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT product_id FROM wishlists WHERE customer_id = $1 ORDER BY created_at DESC',
      [req.user.customerId]
    );
    res.json({ success: true, data: rows.map(r => r.product_id) });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/wishlist/:product_id
 * Add product to wishlist (idempotent).
 */
router.post('/:product_id',
  [validProductId],
  validate,
  async (req, res, next) => {
    try {
      await query(
        `INSERT INTO wishlists (customer_id, product_id)
         VALUES ($1, $2)
         ON CONFLICT (customer_id, product_id) DO NOTHING`,
        [req.user.customerId, req.params.product_id]
      );
      res.status(201).json({ success: true });
    } catch (err) { next(err); }
  }
);

/**
 * DELETE /api/v1/wishlist/:product_id
 * Remove product from wishlist.
 */
router.delete('/:product_id',
  [validProductId],
  validate,
  async (req, res, next) => {
    try {
      await query(
        'DELETE FROM wishlists WHERE customer_id = $1 AND product_id = $2',
        [req.user.customerId, req.params.product_id]
      );
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

module.exports = router;
