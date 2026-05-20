import client from './client';

export const lookupPayment = (transactionId, config) => client.get(`/payments/lookup/${transactionId}`, config);
export const processPayment = (data) => client.post('/payments/process', data);
