import client from './client';

export const lookupPayment = (transactionId) => client.get(`/payments/lookup/${transactionId}`);
export const processPayment = (data) => client.post('/payments/process', data);
