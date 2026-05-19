import { useState, useCallback, useMemo } from 'react';
import { PRODUCTS, STORES, STORE_MAP } from '../data/mockData';

const LS_MODE  = 'preferredMode';
const LS_CAT   = 'preferredCat';
const LS_FLOOR = 'preferredFloor';

function readLS(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

export function useCatalogueState() {
  const [mode,                 setModeRaw]         = useState(() => readLS(LS_MODE,  'product'));
  const [curCat,               setCurCatRaw]       = useState(() => readLS(LS_CAT,   'All'));
  const [curFloor,             setCurFloorRaw]     = useState(() => readLS(LS_FLOOR, 'UG'));
  const [selectedStoreIds,     setSelectedStoreIds]= useState([]);
  const [storeCat,             setStoreCatRaw]     = useState('All');
  const [showFilteredProducts, setShowFiltered]    = useState(false);
  const [search,               setSearch]          = useState('');
  const [selectedProduct,      setSelectedProduct] = useState(null);

  const setMode = useCallback((m) => {
    setModeRaw(m);
    try { localStorage.setItem(LS_MODE, m); } catch {}
  }, []);

  const setCurCat = useCallback((c) => {
    setCurCatRaw(c);
    try { localStorage.setItem(LS_CAT, c); } catch {}
  }, []);

  const setCurFloor = useCallback((f) => {
    setCurFloorRaw(f);
    try { localStorage.setItem(LS_FLOOR, f); } catch {}
  }, []);

  const setStoreCat = useCallback((c) => setStoreCatRaw(c), []);

  const toggleStore = useCallback((id) => {
    setSelectedStoreIds(prev => {
      const next = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
      if (next.length === 0) setShowFiltered(false);
      return next;
    });
  }, []);

  const clearStores = useCallback(() => {
    setSelectedStoreIds([]);
    setShowFiltered(false);
  }, []);

  // Product mode: category + search filter
  // TODO: replace with API call to GET /api/products
  const productModeProducts = useMemo(() => {
    let result = PRODUCTS;
    if (curCat !== 'All') result = result.filter(p => p.category === curCat);
    if (search.trim()) result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [curCat, search]);

  // Store mode: store filter + category filter
  // TODO: replace with API call to GET /api/products?storeIds=...
  const storeModeProducts = useMemo(() => {
    if (selectedStoreIds.length === 0) return [];
    let result = PRODUCTS.filter(p => p.storeIds.some(id => selectedStoreIds.includes(id)));
    if (storeCat !== 'All') result = result.filter(p => p.category === storeCat);
    return result;
  }, [selectedStoreIds, storeCat]);

  // Stores visible on the selected floor, optionally filtered by search in store mode
  // TODO: replace with API call to GET /api/stores?floor=...
  const storesByFloor = useMemo(() => {
    let result = STORES.filter(s => s.floor === curFloor);
    if (mode === 'store' && search.trim())
      result = result.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [curFloor, mode, search]);

  const selectedStores = useMemo(
    () => selectedStoreIds.map(id => STORE_MAP[id]).filter(Boolean),
    [selectedStoreIds],
  );

  const state = {
    mode, curCat, curFloor,
    selectedStoreIds, selectedStores,
    storeCat, showFilteredProducts,
    search, selectedProduct,
    productModeProducts, storeModeProducts, storesByFloor,
  };

  const actions = {
    setMode, setCurCat, setCurFloor,
    setStoreCat, toggleStore, clearStores,
    setShowFilteredProducts: setShowFiltered,
    setSearch, setSelectedProduct,
  };

  return { state, actions };
}
