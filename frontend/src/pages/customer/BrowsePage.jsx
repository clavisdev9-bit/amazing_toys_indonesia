import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogueState }    from '../../hooks/useCatalogueState';
import { FLOOR_NAMES, PRODUCT_MAP, STORE_MAP } from '../../data/mockData';
import { useTourTarget }        from '../../hooks/useTourTarget';
import ModeToggle               from '../../components/catalogue/ModeToggle';
import CategoryChips            from '../../components/catalogue/CategoryChips';
import FloorChips               from '../../components/catalogue/FloorChips';
import ProductGrid              from '../../components/catalogue/ProductGrid';
import StoreList                from '../../components/catalogue/StoreList';
import FilterBanner             from '../../components/catalogue/FilterBanner';
import StickyActionBar          from '../../components/catalogue/StickyActionBar';
import ProductBottomSheet       from '../../components/catalogue/ProductBottomSheet';
import QrScannerModal           from '../../components/ui/QrScannerModal';

export default function BrowsePage() {
  const navigate = useNavigate();
  const { state, actions } = useCatalogueState();
  const searchRef      = useTourTarget('step-katalog-search');
  const categoriesRef  = useTourTarget('step-katalog-categories');
  const [showScanner, setShowScanner] = useState(false);
  const [toast, setToast] = useState('');

  const {
    mode, curCat, curFloor,
    selectedStoreIds, selectedStores,
    storeCat, showFilteredProducts,
    search, selectedProduct,
    productModeProducts, storeModeProducts, storesByFloor,
  } = state;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  function handleQrResult(text) {
    setShowScanner(false);
    if (PRODUCT_MAP[text]) {
      navigate(`/product/${text}`);
    } else if (STORE_MAP[text]) {
      actions.setMode('store');
      actions.toggleStore(text);
    } else {
      setToast('QR tidak dikenali');
    }
  }

  return (
    <div className="max-w-[390px] mx-auto">

      {/* ── Sticky controls bar ───────────────────────────────────────── */}
      <div className="sticky top-[57px] z-20 bg-white border-b px-4 pt-3 pb-2.5 flex flex-col gap-2">

        {/* Search + QR button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
            </svg>
            <input
              ref={searchRef}
              id="tour-search"
              type="text"
              value={search}
              onChange={e => actions.setSearch(e.target.value)}
              placeholder={mode === 'product' ? 'Search products…' : 'Search stores…'}
              className="w-full pl-9 pr-9 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#AFA9EC] placeholder:text-gray-400"
            />
            {search && (
              <button
                onClick={() => actions.setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* QR scan button */}
          <button
            onClick={() => setShowScanner(true)}
            className="shrink-0 w-9 h-9 flex items-center justify-center bg-gray-100 rounded-xl text-gray-500 hover:bg-gray-200 transition-colors"
            aria-label="Scan QR"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
            </svg>
          </button>
        </div>

        {/* Mode toggle */}
        <ModeToggle mode={mode} onSetMode={actions.setMode} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          BY PRODUCT MODE
      ══════════════════════════════════════════════════════════════════ */}
      {mode === 'product' && (
        <>
          {/* Category chips — tour target */}
          <div ref={categoriesRef} id="tour-categories">
            <CategoryChips
              selected={curCat}
              onSelect={actions.setCurCat}
              variant="product"
            />
          </div>

          {/* Section header */}
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-xs font-medium text-gray-700">
              {curCat === 'All' ? 'All products' : curCat}
            </span>
            <span className="text-[11px] text-gray-400">
              {productModeProducts.length} item{productModeProducts.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Product grid */}
          <ProductGrid
            products={productModeProducts}
            firstCardTourAttr={{ 'data-tour': 'product-card' }}
          />
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          BY STORE MODE
      ══════════════════════════════════════════════════════════════════ */}
      {mode === 'store' && (
        <>
          {/* Floor chips */}
          <FloorChips selected={curFloor} onSelect={actions.setCurFloor} />

          {/* Section header */}
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-xs font-medium text-gray-700">
              {FLOOR_NAMES[curFloor]}
            </span>
            <span className="text-[11px] text-[#534AB7] cursor-pointer hover:underline">Map view</span>
          </div>

          {/* Filter banner — only when stores selected */}
          {selectedStores.length > 0 && (
            <FilterBanner
              selectedStores={selectedStores}
              onClear={actions.clearStores}
            />
          )}

          {/* State C: filtered product view */}
          {showFilteredProducts && selectedStoreIds.length > 0 ? (
            <>
              {/* Back button replaces sticky bar */}
              <div className="px-4 mb-2">
                <button
                  onClick={() => actions.setShowFilteredProducts(false)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#085041] bg-[#E1F5EE] border border-[#5DCAA5] px-3 py-2 rounded-xl w-full justify-center hover:bg-[#c6ead9] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to store list
                </button>
              </div>

              {/* Category chips for store mode */}
              <CategoryChips
                selected={storeCat}
                onSelect={actions.setStoreCat}
                variant="store"
              />

              {/* Section header */}
              <div className="flex items-center justify-between px-4 pb-2">
                <span className="text-xs font-medium text-gray-700">
                  {storeModeProducts.length} product{storeModeProducts.length !== 1 ? 's' : ''} in selected stores
                </span>
              </div>

              {/* Filtered product grid */}
              <ProductGrid products={storeModeProducts} />
            </>
          ) : (
            <>
              {/* State A/B: store list */}
              <StoreList
                stores={storesByFloor}
                selectedIds={selectedStoreIds}
                onToggle={actions.toggleStore}
              />

              {/* State B: sticky action bar */}
              {selectedStoreIds.length > 0 && (
                <StickyActionBar
                  count={storeModeProducts.length}
                  onView={() => actions.setShowFilteredProducts(true)}
                />
              )}
            </>
          )}
        </>
      )}

      {/* ── Product bottom sheet ──────────────────────────────────────── */}
      {selectedProduct && (
        <ProductBottomSheet
          product={selectedProduct}
          onClose={() => actions.setSelectedProduct(null)}
        />
      )}

      {/* ── QR Scanner Modal ─────────────────────────────────────────── */}
      {showScanner && (
        <QrScannerModal
          title="Scan QR Produk / Toko"
          hint="Arahkan kamera ke QR code produk atau toko"
          resultParser={text => text}
          onResult={handleQrResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
