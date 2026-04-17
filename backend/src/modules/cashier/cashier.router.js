'use strict';

const express  = require('express');
const { query: qv } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate }  = require('../../middlewares/validate.middleware');
const cashierSvc    = require('./cashier.service');

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

// GET /api/v1/cashier/transactions — transactions handled today
router.get('/transactions',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [qv('date').optional().isDate()],
  validate,
  async (req, res, next) => {
    try {
      const data = await cashierSvc.getCashierTransactions(req.query.date);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

module.exports = router;
