import client from './client';

export const getTenants = (params) => client.get('/tenants', { params });
export const getTenant = (tenantId) => client.get(`/tenants/${tenantId}`);
