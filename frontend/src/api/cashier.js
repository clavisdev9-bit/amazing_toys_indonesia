import client from './client';

export const getRecap = (params) => client.get('/cashier/recap', { params });
export const getTransactions = (params) => client.get('/cashier/transactions', { params });
export const createCashierOrder = (items, customerPhone = null, voucherCode = null) =>
  client.post('/cashier/orders', {
    items,
    ...(customerPhone ? { customerPhone } : {}),
    ...(voucherCode   ? { voucherCode }   : {}),
  });
export const addItemToTransaction = (transactionId, productId, quantity) =>
  client.post(`/cashier/orders/${transactionId}/items`, { product_id: productId, quantity });
export const applyVoucherToOrder = (transactionId, voucherCode) =>
  client.post(`/cashier/orders/${transactionId}/voucher`, { voucherCode });
