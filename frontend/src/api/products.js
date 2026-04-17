import client from './client';

export const getProducts = (params) => client.get('/products', { params });
export const getCategories = () => client.get('/products/categories');
export const getProduct = (productId) => client.get(`/products/${productId}`);
export const getProductByBarcode = (barcode) => client.get(`/products/barcode/${barcode}`);
