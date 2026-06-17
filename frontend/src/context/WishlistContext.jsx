import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getWishlist, addToWishlist, removeFromWishlist } from '../api/wishlist';
import { useAuth } from '../hooks/useAuth';
import { useLang } from './LangContext';

const LS_KEY = 'amazing_toys_wishlist';

function loadLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function saveLS(ids) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(ids)); } catch {}
}

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const { t } = useLang();
  const [wishedIds, setWishedIds] = useState(loadLS);
  const [wishlistMode, setWishlistMode] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  // Sync from API when customer logs in; fallback to localStorage on error
  useEffect(() => {
    if (!user || user.role !== 'CUSTOMER') return;
    getWishlist()
      .then(r => {
        const ids = r.data.data ?? [];
        setWishedIds(ids);
        saveLS(ids);
      })
      .catch(() => {/* keep localStorage data */});
  }, [user]);

  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2500);
  }

  const isWished = useCallback((id) => wishedIds.includes(id), [wishedIds]);

  const toggleWish = useCallback(async (productId) => {
    if (!user || user.role !== 'CUSTOMER') return;
    const wasWished = wishedIds.includes(productId);
    const next = wasWished
      ? wishedIds.filter(id => id !== productId)
      : [...wishedIds, productId];

    // Optimistic update
    setWishedIds(next);
    saveLS(next);
    showToast(wasWished ? t('wishlist.removed') : t('wishlist.added'));

    try {
      if (wasWished) await removeFromWishlist(productId);
      else           await addToWishlist(productId);
    } catch {
      // Rollback
      setWishedIds(wishedIds);
      saveLS(wishedIds);
    }
  }, [user, wishedIds]);

  return (
    <WishlistContext.Provider value={{
      wishedIds,
      count: wishedIds.length,
      isWished,
      toggleWish,
      wishlistMode,
      setWishlistMode,
      toastMsg,
    }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlistContext() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlistContext must be inside WishlistProvider');
  return ctx;
}
