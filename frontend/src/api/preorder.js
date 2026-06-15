import client from './client';

// CR-05X — Pre-Order API

export const getPreorderList = (status = 'active') =>
  client.get('/preorder', { params: { status } });

export const updateShipment = (txnId, { courier, tracking_number }) =>
  client.patch(`/preorder/${txnId}/ship`, { courier, tracking_number });

export const confirmArrived = (txnId) =>
  client.patch(`/preorder/${txnId}/arrived`);

export const handoverPreorder = (txnId) =>
  client.patch(`/preorder/${txnId}/handover`);
