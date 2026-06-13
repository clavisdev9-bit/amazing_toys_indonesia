'use strict';

const express  = require('express');
const { body, query: qv } = require('express-validator');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { validate }  = require('../../middlewares/validate.middleware');
const leaderSvc     = require('./leader.service');
const { broadcastToCashier } = require('../../ws/websocket');

const router = express.Router();

// GET /api/v1/leader/dashboard — KPI dashboard
router.get('/dashboard',
  authenticate, authorize('LEADER', 'ADMIN'),
  [qv('date').optional().isDate()],
  validate,
  async (req, res, next) => {
    try {
      const data = await leaderSvc.getDashboardKPIs(req.query.date);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/leader/sales — detailed sales report
router.get('/sales',
  authenticate, authorize('LEADER', 'ADMIN'),
  [
    qv('start_date').optional().isDate(),
    qv('end_date').optional().isDate(),
    qv('tenant_id').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await leaderSvc.getSalesReport({
        startDate: req.query.start_date,
        endDate:   req.query.end_date,
        tenantId:  req.query.tenant_id,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/leader/visitors
router.get('/visitors',
  authenticate, authorize('LEADER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = await leaderSvc.getVisitorReport({
        startDate: req.query.start_date,
        endDate:   req.query.end_date,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/leader/returns
router.get('/returns',
  authenticate, authorize('LEADER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = await leaderSvc.listReturnRequests(req.query.status);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// POST /api/v1/leader/returns — create return request (cashier or leader)
router.post('/returns',
  authenticate, authorize('CASHIER', 'LEADER', 'ADMIN'),
  [
    body('transaction_id').trim().notEmpty(),
    body('reason').trim().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await leaderSvc.createReturnRequest({
        transactionId: req.body.transaction_id,
        requestedBy:   req.user.userId,
        reason:        req.body.reason,
      });
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// PATCH /api/v1/leader/returns/:requestId — approve or reject
router.patch('/returns/:requestId',
  authenticate, authorize('LEADER', 'ADMIN'),
  [
    body('approved').isBoolean(),
    body('rejection_note').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const data = await leaderSvc.processReturnRequest({
        requestId:     req.params.requestId,
        leaderId:      req.user.userId,
        approved:      req.body.approved,
        rejectionNote: req.body.rejection_note,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/leader/delete-requests — list delete requests (default: PENDING)
router.get('/delete-requests',
  authenticate, authorize('LEADER', 'ADMIN'),
  [qv('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED'])],
  validate,
  async (req, res, next) => {
    try {
      const data = await leaderSvc.listDeleteRequests(req.query.status || 'PENDING');
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// GET /api/v1/leader/discrepancies — PAID transactions with amount_charged != total_amount
router.get('/discrepancies',
  authenticate, authorize('LEADER', 'ADMIN'),
  [qv('date').optional().isDate()],
  validate,
  async (req, res, next) => {
    try {
      const data = await leaderSvc.getDiscrepancies(req.query.date);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// PATCH /api/v1/leader/delete-requests/:id — approve or reject
router.patch('/delete-requests/:id',
  authenticate, authorize('LEADER', 'ADMIN'),
  [
    body('action').isIn(['approve', 'reject']).withMessage('action harus approve atau reject.'),
    body('reason').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { action, reason } = req.body;
      const result = await leaderSvc.reviewDeleteRequest(
        parseInt(req.params.id, 10),
        req.user.userId,
        action,
        reason,
      );
      // Notify the cashier who submitted the request
      if (result.cashier_id) {
        broadcastToCashier(result.cashier_id, {
          event: 'delete_request:resolved',
          data: { request_id: result.request_id, action, product_id: result.product_id },
        });
      }
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

module.exports = router;
