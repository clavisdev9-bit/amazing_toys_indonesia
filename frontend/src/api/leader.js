import client from './client';

export const getLeaderDashboard = (params) => client.get('/leader/dashboard', { params });
export const getSalesReport = (params) => client.get('/leader/sales', { params });
export const getVisitors = (params) => client.get('/leader/visitors', { params });
export const getReturns = (params) => client.get('/leader/returns', { params });
export const createReturn = (data) => client.post('/leader/returns', data);
export const updateReturn = (requestId, data) => client.patch(`/leader/returns/${requestId}`, data);

export const getDeleteRequests = (params) => client.get('/leader/delete-requests', { params });
export const reviewDeleteRequest = (id, data) => client.patch(`/leader/delete-requests/${id}`, data);

export const getTenantRanking      = (params) => client.get('/leader/tenant-ranking',     { params });
export const getSettlementReport   = (params) => client.get('/leader/settlement',          { params });
export const getVoucherReport      = (params) => client.get('/leader/voucher-report',      { params });
export const getTopProducts        = (params) => client.get('/leader/top-products',        { params });
export const getConversionRate     = (params) => client.get('/leader/conversion',          { params });
export const getHelperPerformance  = (params) => client.get('/leader/helper-performance',  { params });
export const getTaxReport          = (params) => client.get('/leader/tax-report',          { params });
export const getTopCustomers       = (params) => client.get('/leader/top-customers',       { params });
