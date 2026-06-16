import axios  from 'axios';
import client from './client';

export const getBoothProducts = () => client.get('/helper/products');

export const getBoothOrders = (params) => client.get('/helper/orders', { params });

export const getBoothOrder = (txnId) => client.get(`/helper/orders/${txnId}`);

export const createHelperOrder = (payload) => client.post('/helper/orders', payload);

export const cancelHelperOrder = (txnId) => client.post(`/helper/orders/${txnId}/cancel`);

export const handoverOrder = (txnId) => client.post(`/helper/orders/${txnId}/handover`);

// CR-036: kirim ulang WA
export const resendWa = (txnId, phone = null) =>
  client.post(`/helper/orders/${txnId}/resend-wa`, phone ? { phone } : {});

// CR-036: endpoint publik (tanpa JWT) — dipakai oleh OrderTrackingPage public mode
export const getPublicOrder = (txnId, token) =>
  axios.get(`/api/v1/orders/${txnId}/public`, { params: { token } });

// CR-040: HELPER_APPROVE endpoints
export const getApprovalQueue = () => client.get('/helper/approval-queue');

export const approveOrder = (txnId, note = null, shippingFields = null) =>
  client.post(`/helper/orders/${txnId}/approve`, { ...(note ? { note } : {}), ...(shippingFields || {}) });

export const rejectOrder = (txnId, reason = null) =>
  client.post(`/helper/orders/${txnId}/reject`, reason ? { reason } : {});

// CR-050 Req-3: Pre-order transactions (PENDING_APPROVAL + PAID) for this helper's booth
export const getPreorderApprovalOrders = () => client.get('/helper/preorder-queue');

// Per-item approval
export const approveItem = (txnId, itemId, approvedQty = null, note = null) =>
  client.post(`/helper/orders/${txnId}/items/${itemId}/approve`, {
    ...(approvedQty !== null ? { approved_qty: approvedQty } : {}),
    ...(note ? { note } : {}),
  });

export const rejectItem = (txnId, itemId, reason = null) =>
  client.post(`/helper/orders/${txnId}/items/${itemId}/reject`, reason ? { reason } : {});
