import client from './client';

export const getWishlist       = ()           => client.get('/wishlist');
export const addToWishlist     = (productId)  => client.post(`/wishlist/${productId}`);
export const removeFromWishlist = (productId) => client.delete(`/wishlist/${productId}`);
