'use strict';

const express   = require('express');
const ExcelJS   = require('exceljs');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');
const { AppError } = require('../../middlewares/error.middleware');
const adminSvc = require('./admin.service');
const { query } = require('../../config/database');
const { broadcastToAll } = require('../../ws/websocket');

const router    = express.Router();
const adminOnly = [authenticate, authorize('ADMIN')];

// Fire-and-forget: tell integration service to invalidate its cached Odoo session
// so it re-authenticates with the latest credentials from DB on the next Odoo call.
function _notifyIntegrationReload() {
  const integrationUrl = process.env.INTEGRATION_WEBHOOK_URL || 'http://localhost:4000';
  fetch(`${integrationUrl}/sync/reload-config`, {
    method:  'POST',
    headers: { 'x-webhook-secret': process.env.WEBHOOK_SECRET || '' },
    signal:  AbortSignal.timeout(5000),
  }).catch(() => {}); // non-fatal — integration service may be offline
}

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
const { bulkUploadProducts }       = require('./bulkUpload.controller');
const { bulkUploadImages }         = require('./bulkImageUpload.controller');
const { bulkUploadMinimal }        = require('./bulkUploadMinimal.controller');
router.post('/products/bulk-upload',         ...adminOnly, bulkUploadProducts);
router.post('/products/bulk-upload-images',  ...adminOnly, bulkUploadImages);
router.post('/products/bulk-upload-minimal', ...adminOnly, bulkUploadMinimal);

// ── Bulk update stok + tenant by barcode ──────────────────────────────────────
router.post('/products/bulk-update-stock-tenant', ...adminOnly, async (req, res, next) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ success: false, message: 'rows wajib diisi dan tidak boleh kosong.' });

  try {
    // Build tenant lookup map: booth_location and tenant_name → tenant_id (case-insensitive)
    const tenantRes = await query('SELECT tenant_id, tenant_name, booth_location FROM tenants WHERE is_active = TRUE');
    const tenantMap = new Map();
    for (const t of tenantRes.rows) {
      tenantMap.set(t.booth_location.trim().toLowerCase(), t.tenant_id);
      tenantMap.set(t.tenant_name.trim().toLowerCase(), t.tenant_id);
    }

    const updated        = [];
    const notFound       = [];
    const tenantNotFound = [];
    const errors         = [];

    for (let i = 0; i < rows.length; i++) {
      const { barcode, stock_quantity, tenant } = rows[i];
      const rowNum = i + 2; // Excel row number (1=header)

      if (!barcode || String(barcode).trim() === '') {
        errors.push({ row: rowNum, message: 'barcode kosong, baris dilewati.' });
        continue;
      }

      const bc    = String(barcode).trim();
      const stock = parseInt(stock_quantity, 10);
      if (isNaN(stock) || stock < 0) {
        errors.push({ row: rowNum, barcode: bc, message: 'stock_quantity tidak valid.' });
        continue;
      }

      // Resolve tenant_id
      const tenantKey  = tenant ? String(tenant).trim().toLowerCase() : '';
      const tenant_id  = tenantMap.get(tenantKey) || null;

      if (tenant && !tenant_id) {
        tenantNotFound.push({ row: rowNum, barcode: bc, tenant: String(tenant).trim() });
        // Still update stock even if tenant not resolved, skip tenant update
      }

      const prodRes = await query('SELECT product_id, tenant_id FROM products WHERE barcode = $1', [bc]);
      if (prodRes.rows.length === 0) {
        notFound.push({ row: rowNum, barcode: bc });
        continue;
      }

      const product_id = prodRes.rows[0].product_id;
      const newTenantId = tenant_id || prodRes.rows[0].tenant_id; // keep existing if not resolved

      await query(
        'UPDATE products SET stock_quantity = $1, tenant_id = $2, updated_at = NOW() WHERE product_id = $3',
        [stock, newTenantId, product_id]
      );
      updated.push(product_id);
    }

    res.json({
      success: true,
      summary: {
        total:          rows.length,
        updated:        updated.length,
        not_found:      notFound.length,
        tenant_not_found: tenantNotFound.length,
        errors:         errors.length,
      },
      details: { notFound, tenantNotFound, errors },
    });
  } catch (err) { next(err); }
});

/**
 * POST /admin/products/pull-odoo
 * Pull sales_price + stock on hand dari Odoo → update SOS products.
 */
router.post('/products/pull-odoo', ...adminOnly, async (req, res, next) => {
  const integrationUrl = process.env.INTEGRATION_WEBHOOK_URL || 'http://localhost:4000';
  const secret = process.env.WEBHOOK_SECRET || '';
  try {
    const resp = await fetch(`${integrationUrl}/sync/pull/products`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
      signal:  AbortSignal.timeout(120_000),
    });
    const body = await resp.json();
    if (!resp.ok) return res.status(resp.status).json(body);
    res.json({ success: true, ...body });
  } catch (err) {
    next(err);
  }
});

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
      availableOnly:   req.query.available_only === 'true',
      syncedOnly:      req.query.synced_only === 'true',
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

router.delete('/products/bulk', ...adminOnly, async (req, res, next) => {
  try {
    const { product_ids } = req.body;
    const data = await adminSvc.adminBulkDeleteProducts(product_ids);
    broadcastToAll({ event: 'PRODUCT_UPDATED' });
    res.json({ success: true, ...data });
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

router.post('/tenants/bulk-upload', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.adminBulkUploadTenants(req.body.tenants);
    res.status(201).json({ success: true, data });
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

// ── Export Excel Master Data ──────────────────────────────────────────────────

router.get('/export/master-data', ...adminOnly, async (req, res, next) => {
  try {
    const [products, tenants] = await Promise.all([
      adminSvc.adminListProducts({ includeInactive: true, limit: 99999, page: 1 }),
      adminSvc.adminListTenants({ includeInactive: true }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Amazing Toys SOS';
    wb.created = new Date();

    // ── Sheet 1: Produk ──────────────────────────────────────────────────────
    const wsProd = wb.addWorksheet('Produk', { views: [{ state: 'frozen', ySplit: 1 }] });
    wsProd.columns = [
      { header: 'Product ID',        key: 'product_id',       width: 16 },
      { header: 'Nama Produk',        key: 'product_name',     width: 36 },
      { header: 'Kategori',           key: 'category',         width: 20 },
      { header: 'Harga (Rp)',         key: 'price',            width: 16 },
      { header: 'Stok',               key: 'stock_quantity',   width: 10 },
      { header: 'Status Stok',        key: 'stock_status',     width: 16 },
      { header: 'Tenant ID',          key: 'tenant_id',        width: 12 },
      { header: 'Nama Tenant',        key: 'tenant_name',      width: 28 },
      { header: 'Lokasi Booth',       key: 'booth_location',   width: 18 },
      { header: 'Barcode',            key: 'barcode',          width: 20 },
      { header: 'Odoo ID',            key: 'odoo_id',          width: 12 },
      { header: 'Odoo Categ ID',      key: 'odoo_categ_id',    width: 14 },
      { header: 'Deskripsi',          key: 'description',      width: 40 },
      { header: 'Pre-Order',          key: 'is_preorder',      width: 12 },
      { header: 'Catatan Pre-Order',  key: 'preorder_note',    width: 36 },
      { header: 'Aktif',              key: 'is_active',        width: 10 },
      { header: 'Dibuat',             key: 'created_at',       width: 22 },
      { header: 'Diperbarui',         key: 'updated_at',       width: 22 },
    ];

    // Header style
    const headerRow = wsProd.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 22;

    for (const p of products.items) {
      const row = wsProd.addRow({
        product_id:      p.product_id,
        product_name:    p.product_name,
        category:        p.category,
        price:           parseFloat(p.price),
        stock_quantity:  parseInt(p.stock_quantity, 10),
        stock_status:    p.stock_status,
        tenant_id:       p.tenant_id,
        tenant_name:     p.tenant_name,
        booth_location:  p.booth_location,
        barcode:         p.barcode,
        odoo_id:         p.odoo_id || '',
        odoo_categ_id:   p.odoo_categ_id || '',
        description:     p.description || '',
        is_preorder:     p.is_preorder ? 'Ya' : 'Tidak',
        preorder_note:   p.preorder_note || '',
        is_active:       p.is_active ? 'Aktif' : 'Nonaktif',
        created_at:      p.created_at ? new Date(p.created_at).toLocaleString('id-ID') : '',
        updated_at:      p.updated_at ? new Date(p.updated_at).toLocaleString('id-ID') : '',
      });

      // Color rows: inactive=grey, out of stock=light red, low stock=light yellow
      if (!p.is_active) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } };
      } else if (p.stock_status === 'OUT_OF_STOCK') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
      } else if (p.stock_status === 'LOW_STOCK') {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      }

      // Format price column as currency
      row.getCell('price').numFmt = '#,##0';
    }

    // Auto-filter
    wsProd.autoFilter = { from: 'A1', to: 'R1' };

    // ── Sheet 2: Tenant/Booth ────────────────────────────────────────────────
    const wsTenant = wb.addWorksheet('Tenant - Booth', { views: [{ state: 'frozen', ySplit: 1 }] });
    wsTenant.columns = [
      { header: 'Tenant ID',          key: 'tenant_id',        width: 14 },
      { header: 'Nama Tenant',        key: 'tenant_name',      width: 30 },
      { header: 'Lokasi Booth',       key: 'booth_location',   width: 20 },
      { header: 'Lantai',             key: 'floor_label',      width: 12 },
      { header: 'Kontak PIC',         key: 'contact_name',     width: 24 },
      { header: 'No. Telepon',        key: 'contact_phone',    width: 18 },
      { header: 'Email',              key: 'contact_email',    width: 30 },
      { header: 'Revenue Share (%)',  key: 'revenue_share_pct',width: 18 },
      { header: 'Rekening Bank',      key: 'bank_account',     width: 24 },
      { header: 'Order Mode',         key: 'order_mode',       width: 18 },
      { header: 'Odoo Booth ID',      key: 'odoo_booth_id',    width: 14 },
      { header: 'Aktif',              key: 'is_active',        width: 10 },
      { header: 'Dibuat',             key: 'created_at',       width: 22 },
    ];

    const headerRowT = wsTenant.getRow(1);
    headerRowT.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRowT.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    headerRowT.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRowT.height = 22;

    for (const t of tenants) {
      const row = wsTenant.addRow({
        tenant_id:        t.tenant_id,
        tenant_name:      t.tenant_name,
        booth_location:   t.booth_location,
        floor_label:      t.floor_label || '',
        contact_name:     t.contact_name,
        contact_phone:    t.contact_phone,
        contact_email:    t.contact_email || '',
        revenue_share_pct: t.revenue_share_pct != null ? parseFloat(t.revenue_share_pct) : '',
        bank_account:     t.bank_account || '',
        order_mode:       t.order_mode || 'Inherit Global',
        odoo_booth_id:    t.odoo_booth_id || '',
        is_active:        t.is_active ? 'Aktif' : 'Nonaktif',
        created_at:       t.created_at ? new Date(t.created_at).toLocaleString('id-ID') : '',
      });

      if (!t.is_active) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } };
      }
    }

    wsTenant.autoFilter = { from: 'A1', to: 'M1' };

    // ── Stream response ──────────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="master-data-${today}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
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
      odoo_is_active:    true,
    });
    _notifyIntegrationReload();
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
    _notifyIntegrationReload();
    res.json({ success: true, message: 'Konfigurasi integrasi disimpan.', data });
  } catch (err) { next(err); }
});

// ── WA Gateway Configuration ──────────────────────────────────────────────────

const waSvc = require('../wa/wa.service');

router.get('/wa-gateway', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await adminSvc.getWaGatewayConfig(true);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/wa-gateway', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.saveWaGatewayConfig(req.body);
    res.json({ success: true, message: 'Konfigurasi WA Gateway disimpan.', data });
  } catch (err) { next(err); }
});

router.post('/wa-gateway/test', ...adminOnly, async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Nomor HP wajib diisi.' });
    const result = await waSvc.sendTestMessage(phone);
    if (result.status === 'SENT') {
      res.json({ success: true, message: `Pesan tes berhasil dikirim ke ${phone}.`, data: result });
    } else {
      res.status(422).json({ success: false, message: result.error || 'Gagal mengirim pesan tes.', data: result });
    }
  } catch (err) { next(err); }
});

// ── Email / SMTP Config ───────────────────────────────────────────────────────

router.get('/email-config', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await adminSvc.getEmailConfig(true);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.put('/email-config', ...adminOnly, async (req, res, next) => {
  try {
    const data = await adminSvc.saveEmailConfig(req.body);
    res.json({ success: true, message: 'Konfigurasi email disimpan.', data });
  } catch (err) { next(err); }
});

router.post('/email-config/test', ...adminOnly, async (req, res, next) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, message: 'Alamat email tujuan wajib diisi.' });
    const mailer = require('../../config/mailer');
    const ready  = await mailer.isReady();
    if (!ready)  return res.status(422).json({ success: false, message: 'SMTP belum dikonfigurasi.' });
    await mailer.sendMail({
      to,
      subject: '[SOS] Test Email — Konfigurasi SMTP berhasil',
      html: `<div style="font-family:sans-serif;padding:24px;max-width:480px;margin:auto">
        <h2 style="color:#1f2937">✅ Test Email Berhasil</h2>
        <p style="color:#374151">Email ini dikirim dari sistem SOS untuk memverifikasi konfigurasi SMTP Anda.</p>
        <p style="color:#9ca3af;font-size:12px">Jika Anda tidak meminta ini, abaikan email ini.</p>
      </div>`,
    });
    res.json({ success: true, message: `Email tes berhasil dikirim ke ${to}.` });
  } catch (err) { next(err); }
});

// ── WAHA Session Management (proxy to self-hosted WAHA) ──────────────────────
//
// All three routes read current config to get the WAHA base URL, session name,
// and optional X-Api-Key so the browser never reaches internal Docker URLs.

async function _wahaConfig() {
  const cfg = await adminSvc.getWaGatewayConfig(false);
  return { base: (cfg.apiUrl || '').replace(/\/$/, ''), session: cfg.wahaSession || 'default', apiKey: cfg.apiKey || '' };
}

function _wahaHeaders(apiKey) {
  const h = { 'Content-Type': 'application/json' };
  if (apiKey) h['X-Api-Key'] = apiKey;
  return h;
}

router.get('/wa-gateway/waha/status', ...adminOnly, async (_req, res, next) => {
  try {
    const { base, session, apiKey } = await _wahaConfig();
    if (!base) return res.status(422).json({ success: false, message: 'WAHA Base URL belum dikonfigurasi.' });
    const upstream = await fetch(`${base}/api/sessions/${encodeURIComponent(session)}`, {
      headers: _wahaHeaders(apiKey),
    });
    const json = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(upstream.status).json({ success: false, message: json.message || `WAHA HTTP ${upstream.status}` });
    res.json({ success: true, data: json });
  } catch (err) { next(err); }
});

router.post('/wa-gateway/waha/start', ...adminOnly, async (_req, res, next) => {
  try {
    const { base, session, apiKey } = await _wahaConfig();
    if (!base) return res.status(422).json({ success: false, message: 'WAHA Base URL belum dikonfigurasi.' });
    // Upsert + start in one call
    const upstream = await fetch(`${base}/api/sessions/start`, {
      method:  'POST',
      headers: _wahaHeaders(apiKey),
      body:    JSON.stringify({ name: session, config: {} }),
    });
    const json = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(upstream.status).json({ success: false, message: json.message || `WAHA HTTP ${upstream.status}` });
    res.json({ success: true, data: json });
  } catch (err) { next(err); }
});

router.get('/wa-gateway/waha/qr', ...adminOnly, async (_req, res, next) => {
  try {
    const { base, session, apiKey } = await _wahaConfig();
    if (!base) return res.status(422).json({ success: false, message: 'WAHA Base URL belum dikonfigurasi.' });
    const upstream = await fetch(
      `${base}/api/${encodeURIComponent(session)}/auth/qr?format=image`,
      { headers: { ..._wahaHeaders(apiKey), Accept: 'application/json' } },
    );
    if (!upstream.ok) {
      const json = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ success: false, message: json.message || `WAHA HTTP ${upstream.status}` });
    }
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      // WAHA returns { mimetype, data } JSON when Accept: application/json
      const { mimetype = 'image/png', data } = await upstream.json();
      res.json({ success: true, data: { qr: `data:${mimetype};base64,${data}` } });
    } else {
      // Fallback: binary PNG — convert to base64
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.json({ success: true, data: { qr: `data:image/png;base64,${buf.toString('base64')}` } });
    }
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

// ── Data Health ───────────────────────────────────────────────────────────────

router.get('/data-health', ...adminOnly, async (_req, res, next) => {
  try {
    const data = await adminSvc.getDataHealth();
    res.json({ success: true, data });
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
