import client from './client';

export const getLeaderDashboard = (params) => client.get('/leader/dashboard', { params });
export const getSalesReport = (params) => client.get('/leader/sales', { params });
export const getVisitors = (params) => client.get('/leader/visitors', { params });
export const getReturns = (params) => client.get('/leader/returns', { params });
export const createReturn = (data) => client.post('/leader/returns', data);
export const updateReturn = (requestId, data) => client.patch(`/leader/returns/${requestId}`, data);
