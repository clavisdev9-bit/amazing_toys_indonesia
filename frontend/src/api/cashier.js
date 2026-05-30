import client from './client';

export const getRecap = (params) => client.get('/cashier/recap', { params });
export const getTransactions = (params) => client.get('/cashier/transactions', { params });
export const createCashierOrder = (items) => client.post('/cashier/orders', { items });
export const addItemToTransaction = (transactionId, productId, quantity) =>
  client.post(`/cashier/orders/${transactionId}/items`, { product_id: productId, quantity });
