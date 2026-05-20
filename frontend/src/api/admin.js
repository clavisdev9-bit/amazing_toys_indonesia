import client from './client';

// ── Users ──────────────────────────────────────────────────────────────────
export const getUsers      = (params)      => client.get('/admin/users', { params });
export const createUser    = (data)        => client.post('/admin/users', data);
export const updateUser    = (id, data)    => client.patch(`/admin/users/${id}`, data);
export const resetPassword = (id, pw)      => client.post(`/admin/users/${id}/reset-password`, { new_password: pw });
export const deleteUser    = (id)          => client.delete(`/admin/users/${id}`);

// ── Products ───────────────────────────────────────────────────────────────
export const getAdminProducts    = (params)    => client.get('/admin/products', { params });
export const adminCreateProduct  = (data)      => client.post('/admin/products', data);
export const adminUpdateProduct  = (id, data)  => client.patch(`/admin/products/${id}`, data);
export const adminDeleteProduct  = (id)        => client.delete(`/admin/products/${id}`);
export const uploadProductImage  = (data)      => client.post('/admin/products/upload-image', data);

// ── Audit Log ──────────────────────────────────────────────────────────────
export const getAuditLog = (params) => client.get('/admin/audit-log', { params });

// ── Config ─────────────────────────────────────────────────────────────────
export const getPublicConfig  = ()     => client.get('/config/public');
export const getConfig        = ()     => client.get('/admin/config');
export const saveConfig       = (data) => client.put('/admin/config', data);
export const uploadLogo       = (data) => client.post('/admin/config/upload-logo', data);
export const getPrinterStatus = (userId) =>
  client.get('/print/status', userId ? { params: { userId } } : {});

// ── Tenants (Booth Master Data) ────────────────────────────────────────────
export const getAdminTenants   = (params)    => client.get('/admin/tenants', { params });
export const adminCreateTenant = (data)      => client.post('/admin/tenants', data);
export const adminUpdateTenant = (id, data)  => client.patch(`/admin/tenants/${id}`, data);

// ── Integration ────────────────────────────────────────────────────────────
export const getIntegration     = ()             => client.get('/admin/integration');
export const saveIntegration    = (data)         => client.put('/admin/integration', data);
export const syncOdooProducts   = (force = false) => client.post('/admin/products/sync-odoo', { force });

// ── Odoo connection wizard ──────────────────────────────────────────────────
export const verifyOdooConnection = (data)       => client.post('/admin/odoo/verify', data);
export const saveOdooConfig       = (data)       => client.post('/admin/odoo/config', data);

// ── Odoo lookups ───────────────────────────────────────────────────────────
export const getOdooCategories     = ()                => client.get('/admin/odoo/categories');

// ── Bulk Upload ────────────────────────────────────────────────────────────
export const bulkUploadProducts      = (products)  => client.post('/admin/products/bulk-upload', { products });
export const adminBulkUpdateCategory    = (category)     => client.patch('/admin/products/bulk-category', { category });
export const adminBulkUpdateOdooCategory    = (odoo_categ_id, odoo_categ_name) => client.patch('/admin/products/bulk-odoo-category', { odoo_categ_id, odoo_categ_name });
export const adminBulkUpdateDescription    = (description)                    => client.patch('/admin/products/bulk-description', { description });

// ── Stock Sync ──────────────────────────────────────────────────────────────
export const syncStock             = (productIds = null) =>
  client.post('/admin/stock-sync', productIds ? { product_ids: productIds } : {});
export const getStockSyncHistory   = (params)           => client.get('/admin/stock-sync/history', { params });

// ── Transaction Resync ──────────────────────────────────────────────────────
export const resyncTransactions = () => client.post('/admin/transactions/resync');

// ── Tax Configuration ───────────────────────────────────────────────────────
export const getTaxConfig    = ()     => client.get('/admin/tax-config');
export const saveTaxConfig   = (data) => client.put('/admin/tax-config', data);
export const getOdooTaxes    = ()     => client.get('/admin/odoo/taxes');
