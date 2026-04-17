import client from './client';

export const getRecap = (params) => client.get('/cashier/recap', { params });
export const getTransactions = (params) => client.get('/cashier/transactions', { params });
