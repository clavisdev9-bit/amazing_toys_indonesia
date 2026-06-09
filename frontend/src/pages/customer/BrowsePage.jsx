import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang }                  from '../../context/LangContext';
import { usePublicConfig }          from '../../hooks/useAppLogo';
import { useCart }                  from '../../hooks/useCart';
import { getProductByBarcode }      from '../../api/products';
import { useCatalogueState }    from '../../hooks/useCatalogueState';
import { useWishlist }          from '../../hooks/useWishlist';
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
  const config        = usePublicConfig();
  const isApproveMode = config?.order_mode === 'HELPER_APPROVE';
  const { addItem }   = useCart();
  const { state, actions } = useCatalogueState();
  const { wishedIds, wishlistMode, setWishlistMode } = useWishlist();
  const searchRef      = useTourTarget('step-katalog-search');
  const categoriesRef  = useTourTarget('step-katalog-categories');
  const [showScanner, setShowScanner] = useState(false);
  const [scanToast, setScanToast]     = useState(null);

  const {
    mode, curCat, curFloor,
    selectedStoreIds, selectedStores,
    storeCat, showFilteredProducts,
    search, selectedProduct,
    products,
    productModeProducts, storeModeProducts, storesByFloor,
    categories, floors, loading,
  } = state;

  async function handleQrResult(text) {
    setShowScanner(false);

    if (!isApproveMode) {
      navigate(`/product/${text}`);
      return;
    }

    try {
      const res = await getProductByBarcode(text);
      const p   = res.data.data;
      addItem({
        product_id:   p.product_id,
        product_name: p.product_name,
        price:        p.price,
        tenant_id:    p.tenant_id,
        tenant_name:  p.tenant_name ?? '',
        image_url:    p.image_url  ?? null,
        is_on_hold:   p.is_on_hold ?? false,
      }, 1);
      setScanToast({ msg: `"${p.product_name}" ditambahkan ke keranjang`, type: 'success' });
      setTimeout(() => {
        setScanToast(null);
        navigate('/keranjang');
      }, 900);
    } catch {
      setScanToast({ msg: 'Produk tidak ditemukan. Coba scan ulang.', type: 'error' });
      setTimeout(() => setScanToast(null), 3000);
    }
  }

  // All products in wishlist (search-aware, ignores category filter)
  const wishlistProducts = useMemo(() => {
    let result = products.filter(p => wishedIds.includes(p.id));
    if (search.trim()) result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [products, wishedIds, search]);

  const floorLabel = FLOOR_NAMES[curFloor] ?? curFloor;

  const ScanToast = scanToast && (
    <div
      className="fixed top-4 left-1/2 z-[70] px-4 py-3 rounded-2xl text-sm font-semibold text-white shadow-lg"
      style={{
        transform: 'translateX(-50%)',
        minWidth: 220,
        textAlign: 'center',
        background: scanToast.type === 'success'
          ? 'linear-gradient(135deg,#087F5B,#2F9E44)'
          : 'linear-gradient(135deg,#C92A2A,#E03131)',
      }}
    >
      {scanToast.type === 'success' ? '✓ ' : '✕ '}{scanToast.msg}
    </div>
  );

  // ── Wishlist mode view ────────────────────────────────────────────────────
  if (wishlistMode) {
    return (
      <div className="max-w-[390px] mx-auto">
        {ScanToast}

        {/* Sticky controls */}
        <div
          className="sticky top-14 z-20 px-4 pt-3 pb-2.5 flex flex-col gap-2"
          style={{
            background: 'rgba(255,235,235,0.35)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.40)',
          }}
        >
          {/* Search bar */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex-1 flex items-center gap-2.5 h-11 px-3.5 rounded-[14px]"
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
                type="text"
                value={search}
                onChange={e => actions.setSearch(e.target.value)}
                placeholder="Cari di wishlist..."
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium"
                style={{ color: '#1A1A2E', fontFamily: 'inherit' }}
              />
              {search && (
                <button onClick={() => actions.setSearch('')} className="text-[#ADB5BD]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Close wishlist mode */}
            <button
              onClick={() => setWishlistMode(false)}
              className="shrink-0 h-11 px-4 flex items-center gap-1.5 rounded-[14px] text-xs font-bold transition-all duration-150 border-none cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1.5px solid rgba(255,255,255,0.75)',
                color: '#3B5BDB',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Tutup
            </button>
          </div>
        </div>

        {/* Wishlist header */}
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h2
            className="text-[15px] font-extrabold flex items-center gap-1.5"
            style={{ color: 'rgba(30,40,100,0.90)', textShadow: '0 1px 2px rgba(255,255,255,0.5)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#F03E3E">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            Wishlist Saya
          </h2>
          <span className="text-[13px] font-semibold" style={{ color: 'rgba(80,90,150,0.70)' }}>
            {wishlistProducts.length} produk tersimpan
          </span>
        </div>

        {loading ? (
          <div className="py-12"><Spinner /></div>
        ) : wishlistProducts.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center px-8 py-16 gap-4 text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,220,220,0.50)' }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F06595" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <div>
              <p className="text-[15px] font-extrabold mb-1" style={{ color: 'rgba(30,40,100,0.85)' }}>
                Wishlist masih kosong
              </p>
              <p className="text-[13px]" style={{ color: 'rgba(80,90,150,0.65)' }}>
                {search ? 'Produk tidak ditemukan di wishlist.' : 'Klik ❤️ pada produk favoritmu!'}
              </p>
            </div>
            <button
              onClick={() => setWishlistMode(false)}
              className="px-6 py-2.5 rounded-[14px] text-sm font-bold border-none cursor-pointer"
              style={{
                background: 'rgba(59,91,219,0.88)',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(59,91,219,0.25)',
              }}
            >
              Jelajahi Produk
            </button>
          </div>
        ) : (
          <ProductGrid products={wishlistProducts} />
        )}

        {/* Product bottom sheet */}
        {selectedProduct && (
          <ProductBottomSheet
            product={selectedProduct}
            onClose={() => actions.setSelectedProduct(null)}
          />
        )}
      </div>
    );
  }

  // ── Normal catalogue view ─────────────────────────────────────────────────
  return (
    <div className="max-w-[390px] mx-auto">
      {ScanToast}

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
    </div>
  );
}
