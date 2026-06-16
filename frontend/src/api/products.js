import client from './client';

export const getProducts = (params) => client.get('/products', { params });
export const getCategories   = ()     => client.get('/products/categories');
export const createCategory  = (name) => client.post('/products/categories', { name });
export const getProduct = (productId) => client.get(`/products/${productId}`);
export const getProductByBarcode = (barcode) => client.get(`/products/barcode/${barcode}`);
export const toggleProductPreorder = (productId, isPreorder, preorderNote = null) =>
  client.patch(`/products/${productId}/preorder`, { is_preorder: isPreorder, preorder_note: preorderNote });
