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
export const getPublicConfig = ()  => client.get('/config/public');
export const getConfig    = ()     => client.get('/admin/config');
export const saveConfig   = (data) => client.put('/admin/config', data);
export const uploadLogo   = (data) => client.post('/admin/config/upload-logo', data);

// ── Tenants (Booth Master Data) ────────────────────────────────────────────
export const getAdminTenants   = (params)    => client.get('/admin/tenants', { params });
export const adminCreateTenant = (data)      => client.post('/admin/tenants', data);
export const adminUpdateTenant = (id, data)  => client.patch(`/admin/tenants/${id}`, data);

// ── Integration ────────────────────────────────────────────────────────────
export const getIntegration  = ()     => client.get('/admin/integration');
export const saveIntegration = (data) => client.put('/admin/integration', data);
