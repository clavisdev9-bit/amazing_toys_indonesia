import client from './client';

export const validateVoucher = (data) => client.post('/vouchers/validate', data);
export const applyVoucher    = (data) => client.post('/vouchers/apply', data);

// Admin
export const listVouchers    = (params) => client.get('/admin/vouchers', { params });
export const getVoucher      = (code)   => client.get(`/admin/vouchers/${code}`);
export const createVoucher   = (data)   => client.post('/admin/vouchers', data);
export const updateVoucher   = (code, data) => client.patch(`/admin/vouchers/${code}`, data);
export const deleteVoucher   = (code)   => client.delete(`/admin/vouchers/${code}`);
