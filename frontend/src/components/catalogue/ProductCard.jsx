import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { useLang } from '../../context/LangContext';
import { useWishlist } from '../../hooks/useWishlist';
import { getStockStatus, canAddToCart } from '../../utils/stockUtils';
import { usePublicConfig } from '../../hooks/useAppLogo';

function formatPrice(price) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price ?? 0);
}

function StockBadge({ level, label }) {
  const styles = {
    available: { background: 'rgba(230,252,245,0.85)', color: '#087F5B', border: '1px solid rgba(8,127,91,0.15)' },
    limited:   { background: 'rgba(255,249,219,0.85)', color: '#E67700', border: '1px solid rgba(230,119,0,0.15)' },
    sold:      { background: 'rgba(255,227,227,0.85)', color: '#C92A2A', border: '1px solid rgba(201,42,42,0.15)' },
  };
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-[8px] shrink-0"
      style={{ backdropFilter: 'blur(6px)', ...styles[level] }}
    >
      {label}
    </span>
  );
}

// SVG heart icons for crisper rendering and better animation control
function HeartIcon({ filled }) {
  return filled ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="#F03E3E">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ADB5BD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export default function ProductCard({ product, tourAttr, isFirstCard }) {
  const navigate    = useNavigate();
  const { addItem } = useCart();
  const { t } = useLang();
  const { isWished, toggleWish } = useWishlist();
  const [added, setAdded]       = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const [imgError, setImgError] = useState(false);
  const config       = usePublicConfig();
  const ppnRate      = parseFloat(config?.ppn_rate) || 0;
  const isHelperMode  = (config?.order_mode ?? 'HELPER_INPUT') === 'HELPER_INPUT';
  const isApproveMode = config?.order_mode === 'HELPER_APPROVE';

  const { key: stockKey, level: stockLevel } = getStockStatus(product.stock);
  const addable = canAddToCart(product.stock);
  const wished  = isWished(product.id);

  function goToDetail() {
    navigate(`/product/${product.id}`);
  }

  function handleAddToCart(e) {
    e.stopPropagation();
    addItem({
      product_id:   product.id,
      product_name: product.name,
      price:        product.price,
      tenant_id:    product.tenant_id,
      tenant_name:  product.tenant_name,
      image_url:    product.image_url || null,
      is_on_hold:   product.is_on_hold || false,
    }, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function handleWish(e) {
    e.stopPropagation();
    setBouncing(true);
    setTimeout(() => setBouncing(false), 350);
    toggleWish(product.id);
  }

  return (
    <div
      className="flex flex-col overflow-hidden cursor-pointer active:scale-[0.97] transition-transform duration-[180ms]"
      style={{
        background: 'rgba(255,255,255,0.48)',
        backdropFilter: 'blur(18px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.8)',
        borderRadius: 16,
        border: '1.5px solid rgba(255,255,255,0.75)',
        boxShadow: '0 4px 20px rgba(100,130,220,0.10), 0 1px 4px rgba(100,130,220,0.06), inset 0 1px 0 rgba(255,255,255,0.85)',
      }}
      {...tourAttr}
    >
      {/* Image area — div instead of button to avoid nested-button violation */}
      <div
        onClick={goToDetail}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && goToDetail()}
        className="text-left w-full relative cursor-pointer"
        style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: product.colorHex || '#EEF2FF' }}
      >
        {product.image_url && !imgError
          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" onError={() => setImgError(true)} />
          : <span className="text-5xl">🧸</span>
        }

        {/* PRE-ORDER badge overlay */}
        {product.is_preorder && (
          <span
            className="absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-wide"
            style={{ background: 'rgba(234,88,12,0.92)', color: '#fff', backdropFilter: 'blur(6px)' }}
          >
            PRE-ORDER
          </span>
        )}

        {/* Wishlist button */}
        <button
          onClick={handleWish}
          className="absolute top-2 right-2 flex items-center justify-center rounded-full"
          style={{
            width: 28, height: 28,
            background: wished ? 'rgba(255,235,235,0.92)' : 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: wished ? '1px solid rgba(240,62,62,0.25)' : '1px solid rgba(255,255,255,0.85)',
            boxShadow: wished
              ? '0 1px 6px rgba(240,62,62,0.20)'
              : '0 1px 6px rgba(0,0,0,0.08)',
            transform: bouncing ? 'scale(1.28)' : 'scale(1)',
            transition: bouncing
              ? 'transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              : 'transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
          aria-label={wished ? 'Hapus dari wishlist' : 'Tambah ke wishlist'}
        >
          <HeartIcon filled={wished} />
        </button>
      </div>

      {/* Info area */}
      <div
        className="flex flex-col flex-1 px-3 pt-2.5 pb-3 gap-1"
        style={{ background: 'rgba(255,255,255,0.35)' }}
      >
        <p className="text-[13px] font-bold truncate" style={{ color: 'rgba(25,35,90,0.90)' }}>
          {product.name}
        </p>
        {product.is_preorder && product.preorder_note && (
          <p className="text-[10px] truncate" style={{ color: '#EA580C' }}>
            {product.preorder_note}
          </p>
        )}
        <p className="text-[11px] font-semibold" style={{ color: 'rgba(80,95,160,0.70)' }}>
          {product.tenant_name || ''}
        </p>

        <div className="flex items-center justify-between gap-1">
          <span className="text-[14px] font-extrabold text-[#3B5BDB]">{formatPrice(Math.round(product.price * (1 + ppnRate / 100)))}</span>
          {product.is_preorder
            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-[8px]" style={{ background: 'rgba(255,237,213,0.85)', color: '#EA580C', border: '1px solid rgba(234,88,12,0.15)' }}>Pre-Order</span>
            : <StockBadge level={stockLevel} label={t(stockKey)} />
          }
        </div>

        {/* Add to cart button — hidden in helper/approve mode */}
        {!(isHelperMode || isApproveMode) && (
          addable ? (
            <button
              onClick={handleAddToCart}
              disabled={added}
              data-tour={isFirstCard ? 'add-to-cart' : undefined}
              className="w-full flex items-center justify-center gap-1 py-2 rounded-[10px] text-xs font-bold transition-all duration-150 border-none cursor-pointer mt-1"
              style={
                added
                  ? { background: 'rgba(64,192,87,0.85)', color: '#fff' }
                  : {
                      background: 'rgba(59,91,219,0.88)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      color: 'rgba(255,255,255,0.97)',
                      border: '1px solid rgba(116,143,252,0.40)',
                      boxShadow: '0 2px 8px rgba(59,91,219,0.22), inset 0 1px 0 rgba(255,255,255,0.18)',
                    }
              }
            >
              {added ? t('product.added') : t('product.addToCart')}
            </button>
          ) : (
            <button
              disabled
              className="w-full flex items-center justify-center py-2 rounded-[10px] text-xs font-bold mt-1 border-none cursor-not-allowed"
              style={{
                background: 'rgba(220,224,235,0.55)',
                color: 'rgba(100,110,160,0.65)',
                border: '1px solid rgba(200,205,230,0.5)',
              }}
            >
              {t('product.outOfStock')}
            </button>
          )
        )}
      </div>
    </div>
  );
}
