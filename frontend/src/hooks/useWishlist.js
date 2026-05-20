import { useState, useEffect, useCallback } from 'react';
import { getWishlist, addToWishlist, removeFromWishlist } from '../api/wishlist';
import { useAuth } from './useAuth';

// Module-level cache shared across all hook instances
let cachedIds = null;

export function useWishlist() {
  const { user } = useAuth();
  const [wishedIds, setWishedIds] = useState(cachedIds ?? []);

  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return;
    if (cachedIds !== null) { setWishedIds(cachedIds); return; }
    getWishlist()
      .then(r => {
        cachedIds = r.data.data ?? [];
        setWishedIds(cachedIds);
      })
      .catch(() => { cachedIds = []; });
  }, [user]);

  const isWished = useCallback(
    (productId) => wishedIds.includes(productId),
    [wishedIds]
  );

  const toggleWish = useCallback(async (productId) => {
    if (!user || user.role !== 'CUSTOMER') return;
    const wished = wishedIds.includes(productId);
    // Optimistic update
    const next = wished
      ? wishedIds.filter(id => id !== productId)
      : [...wishedIds, productId];
    cachedIds = next;
    setWishedIds(next);
    try {
      if (wished) await removeFromWishlist(productId);
      else        await addToWishlist(productId);
    } catch {
      // Rollback on error
      cachedIds = wishedIds;
      setWishedIds(wishedIds);
    }
  }, [user, wishedIds]);

  return { isWished, toggleWish };
}
