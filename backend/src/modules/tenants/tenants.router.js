'use strict';

const express = require('express');
const { authenticate, authorize, ownTenantOnly } = require('../../middlewares/auth.middleware');
const tenantsSvc = require('./tenants.service');

const router = express.Router();

// GET /api/v1/tenants
router.get('/', authenticate, async (req, res, next) => {
  try {
    const data = await tenantsSvc.listTenants({
      floor:      req.query.floor,
      search:     req.query.search,
      activeOnly: req.query.active_only !== 'false',
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/v1/tenants/:tenantId
router.get('/:tenantId', authenticate, async (req, res, next) => {
  try {
    const data = await tenantsSvc.getTenantById(req.params.tenantId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/v1/tenants/:tenantId/products
router.get('/:tenantId/products', authenticate, async (req, res, next) => {
  try {
    const data = await tenantsSvc.getTenantProducts(req.params.tenantId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/v1/tenants — Leader/Admin
router.post('/', authenticate, authorize('LEADER', 'ADMIN'), async (req, res, next) => {
  try {
    const data = await tenantsSvc.createTenant(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

// PATCH /api/v1/tenants/:tenantId — Leader/Admin or own tenant
router.patch('/:tenantId',
  authenticate, authorize('LEADER', 'ADMIN', 'TENANT'), ownTenantOnly,
  async (req, res, next) => {
    try {
      const data = await tenantsSvc.updateTenant(req.params.tenantId, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

module.exports = router;
