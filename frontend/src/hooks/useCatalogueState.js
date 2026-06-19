import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { getProducts, getCategories } from '../api/products';
import { getTenants } from '../api/tenants';
import { useWebSocket } from './useWebSocket';

const FLOOR_ORDER = ['GF', 'UG', 'LG', '1F', '2F', '3F'];

// Sort priority: has image (0) → no image (1), then Available (0) → Limited (1) → Out of Stock (2)
function stockSortKey(stock) {
  if (stock === 0) return 2;
  if (stock <= 3)  return 1;
  return 0;
}

function productSortKey(p) {
  const img = p.image_url ? 0 : 1;
  return img * 10 + stockSortKey(p.stock);
}

const TENANT_COLORS = [
  { colorHex: '#EEEDFE', textColorHex: '#3C3489' },
  { colorHex: '#FAEEDA', textColorHex: '#633806' },
  { colorHex: '#E1F5EE', textColorHex: '#085041' },
  { colorHex: '#FBEAF0', textColorHex: '#72243E' },
  { colorHex: '#E6F1FB', textColorHex: '#1a3a6b' },
  { colorHex: '#FAECE7', textColorHex: '#7a2a12' },
  { colorHex: '#F1EFE8', textColorHex: '#444441' },
  { colorHex: '#F0FDF4', textColorHex: '#166534' },
];

const LS_MODE  = 'preferredMode';
const LS_CAT   = 'preferredCat';
const LS_FLOOR = 'preferredFloor';

function readLS(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function normalizeProduct(p) {
  return {
    id:             p.product_id,
    name:           p.product_name,
    price:          p.price,
    category:       p.category,
    stock:          p.stock_quantity,
    stock_status:   p.stock_status,
    colorHex:       '#F3F4F6',
    image_url:      p.image_url || null,
    is_on_hold:     p.is_on_hold || false,
    is_preorder:    p.is_preorder || false,
    preorder_note:  p.preorder_note || null,
    barcode:        p.barcode || '',
    description:    p.description || '',
    tenant_id:      p.tenant_id,
    tenant_name:    p.tenant_name,
    booth_location: p.booth_location,
    floor:          p.floor_label,
    storeIds:       [p.tenant_id],
  };
}

function normalizeTenant(t, idx) {
  const colors = TENANT_COLORS[idx % TENANT_COLORS.length];
  return {
    id:           t.tenant_id,
    name:         t.tenant_name,
    meta:         t.booth_location,
    floor:        t.floor_label,
    booth:        t.tenant_name,
    lokasi:       t.booth_location,
    ...colors,
  };
}

export function useCatalogueState() {
  const [mode,                 setModeRaw]         = useState(() => readLS(LS_MODE,  'product'));
  const [curCat,               setCurCatRaw]       = useState(() => readLS(LS_CAT,   'All'));
  const [curFloor,             setCurFloorRaw]     = useState(() => readLS(LS_FLOOR, 'GF'));
  const [selectedStoreIds,     setSelectedStoreIds]= useState([]);
  const [storeCat,             setStoreCatRaw]     = useState('All');
  const [showFilteredProducts, setShowFiltered]    = useState(false);
  const [search,               setSearch]          = useState('');
  const [selectedProduct,      setSelectedProduct] = useState(null);

  const [products,   setProducts]   = useState([]);
  const [stores,     setStores]     = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [loading,    setLoading]    = useState(true);

  const { subscribe } = useWebSocket();
  // Prevent concurrent fetches triggered by rapid visibility/WS events
  const fetchingRef  = useRef(false);
  const isFirstLoad  = useRef(true);

  const loadData = useCallback(() => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    // Only show the full-page spinner on the very first load.
    // Background refreshes (tab focus, WS events) update data silently
    // so the scroll position is not disturbed.
    if (isFirstLoad.current) setLoading(true);
    Promise.all([
      getProducts({ limit: 5000 }),
      getTenants({ active_only: true }),
      getCategories(),
    ])
      .then(([prodRes, tenantRes, catRes]) => {
        const rawProds   = prodRes.data.data?.items ?? [];
        const rawTenants = tenantRes.data.data ?? [];
        const rawCats    = catRes.data.data ?? [];
        setProducts(rawProds.map(normalizeProduct));
        setStores(rawTenants.map(normalizeTenant));
        setCategories(['All', ...rawCats.filter(c => c !== 'All')]);
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        fetchingRef.current = false;
        isFirstLoad.current = false;
      });
  }, []);

  // Initial load
  useEffect(() => { loadData(); }, [loadData]);

  // Refetch in real-time when admin creates / updates / deletes any product
  useEffect(() => subscribe('PRODUCT_UPDATED', loadData), [subscribe, loadData]);

  const floors = useMemo(() => {
    const unique = [...new Set(stores.map(s => s.floor))];
    return FLOOR_ORDER.filter(f => unique.includes(f))
      .concat(unique.filter(f => !FLOOR_ORDER.includes(f)));
  }, [stores]);

  // Snap stored floor to a valid value once stores are loaded
  useEffect(() => {
    if (floors.length > 0 && !floors.includes(curFloor)) {
      setCurFloorRaw(floors[0]);
    }
  }, [floors]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const productModeProducts = useMemo(() => {
    let result = products;
    if (curCat !== 'All') result = result.filter(p => p.category === curCat);
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.barcode.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term)
      );
    }
    return [...result].sort((a, b) => productSortKey(a) - productSortKey(b));
  }, [products, curCat, search]);

  const storeModeProducts = useMemo(() => {
    if (selectedStoreIds.length === 0) return [];
    let result = products.filter(p => selectedStoreIds.includes(p.tenant_id));
    if (storeCat !== 'All') result = result.filter(p => p.category === storeCat);
    return [...result].sort((a, b) => productSortKey(a) - productSortKey(b));
  }, [products, selectedStoreIds, storeCat]);

  const storesByFloor = useMemo(() => {
    let result = stores.filter(s => s.floor === curFloor);
    if (mode === 'store' && search.trim())
      result = result.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [stores, curFloor, mode, search]);

  const selectedStores = useMemo(
    () => selectedStoreIds.map(id => stores.find(s => s.id === id)).filter(Boolean),
    [selectedStoreIds, stores],
  );

  const state = {
    mode, curCat, curFloor,
    selectedStoreIds, selectedStores,
    storeCat, showFilteredProducts,
    search, selectedProduct,
    products,
    productModeProducts, storeModeProducts, storesByFloor,
    categories, floors, loading,
  };

  const actions = {
    setMode, setCurCat, setCurFloor,
    setStoreCat, toggleStore, clearStores,
    setShowFilteredProducts: setShowFiltered,
    setSearch, setSelectedProduct,
  };

  return { state, actions };
}
