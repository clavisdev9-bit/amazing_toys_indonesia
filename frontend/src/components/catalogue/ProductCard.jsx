import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { getStockStatus, canAddToCart } from '../../utils/stockUtils';

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

export default function ProductCard({ product, tourAttr }) {
  const navigate    = useNavigate();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [wished, setWished] = useState(false);

  const { label: stockLabel, level: stockLevel } = getStockStatus(product.stock);
  const addable = canAddToCart(product.stock);

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
    }, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function handleWish(e) {
    e.stopPropagation();
    setWished(w => !w);
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
      {/* Image area */}
      <button onClick={goToDetail} className="text-left w-full relative" style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: product.colorHex || '#EEF2FF' }}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" />
          : <span className="text-5xl">🧸</span>
        }
        {/* Wishlist button */}
        <button
          onClick={handleWish}
          className="absolute top-2 right-2 flex items-center justify-center rounded-full border transition-transform duration-150 active:scale-125"
          style={{
            width: 28, height: 28,
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.85)',
            boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
            fontSize: 14,
          }}
          aria-label="Wishlist"
        >
          {wished ? '❤️' : '🤍'}
        </button>
      </button>

      {/* Info area */}
      <div
        className="flex flex-col flex-1 px-3 pt-2.5 pb-3 gap-1"
        style={{ background: 'rgba(255,255,255,0.35)' }}
      >
        <p className="text-[13px] font-bold truncate" style={{ color: 'rgba(25,35,90,0.90)' }}>
          {product.name}
        </p>
        <p className="text-[11px] font-semibold" style={{ color: 'rgba(80,95,160,0.70)' }}>
          {product.tenant_name || ''}
        </p>

        <div className="flex items-center justify-between gap-1">
          <span className="text-[14px] font-extrabold text-[#3B5BDB]">{formatPrice(product.price)}</span>
          <StockBadge level={stockLevel} label={stockLabel} />
        </div>

        {/* Add to cart button */}
        {addable ? (
          <button
            onClick={handleAddToCart}
            disabled={added}
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
            {added ? '✓ Ditambahkan' : '+ Keranjang'}
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
            Stok Habis
          </button>
        )}
      </div>
    </div>
  );
}
