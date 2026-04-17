import client from './client';

export const getTenantOrders    = ()       => client.get('/tenant-orders');
export const handover           = (tid)    => client.post('/tenant-orders/handover', { transaction_id: tid });
export const getTenantDashboard = (params) => client.get('/tenant-orders/dashboard', { params });

export const getLaporanProduk = (params) => client.get('/tenant-reports/produk', { params });
export const getLaporanHarian = (params) => client.get('/tenant-reports/harian', { params });
export const getLaporanStok   = (params) => client.get('/tenant-reports/stok',   { params });
