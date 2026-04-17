'use strict';

const express = require('express');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { AppError } = require('../../middlewares/error.middleware');
const adminSvc = require('./admin.service');
const { broadcastToAll } = require('../../ws/websocket');

const router    = express.Router();
const adminOnly = [authenticate, authorize('ADMIN')];

// ── Users ─────────────────────────────────────────────────────────────────────

router.get('/users', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.listUsers({ role: req.query.role });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/users', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.createUser(req.body);
    res.status(201).json({ success: true, message: 'User berhasil dibuat.', data });
  } catch (err) { next(err); }
});

router.patch('/users/:userId', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.updateUser(req.params.userId, req.body);
    res.json({ success: true, message: 'User berhasil diperbarui.', data });
  } catch (err) { next(err); }
});

router.post('/users/:userId/reset-password', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.resetPassword(req.params.userId, req.body);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.delete('/users/:userId', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.deleteUser(req.params.userId);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

// ── Products — image upload must be before /:productId ────────────────────────

router.post('/products/upload-image', ...adminOnly, async (req, res, next) => {
  try {
    const { base64 } = req.body;
    if (!base64) throw new AppError('Field base64 wajib diisi.', 422);
    const url = await adminSvc.saveProductImage(base64);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
});

router.get('/products', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.adminListProducts({
      tenantId:       req.query.tenant_id,
      search:         req.query.search,
      includeInactive: req.query.include_inactive !== 'false',
      page:           parseInt(req.query.page  || '1',  10),
      limit:          parseInt(req.query.limit || '20', 10),
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/products', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.adminCreateProduct(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.patch('/products/:productId', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.adminUpdateProduct(req.params.productId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/products/:productId', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.adminDeleteProduct(req.params.productId);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

// ── Tenants (Booth Master Data) ───────────────────────────────────────────────

router.get('/tenants', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.adminListTenants({
      search:          req.query.search,
      includeInactive: req.query.include_inactive !== 'false',
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/tenants', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.adminCreateTenant(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.patch('/tenants/:tenantId', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.adminUpdateTenant(req.params.tenantId, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── Audit Log ─────────────────────────────────────────────────────────────────

router.get('/audit-log', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.getAuditLogs({
      entityType: req.query.entity_type,
      actorRole:  req.query.actor_role,
      search:     req.query.search,
      dateFrom:   req.query.date_from,
      dateTo:     req.query.date_to,
      page:       parseInt(req.query.page  || '1',  10),
      limit:      parseInt(req.query.limit || '50', 10),
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── Upload logo (stores file, saves url into config) ─────────────────────────

router.post('/config/upload-logo', ...adminOnly, async (req, res, next) => {
  try {
    const { base64 } = req.body;
    if (!base64) throw new AppError('Field base64 wajib diisi.', 422);
    const url     = await adminSvc.saveProductImage(base64);
    const updated = await adminSvc.saveSystemConfig({ logo_url: url });
    res.json({ success: true, data: { url, config: updated } });
  } catch (err) { next(err); }
});

// ── System Configuration ──────────────────────────────────────────────────────

router.get('/config', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await adminSvc.getSystemConfig();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/config', ...adminOnly, async (req, res, next) => {
  try {
    const prev = await adminSvc.getSystemConfig();
    const data = await adminSvc.saveSystemConfig(req.body);
    // Broadcast maintenance change to all connected clients immediately
    if (prev.maintenance_mode !== data.maintenance_mode) {
      broadcastToAll({ event: 'MAINTENANCE_CHANGED', maintenance_mode: data.maintenance_mode });
    }
    res.json({ success: true, message: 'Konfigurasi disimpan.', data });
  } catch (err) { next(err); }
});

// ── Integration ───────────────────────────────────────────────────────────────

router.get('/integration', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await adminSvc.getIntegrationConfig();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/integration', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.saveIntegrationConfig(req.body);
    res.json({ success: true, message: 'Konfigurasi integrasi disimpan.', data });
  } catch (err) { next(err); }
});

module.exports = router;
