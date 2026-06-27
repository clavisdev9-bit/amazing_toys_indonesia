import React, { useState, useRef, useCallback } from 'react';
import { useNavigate }            from 'react-router-dom';
import { useLang }                from '../../context/LangContext';
import { usePublicConfig }        from '../../hooks/useAppLogo';
import { useCart }                from '../../hooks/useCart';
import { useCatalogueContext }    from '../../context/CatalogueContext';
import { getProductByBarcode }    from '../../api/products';
import ProductCard                from '../../components/catalogue/ProductCard';
import StoreList                  from '../../components/catalogue/StoreList';
import FilterBanner               from '../../components/catalogue/FilterBanner';
import StickyActionBar            from '../../components/catalogue/StickyActionBar';
import CategoryChips              from '../../components/catalogue/CategoryChips';
import ProductBottomSheet         from '../../components/catalogue/ProductBottomSheet';
import Spinner                    from '../../components/ui/Spinner';
import { FLOOR_NAMES }            from '../../data/mockData';

const PAGE_SIZE = 18; // 3-col × 6 rows per batch

// ── 3-column lazy product grid ────────────────────────────────────────────────
function DesktopProductGrid({ products }) {
  const { t } = useLang();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerRef = useRef(null);

  const sentinelRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(prev => Math.min(prev + PAGE_SIZE, products.length)); },
      { threshold: 0.1 }
    );
    observerRef.current.observe(node);
  }, [products.length]);

  // Reset pagination when product list changes (filter, search, category switch)
  const prevLength = useRef(products.length);
  if (products.length !== prevLength.current) {
    prevLength.current = products.length;
    if (visibleCount > PAGE_SIZE) setVisibleCount(PAGE_SIZE);
  }

  if (products.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>😔</div>
        <p style={{ fontWeight: 700, color: 'rgba(30,40,100,0.80)', marginBottom: 4 }}>{t('product.notFound')}</p>
        <p style={{ fontSize: 12, color: 'rgba(80,95,160,0.60)' }}>{t('product.tryOther')}</p>
      </div>
    );
  }

  const visible = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, padding: '0 20px 24px' }}>
        {visible.map((p, idx) => (
          <ProductCard key={p.id} product={p} isFirstCard={idx === 0} />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 24px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(59,91,219,0.45)', display: 'inline-block', animationName: 'bounce', animationDuration: '1s', animationDelay: `${i * 0.12}s`, animationIterationCount: 'infinite' }} />
            ))}
          </div>
        </div>
      )}
      {!hasMore && products.length > PAGE_SIZE && (
        <p style={{ textAlign: 'center', fontSize: 12, paddingBottom: 24, color: 'rgba(80,95,160,0.50)' }}>
          {t('product.allLoaded') ?? 'Semua produk sudah ditampilkan'}
        </p>
      )}
    </>
  );
}

// ── Floor tab strip ───────────────────────────────────────────────────────────
function FloorTabs({ floors, current, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      background: 'rgba(255,255,255,0.35)', borderRadius: 10,
      border: '1.5px solid rgba(200,210,240,0.50)', overflow: 'hidden',
    }}>
      {floors.map(f => {
        const label = FLOOR_NAMES[f] ?? f;
        const active = current === f;
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 700,
              color: active ? '#3B5BDB' : '#868E96',
              background: active ? 'rgba(255,255,255,0.85)' : 'none',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              borderRadius: active ? 8 : 0, transition: 'all 0.15s',
            }}
          >{label}</button>
        );
      })}
    </div>
  );
}

// ── Mode toggle ───────────────────────────────────────────────────────────────
function ModeToggle({ mode, onChange }) {
  const MODES = [
    { key: 'product', label: 'Per Produk', icon: (
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    )},
    { key: 'store', label: 'Per Toko', icon: (
      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )},
  ];

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {MODES.map(({ key, label, icon }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              background: active ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.35)',
              border: `1.5px solid ${active ? 'rgba(116,143,252,0.35)' : 'transparent'}`,
              color: active ? '#3B5BDB' : '#868E96',
              boxShadow: active ? '0 2px 8px rgba(59,91,219,0.10)' : 'none',
            }}
          >
            {icon}{label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BrowsePageDesktop() {
  const navigate = useNavigate();
  const { t }    = useLang();
  const config   = usePublicConfig();
  const isApproveMode = config?.order_mode === 'HELPER_APPROVE';
  const { addItem }   = useCart();

  const { state, actions } = useCatalogueContext();
  const {
    mode, curCat, curFloor,
    selectedStoreIds, selectedStores,
    storeCat, showFilteredProducts,
    products, productModeProducts, storeModeProducts, storesByFloor,
    categories, floors, loading, selectedProduct,
  } = state;

  const [preorderOnly, setPreorderOnly] = useState(false);
  const [scanToast,    setScanToast]    = useState(null);

  const hasPreorder = products.some(p => p.is_preorder);
  const displayProducts = preorderOnly
    ? productModeProducts.filter(p => p.is_preorder)
    : productModeProducts;

  const floorLabel = FLOOR_NAMES[curFloor] ?? curFloor;

  // QR scan result (triggered from header scan button via shell)
  async function handleQrResult(text) {
    if (!isApproveMode) { navigate(`/product_cart/${text}`); return; }
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
      setScanToast({ msg: `"${p.product_name}" ${t('browse.scanAddedToCart')}`, type: 'success' });
      setTimeout(() => setScanToast(null), 1200);
    } catch {
      setScanToast({ msg: t('browse.scanNotFound'), type: 'error' });
      setTimeout(() => setScanToast(null), 3000);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Scan toast */}
      {scanToast && (
        <div style={{
          position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)',
          zIndex: 70, minWidth: 240, textAlign: 'center',
          padding: '10px 20px', borderRadius: 14,
          color: '#fff', fontSize: 13, fontWeight: 700,
          background: scanToast.type === 'success'
            ? 'linear-gradient(135deg,#087F5B,#2F9E44)'
            : 'linear-gradient(135deg,#C92A2A,#E03131)',
        }}>
          {scanToast.type === 'success' ? '✓ ' : '✕ '}{scanToast.msg}
        </div>
      )}

      {/* ── Mode bar (sticky) ──────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        padding: '12px 20px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        background: 'rgba(185,205,255,0.22)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.40)',
      }}>
        <ModeToggle mode={mode} onChange={actions.setMode} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Pre-order chip — product mode only */}
          {mode === 'product' && hasPreorder && (
            <button
              onClick={() => setPreorderOnly(v => !v)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                fontFamily: 'inherit', cursor: 'pointer', border: '1.5px solid transparent',
                transition: 'all 0.2s',
                ...(preorderOnly
                  ? { background: 'rgba(234,88,12,0.90)', borderColor: 'rgba(234,88,12,0.40)', color: '#fff', boxShadow: '0 3px 10px rgba(234,88,12,0.28)' }
                  : { background: 'rgba(255,237,213,0.70)', borderColor: 'rgba(234,88,12,0.20)', color: '#C2410C' }),
              }}
            >🔖 Pre-Order</button>
          )}

          {/* Floor tabs — store mode only */}
          {mode === 'store' && floors.length > 0 && (
            <FloorTabs floors={floors} current={curFloor} onChange={actions.setCurFloor} />
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
          <Spinner />
        </div>
      )}

      {/* ── PRODUCT MODE ──────────────────────────────────────────── */}
      {!loading && mode === 'product' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'rgba(30,40,100,0.90)' }}>
              {preorderOnly ? 'Pre-Order' : curCat === 'All' ? t('browse.allProducts') : curCat}
            </h2>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(80,90,150,0.70)' }}>
              {t('browse.items', { count: displayProducts.length })}
            </span>
          </div>
          <DesktopProductGrid products={displayProducts} />
        </>
      )}

      {/* ── STORE MODE ───────────────────────────────────────────── */}
      {!loading && mode === 'store' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'rgba(30,40,100,0.90)' }}>
              {floorLabel}
            </h2>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(80,90,150,0.70)' }}>
              {storeModeProducts.length > 0
                ? t('browse.products', { count: storeModeProducts.length })
                : `${storesByFloor.length} toko`}
            </span>
          </div>

          {selectedStores.length > 0 && (
            <FilterBanner selectedStores={selectedStores} onClear={actions.clearStores} />
          )}

          {showFilteredProducts && selectedStoreIds.length > 0 ? (
            <>
              <div style={{ padding: '0 20px 8px' }}>
                <button
                  onClick={() => actions.setShowFilteredProducts(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 600, padding: '7px 16px',
                    borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                    background: 'rgba(255,255,255,0.52)', border: '1.5px solid rgba(255,255,255,0.75)',
                    color: '#3B5BDB', backdropFilter: 'blur(12px)',
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                  {t('browse.backToStores')}
                </button>
              </div>

              {/* Category chips within store mode */}
              <CategoryChips
                selected={storeCat}
                onSelect={actions.setStoreCat}
                categories={categories}
                variant="store"
              />

              <DesktopProductGrid products={storeModeProducts} />
            </>
          ) : (
            <>
              {/* Store list — inline padding override for desktop */}
              <div style={{ padding: '0 20px' }}>
                <StoreList
                  stores={storesByFloor}
                  selectedIds={selectedStoreIds}
                  onToggle={actions.toggleStore}
                />
              </div>

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

      {/* ── Product detail bottom sheet ──────────────────────────── */}
      {selectedProduct && (
        <ProductBottomSheet
          product={selectedProduct}
          onClose={() => actions.setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
