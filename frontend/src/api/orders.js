import client from './client';

export const createOrder = (items, voucherCode = null) =>
  client.post('/orders', { items, ...(voucherCode ? { voucher_code: voucherCode } : {}) });
export const getMyOrders = () => client.get('/orders/my');
export const getOrder = (transactionId) => client.get(`/orders/${transactionId}`);
export const cancelOrder = (transactionId) => client.delete(`/orders/${transactionId}`);
export const updateOrderItem = (transactionId, productId, quantity) =>
  client.patch(`/orders/${transactionId}/items/${productId}`, { quantity });
export const deleteOrderItem = (transactionId, productId) =>
  client.delete(`/orders/${transactionId}/items/${productId}`);
export const partialProcessOrder = (transactionId) =>
  client.post(`/orders/${transactionId}/partial-process`);
