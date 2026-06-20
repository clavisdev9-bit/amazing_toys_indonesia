import client from './client';

export const validateVoucher  = (data) => client.post('/vouchers/validate', data);
export const applyVoucher     = (data) => client.post('/vouchers/apply', data);

/**
 * Ambil active product promo rules untuk product_ids di cart.
 * @param {string[]} productIds
 */
export const getActivePromos = (productIds) =>
  client.get('/vouchers/active-promos', {
    params: { product_ids: productIds.join(',') },
  });

// Admin
export const listVouchers    = (params) => client.get('/admin/vouchers', { params });
export const getVoucher      = (code)   => client.get(`/admin/vouchers/${code}`);
export const createVoucher   = (data)   => client.post('/admin/vouchers', data);
export const updateVoucher   = (code, data) => client.patch(`/admin/vouchers/${code}`, data);
export const deleteVoucher   = (code)   => client.delete(`/admin/vouchers/${code}`);

// Admin: Product Promo
export const listProductPromos  = (params) => client.get('/admin/vouchers/product-promos', { params });
export const createProductPromo = (data)   => client.post('/admin/vouchers/product-promos', data);
