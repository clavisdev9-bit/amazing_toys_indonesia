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

// ── Products — image upload and sync-odoo must be before /:productId ─────────

// ── Bulk upload (must be before /:productId) ─────────────────────────────────
const { bulkUploadProducts } = require('./bulkUpload.controller');
router.post('/products/bulk-upload', ...adminOnly, bulkUploadProducts);

router.post('/products/sync-odoo', ...adminOnly, async (req, res, next) => {
  try {
    const { force = false } = req.body;
    const result = await adminSvc.syncOdooProducts(force);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ success: false, message: err.message });
    next(err);
  }
});

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
      tenantId:        req.query.tenant_id,
      search:          req.query.search,
      includeInactive: req.query.include_inactive !== 'false',
      page:            parseInt(req.query.page                          || '1',  10),
      limit:           parseInt(req.query.page_size || req.query.limit  || '20', 10),
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

// ── Transactions (integration sweep) ─────────────────────────────────────────

router.get('/transactions', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.listTransactions({
      status: req.query.status,
      limit:  parseInt(req.query.limit || '200', 10),
    });
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

// ── Stock Sync ────────────────────────────────────────────────────────────────

const { syncToOdoo, getSyncHistory } = require('../stock-sync/presentation/controllers/SyncController');

router.post('/stock-sync',         ...adminOnly, syncToOdoo);
router.get('/stock-sync/history',  ...adminOnly, getSyncHistory);

// ── Odoo lookups ──────────────────────────────────────────────────────────────

router.get('/odoo/categories', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await adminSvc.getOdooProductCategories();
    res.json({ success: true, data });
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

// ── Scheduler ─────────────────────────────────────────────────────────────────

const schedulerService         = require('../scheduler/SchedulerService');
const jobRunLog                = require('../scheduler/JobRunLogRepository');
const { initializeScheduledJobs } = require('../scheduler/JobBootstrap');
const productSyncJob           = require('../scheduler/jobs/ProductSyncJob');
const stockSyncJob             = require('../scheduler/jobs/StockSyncJob');

/** GET /admin/scheduler/status — current jobs + latest run per job */
router.get('/scheduler/status', ...adminOnly, async (_req, res, next) => {
  try {
    const [jobs, latest] = await Promise.all([
      Promise.resolve(schedulerService.listJobs()),
      jobRunLog.latestPerJob(),
    ]);
    res.json({ success: true, data: { jobs, latest_runs: latest } });
  } catch (err) { next(err); }
});

/** GET /admin/scheduler/history — paginated run history */
router.get('/scheduler/history', ...adminOnly, async (req, res, next) => {
  try {
    const result = await jobRunLog.history({
      jobName: req.query.job_name,
      limit:   parseInt(req.query.limit  || '50',  10),
      offset:  parseInt(req.query.offset || '0',   10),
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

/**
 * POST /admin/scheduler/config
 * Body: { job: "product_sync" | "stock_sync", interval_minutes: number }
 * Persists the new interval and hot-reloads the affected job.
 */
router.post('/scheduler/config', ...adminOnly, async (req, res, next) => {
  try {
    const { job, interval_minutes } = req.body;
    if (!['product_sync', 'stock_sync'].includes(job)) {
      throw new AppError('job must be "product_sync" or "stock_sync".', 422);
    }
    const mins = parseInt(interval_minutes, 10);
    if (!Number.isFinite(mins) || mins < 1) {
      throw new AppError('interval_minutes must be an integer >= 1.', 422);
    }

    // Persist to integration config
    const configKey = job === 'product_sync'
      ? 'odoo_product_sync_interval_min'
      : 'odoo_stock_sync_interval_min';
    await adminSvc.saveIntegrationConfig({ [configKey]: mins });

    // Hot-reload: remove old job, register new one
    const jobModule  = job === 'product_sync' ? productSyncJob : stockSyncJob;
    schedulerService.removeJob(jobModule.JOB_NAME);
    schedulerService.registerJob(
      jobModule.JOB_NAME,
      mins,
      () => jobModule.execute({
        triggeredBy:    'scheduler',
        configSnapshot: { interval_minutes: mins },
      }),
    );

    // Calculate approximate next-run time
    const nextRun = new Date(Date.now() + mins * 60 * 1000).toISOString();
    res.json({ success: true, data: { job: jobModule.JOB_NAME, interval_minutes: mins, next_run: nextRun } });
  } catch (err) { next(err); }
});

/**
 * POST /admin/scheduler/run
 * Body: { job: "product_sync" | "stock_sync" }
 * Manually trigger a job immediately (for testing / admin use).
 */
router.post('/scheduler/run', ...adminOnly, async (req, res, next) => {
  try {
    const { job } = req.body;
    if (!['product_sync', 'stock_sync'].includes(job)) {
      throw new AppError('job must be "product_sync" or "stock_sync".', 422);
    }
    const jobModule = job === 'product_sync' ? productSyncJob : stockSyncJob;
    const result = await jobModule.execute({ triggeredBy: 'manual' });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;
