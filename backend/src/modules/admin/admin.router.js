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
  const { force = false } = req.body;
  const integrationUrl = process.env.INTEGRATION_WEBHOOK_URL || 'http://localhost:4000';
  const secret         = process.env.WEBHOOK_SECRET || '';

  let resp;
  try {
    resp = await fetch(`${integrationUrl}/sync/push/products`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
      body:    JSON.stringify({ force }),
      signal:  AbortSignal.timeout(120_000), // 2-min ceiling; products sync can be slow
    });
  } catch (err) {
    // Network-level failure (integration service down, timeout, DNS)
    const label =
      err.name === 'TimeoutError'
        ? 'Sync timed out — integration service took > 2 minutes'
        : `Cannot reach integration service at ${integrationUrl}: ${err.message}`;
    return next(new AppError(label, 502));
  }

  let body;
  try {
    body = await resp.json();
  } catch {
    return next(new AppError(`Integration service returned non-JSON (HTTP ${resp.status})`, 502));
  }

  if (!resp.ok) {
    const status = resp.status === 409 ? 409 : 502;
    return res.status(status).json({ success: false, message: body.message || 'Integration service error' });
  }

  res.json(body);
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
    broadcastToAll({ event: 'PRODUCT_UPDATED' });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

router.patch('/products/bulk-category', ...adminOnly, async (req, res, next) => {
  try {
    const { category } = req.body;
    if (!category) throw new AppError('category wajib diisi.', 422);
    const data = await adminSvc.adminBulkUpdateCategory(category);
    broadcastToAll({ event: 'PRODUCT_UPDATED' });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.patch('/products/bulk-odoo-category', ...adminOnly, async (req, res, next) => {
  try {
    const { odoo_categ_id, odoo_categ_name } = req.body;
    if (!odoo_categ_id) throw new AppError('odoo_categ_id wajib diisi.', 422);
    const data = await adminSvc.adminBulkUpdateOdooCategory(odoo_categ_id, odoo_categ_name);
    broadcastToAll({ event: 'PRODUCT_UPDATED' });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.patch('/products/bulk-description', ...adminOnly, async (req, res, next) => {
  try {
    const { description } = req.body;
    if (!description) throw new AppError('description wajib diisi.', 422);
    const data = await adminSvc.adminBulkUpdateDescription(description);
    broadcastToAll({ event: 'PRODUCT_UPDATED' });
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
});

router.patch('/products/:productId', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.adminUpdateProduct(req.params.productId, req.body);
    broadcastToAll({ event: 'PRODUCT_UPDATED' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.delete('/products/:productId', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.adminDeleteProduct(req.params.productId);
    broadcastToAll({ event: 'PRODUCT_UPDATED' });
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

/**
 * POST /admin/transactions/resync
 * Push all PAID transactions that are not yet in integration_xref to Odoo.
 * Fire-and-forget per transaction; returns count immediately.
 */
router.post('/transactions/resync', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.resyncUnsyncedTransactions();
    res.json({ success: true, ...data });
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

// ── Odoo connection wizard ────────────────────────────────────────────────────

/**
 * POST /admin/odoo/verify
 * Authenticate against Odoo and return accessible companies.
 * Body: { base_url, db, login, password }
 */
router.post('/odoo/verify', ...adminOnly, async (req, res, next) => {
  try {
    const { base_url, db, login, password } = req.body;
    if (!base_url || !db || !login || !password) {
      throw new AppError('base_url, db, login, password wajib diisi.', 422);
    }
    const data = await adminSvc.verifyOdooConnection({ base_url, db, login, password });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /admin/odoo/config
 * Return current Odoo connection config (password masked).
 */
router.get('/odoo/config', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await adminSvc.getIntegrationConfig();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * POST /admin/odoo/config
 * Save Odoo connection config including selected company.
 * Body: { base_url, db, login, password, company_id, company_name }
 */
router.post('/odoo/config', ...adminOnly, async (req, res, next) => {
  try {
    const { base_url, db, login, password, company_id, company_name } = req.body;
    if (!base_url || !db || !login || !company_id) {
      throw new AppError('base_url, db, login, company_id wajib diisi.', 422);
    }
    const data = await adminSvc.saveIntegrationConfig({
      odoo_base_url:    base_url,
      odoo_db:          db,
      odoo_login:       login,
      ...(password ? { odoo_password: password } : {}),
      odoo_company_id:   Number(company_id),
      odoo_company_name: company_name || '',
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── Odoo Payment Journals ─────────────────────────────────────────────────────

/**
 * GET /admin/odoo/payment-journals
 * Return current payment method → Odoo journal_id mapping.
 */
router.get('/odoo/payment-journals', ...adminOnly, async (_req, res, next) => {
  try {
    const cfg = await adminSvc.getIntegrationConfig();
    res.json({ success: true, data: cfg.odoo_payment_journals || {} });
  } catch (err) { next(err); }
});

/**
 * PUT /admin/odoo/payment-journals
 * Save payment method → Odoo journal_id mapping.
 * Body: { "CASH": 14, "QRIS": 15, "EDC": 16, "TRANSFER": 17 }
 */
router.put('/odoo/payment-journals', ...adminOnly, async (req, res, next) => {
  try {
    const allowed = ['CASH', 'QRIS', 'EDC', 'TRANSFER'];
    const journals = {};
    for (const method of allowed) {
      if (req.body[method] !== undefined) {
        const id = parseInt(req.body[method], 10);
        if (!isNaN(id) && id > 0) journals[method] = id;
      }
    }
    const data = await adminSvc.saveIntegrationConfig({ odoo_payment_journals: journals });
    res.json({ success: true, message: 'Payment journal mapping disimpan.', data: data.odoo_payment_journals || {} });
  } catch (err) { next(err); }
});

// ── Odoo lookups ──────────────────────────────────────────────────────────────

router.get('/odoo/categories', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await adminSvc.getOdooProductCategories();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /admin/odoo/taxes
 * Fetch all active sale taxes from Odoo for the tax mapping dropdown.
 */
router.get('/odoo/taxes', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await adminSvc.getOdooTaxList();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── Tax Configuration ─────────────────────────────────────────────────────────

/**
 * GET /admin/tax-config
 * Return current PPN / tax configuration.
 */
router.get('/tax-config', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await adminSvc.getTaxConfig();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * PUT /admin/tax-config
 * Persist PPN / tax configuration.
 */
router.put('/tax-config', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.saveTaxConfig(req.body);
    res.json({ success: true, message: 'Konfigurasi pajak disimpan.', data });
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

// ── BCA QRIS Credential Configuration ────────────────────────────────────────

const bcaQrisSvc = require('../bca-qris/bca-qris.service');

/**
 * GET /admin/bca-qris/config
 * Return current BCA QRIS credential config (secrets masked).
 */
router.get('/bca-qris/config', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await bcaQrisSvc.getBcaConfig();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * PUT /admin/bca-qris/config
 * Save BCA QRIS credential config. Masked values are preserved.
 */
router.put('/bca-qris/config', ...adminOnly, async (req, res, next) => {
  try {
    const data = await bcaQrisSvc.saveBcaConfig(req.body);
    res.json({ success: true, message: 'Konfigurasi BCA QRIS disimpan.', data });
  } catch (err) { next(err); }
});

/**
 * GET /admin/bca-qris/transactions
 * List QRIS transactions with optional status filter.
 */
router.get('/bca-qris/transactions', ...adminOnly, async (req, res, next) => {
  try {
    const data = await bcaQrisSvc.listQrisTransactions({
      status: req.query.status,
      limit:  parseInt(req.query.limit  || '100', 10),
      offset: parseInt(req.query.offset || '0',   10),
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * POST /admin/bca-qris/token-test
 * Fetch a fresh BCA access token to verify credentials are correct.
 */
router.post('/bca-qris/token-test', ...adminOnly, async (_req, res, next) => {
  try {
    const token = await bcaQrisSvc.getAccessToken();
    res.json({ success: true, message: 'Token berhasil didapatkan.', data: { token_preview: token.slice(0, 12) + '…' } });
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
