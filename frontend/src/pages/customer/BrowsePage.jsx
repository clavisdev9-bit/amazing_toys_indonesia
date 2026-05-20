import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang }                  from '../../context/LangContext';
import { useCatalogueState }    from '../../hooks/useCatalogueState';
import { FLOOR_NAMES }          from '../../data/mockData';
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
import Spinner                  from '../../components/ui/Spinner';

export default function BrowsePage() {
  const navigate = useNavigate();
  const { t } = useLang();
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
    categories, floors, loading,
  } = state;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  function handleQrResult(text) {
    setShowScanner(false);
    // Try as product ID — let the detail page handle 404
    navigate(`/product/${text}`);
  }

  const floorLabel = FLOOR_NAMES[curFloor] ?? curFloor;

  return (
    <div className="max-w-[390px] mx-auto">

      {/* ── Sticky controls bar ───────────────────────────────────────── */}
      <div
        className="sticky top-14 z-20 px-4 pt-3 pb-2.5 flex flex-col gap-2"
        style={{
          background: 'rgba(185,205,255,0.30)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.40)',
        }}
      >

        {/* Search + QR button */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex-1 flex items-center gap-2.5 h-11 px-3.5 rounded-[14px] transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.52)',
              backdropFilter: 'blur(16px) saturate(1.7)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.7)',
              border: '1.5px solid rgba(255,255,255,0.75)',
              boxShadow: '0 2px 10px rgba(100,130,220,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#ADB5BD">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={searchRef}
              id="tour-search"
              type="text"
              value={search}
              onChange={e => actions.setSearch(e.target.value)}
              placeholder={mode === 'product' ? t('search.placeholder') : t('search.storePlaceholder')}
              className="flex-1 bg-transparent border-none outline-none text-sm font-medium"
              style={{ color: '#1A1A2E', fontFamily: 'inherit' }}
            />
            {search && (
              <button
                onClick={() => actions.setSearch('')}
                className="text-[#ADB5BD] hover:text-[#868E96] shrink-0"
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
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-[14px] border-none cursor-pointer transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.52)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1.5px solid rgba(255,255,255,0.75)',
              boxShadow: '0 2px 10px rgba(100,130,220,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}
            aria-label="Scan QR"
          >
            <svg width="20" height="20" fill="none" stroke="#3B5BDB" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="3" height="3" /><rect x="18" y="14" width="3" height="3" />
              <rect x="14" y="18" width="3" height="3" /><rect x="18" y="18" width="3" height="3" />
            </svg>
          </button>
        </div>

        {/* Mode toggle */}
        <ModeToggle mode={mode} onSetMode={actions.setMode} />
      </div>

      {/* Loading state */}
      {loading && <div className="py-12"><Spinner /></div>}

      {/* ══════════════════════════════════════════════════════════════════
          BY PRODUCT MODE
      ══════════════════════════════════════════════════════════════════ */}
      {!loading && mode === 'product' && (
        <>
          {/* Category chips — tour target */}
          <div ref={categoriesRef} id="tour-categories">
            <CategoryChips
              selected={curCat}
              onSelect={actions.setCurCat}
              categories={categories}
              variant="product"
            />
          </div>

          {/* Section header */}
          <div className="flex items-center justify-between px-4 pb-2 pt-1">
            <h2 className="text-[15px] font-extrabold" style={{ color: 'rgba(30,40,100,0.90)', textShadow: '0 1px 2px rgba(255,255,255,0.5)' }}>
              {curCat === 'All' ? t('browse.allProducts') : curCat}
            </h2>
            <span className="text-[13px] font-semibold" style={{ color: 'rgba(80,90,150,0.70)' }}>
              {t('browse.items', { count: productModeProducts.length })}
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
      {!loading && mode === 'store' && (
        <>
          {/* Floor chips */}
          <FloorChips selected={curFloor} onSelect={actions.setCurFloor} floors={floors} />

          {/* Section header */}
          <div className="flex items-center justify-between px-4 pb-2 pt-1">
            <h2 className="text-[15px] font-extrabold" style={{ color: 'rgba(30,40,100,0.90)', textShadow: '0 1px 2px rgba(255,255,255,0.5)' }}>
              {floorLabel}
            </h2>
            <span className="text-[13px] font-semibold" style={{ color: 'rgba(80,90,150,0.70)' }}>
              {t('browse.products', { count: storeModeProducts.length })}
            </span>
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
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl w-full justify-center transition-all duration-150 border-none cursor-pointer"
                  style={{
                    background: 'rgba(255,255,255,0.52)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1.5px solid rgba(255,255,255,0.75)',
                    color: '#3B5BDB',
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {t('browse.backToStores')}
                </button>
              </div>

              {/* Category chips for store mode */}
              <CategoryChips
                selected={storeCat}
                onSelect={actions.setStoreCat}
                categories={categories}
                variant="store"
              />

              {/* Section header */}
              <div className="flex items-center justify-between px-4 pb-2 pt-1">
                <h2 className="text-[15px] font-extrabold" style={{ color: 'rgba(30,40,100,0.90)', textShadow: '0 1px 2px rgba(255,255,255,0.5)' }}>
                  {t('browse.selectedProducts')}
                </h2>
                <span className="text-[13px] font-semibold" style={{ color: 'rgba(80,90,150,0.70)' }}>
                  {t('browse.items', { count: storeModeProducts.length })}
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
          title={t('browse.scanQRTitle')}
          hint={t('browse.scanQRHint')}
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
