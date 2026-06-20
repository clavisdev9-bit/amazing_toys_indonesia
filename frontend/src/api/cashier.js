import client from './client';

export const getRecap = (params) => client.get('/cashier/recap', { params });
export const getTransactions = (params) => client.get('/cashier/transactions', { params });
export const createCashierOrder = (items, customerPhone = null, voucherCode = null, skipProductPromo = false) =>
  client.post('/cashier/orders', {
    items,
    ...(customerPhone    ? { customerPhone }    : {}),
    ...(voucherCode      ? { voucherCode }      : {}),
    ...(skipProductPromo ? { skipProductPromo } : {}),
  });
export const addItemToTransaction = (transactionId, productId, quantity) =>
  client.post(`/cashier/orders/${transactionId}/items`, { product_id: productId, quantity });
export const applyVoucherToOrder = (transactionId, voucherCode) =>
  client.post(`/cashier/orders/${transactionId}/voucher`, { voucherCode });
export const cancelCashierOrder = (transactionId) =>
  client.delete(`/cashier/orders/${transactionId}`);

export const getExpiredTransactions     = (params) => client.get('/cashier/expired', { params });
// CR-053: dedicated pre-order payment queue (PENDING pre-orders, no date filter)
export const getPreorderPaymentQueue = () => client.get('/cashier/preorder-queue');

export const createDeleteRequest = (data) => client.post('/cashier/delete-requests', data);
export const getPendingDeleteRequests = () => client.get('/cashier/delete-requests/pending');

// Group checkout
export const getCustomerActiveTrx = ({ phone, name } = {}) =>
  client.get('/cashier/customer-transactions', { params: { phone, name } });
export const groupCheckout = (data) => client.post('/cashier/group-checkout', data);
export const listGroups    = ()         => client.get('/cashier/groups');
export const getGroupDetail = (groupId) => client.get(`/cashier/groups/${groupId}`);

// CR-060: lookup customer info by phone sebelum checkout
export const lookupCustomerByPhone = (phone) =>
  client.get('/cashier/customer-lookup', { params: { phone } });

// Reports
export const getEdcLog     = (params) => client.get('/cashier/edc-log', { params });
export const getShiftReport = (params) => client.get('/cashier/shift-report', { params });
