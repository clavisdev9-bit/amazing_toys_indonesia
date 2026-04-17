import client from './client';

export const createOrder = (items) => client.post('/orders', { items });
export const getMyOrders = () => client.get('/orders/my');
export const getOrder = (transactionId) => client.get(`/orders/${transactionId}`);
export const cancelOrder = (transactionId) => client.delete(`/orders/${transactionId}`);
export const updateOrderItem = (transactionId, productId, quantity) =>
  client.patch(`/orders/${transactionId}/items/${productId}`, { quantity });
