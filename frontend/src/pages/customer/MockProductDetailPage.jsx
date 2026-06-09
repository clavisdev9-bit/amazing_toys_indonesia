import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduct, getProductByBarcode } from '../../api/products';
import { getStockStatus } from '../../utils/stockUtils';
import { useCart } from '../../hooks/useCart';
import { useLang } from '../../context/LangContext';
import { useWishlist } from '../../hooks/useWishlist';
import { usePublicConfig } from '../../hooks/useAppLogo';
import Spinner from '../../components/ui/Spinner';

function formatPrice(price) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(price ?? 0);
}

function SpecItem({ emoji, value, label }) {
  return (
    <div style={{
      flex: 1,
      background: '#F8FAFC',
      borderRadius: 12,
      padding: '9px 6px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      border: '0.5px solid #E2E8F0',
      minWidth: 0,
    }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
      <span style={{
        fontSize: 9.5, fontWeight: 700, color: '#0F172A',
        textAlign: 'center', lineHeight: 1.25,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        maxWidth: '100%',
      }}>
        {value}
      </span>
      <span style={{ fontSize: 8.5, color: '#94A3B8', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

const STOCK_BADGE = {
  available: { background: 'rgba(230,252,245,0.90)', color: '#087F5B', border: '1px solid rgba(8,127,91,0.18)' },
  low:       { background: 'rgba(255,249,219,0.90)', color: '#E67700', border: '1px solid rgba(230,119,0,0.18)' },
  out:       { background: 'rgba(255,227,227,0.90)', color: '#C92A2A', border: '1px solid rgba(201,42,42,0.18)' },
};

export default function MockProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { t } = useLang();
  const { isWished, toggleWish } = useWishlist();
  const config       = usePublicConfig();
  const ppnRate      = parseFloat(config?.ppn_rate) || 0;
  const isHelperMode = (config?.order_mode ?? 'HELPER_INPUT') === 'HELPER_INPUT';
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setLoading(true);
    getProduct(id)
      .then((r) => setProduct(r.data.data))
      .catch(() =>
        // Fallback: id might be a barcode value (from QR scan) instead of product_id
        getProductByBarcode(id)
          .then((r) => setProduct(r.data.data))
          .catch(() => setProduct(null))
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;

  if (!product) {
    return (
      <div className="max-w-[390px] mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-sm font-medium text-gray-700 mb-1">Produk tidak ditemukan</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-[#6366F1]">
          ← Kembali
        </button>
      </div>
    );
  }

  const stock = product.stock_quantity ?? 0;
  const { key: stockKey, level: stockLevel } = getStockStatus(stock);
  const stockBadge = STOCK_BADGE[stockLevel] ?? STOCK_BADGE.available;
  const inStock = stock > 0;
  const categName = product.odoo_categ_name || product.category || '-';

  function handleAddToCart() {
    addItem({
      product_id:   product.product_id,
      product_name: product.product_name,
      price:        product.price,
      tenant_id:    product.tenant_id,
      tenant_name:  product.tenant_name,
      image_url:    product.image_url || null,
    }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div
      className="max-w-[390px] mx-auto"
      style={{ paddingBottom: inStock ? 175 : 24 }}
    >

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden flex items-center justify-center"
        style={{
          height: 288,
          background: (product.image_url && !imgError)
            ? '#0F172A'
            : 'linear-gradient(145deg, #EEF2FF 0%, #E0E7FF 60%, #C7D2FE 100%)',
        }}
      >
        {product.image_url && !imgError ? (
          <img
            src={product.image_url}
            alt={product.product_name}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ fontSize: 96, userSelect: 'none' }}>🧸</span>
        )}

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          aria-label="Kembali"
          style={{
            position: 'absolute', top: 14, left: 14,
            width: 34, height: 34, borderRadius: 12,
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.90)',
            boxShadow: '0 1px 8px rgba(0,0,0,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Wishlist button */}
        <button
          onClick={() => product && toggleWish(product.product_id ?? product.id)}
          aria-label="Wishlist"
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 34, height: 34, borderRadius: 12,
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.90)',
            boxShadow: '0 1px 8px rgba(0,0,0,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 17, lineHeight: 1,
          }}
        >
          {product && isWished(product.product_id ?? product.id) ? '❤️' : '🤍'}
        </button>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          marginTop: -16,
          position: 'relative',
          padding: '20px 16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Booth name (brand) + stock badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#6366F1',
            textTransform: 'uppercase', letterSpacing: '0.9px',
          }}>
            {product.tenant_name}
          </span>
          <span style={{
            fontSize: 10.5, fontWeight: 700,
            padding: '3px 12px', borderRadius: 20,
            ...stockBadge,
          }}>
            {t(stockKey)}
          </span>
        </div>

        {/* Product name */}
        <h1 style={{ fontSize: 19, fontWeight: 800, color: '#0F172A', lineHeight: 1.3, margin: 0 }}>
          {product.product_name}
        </h1>

        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#6366F1' }}>
            {formatPrice(Math.round(product.price * (1 + ppnRate / 100)))}
          </span>
        </div>

        {/* Spec strip */}
        <div style={{ display: 'flex', gap: 8 }}>
          <SpecItem emoji="🏪" value={product.tenant_name} label="Booth" />
          <SpecItem emoji="📍" value={product.booth_location ?? '-'} label="Lokasi" />
          <SpecItem emoji="📦" value={`${stock} pcs`} label="Stok" />
        </div>

        {/* Category chips */}
        <div>
          <p style={{
            fontSize: 11, fontWeight: 700, color: '#334155',
            letterSpacing: '0.4px', marginBottom: 8,
          }}>
            KATEGORI
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              padding: '5px 14px', borderRadius: 20,
              fontSize: 12, fontWeight: 600,
              background: '#EEF2FF', border: '1.5px solid #6366F1', color: '#4F46E5',
            }}>
              {categName}
            </span>
            {product.floor_label && (
              <span style={{
                padding: '5px 14px', borderRadius: 20,
                fontSize: 12, fontWeight: 600,
                background: '#F0FDF4', border: '1.5px solid #22C55E', color: '#16A34A',
              }}>
                Lantai {product.floor_label}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <p style={{
            fontSize: 11, fontWeight: 700, color: '#334155',
            letterSpacing: '0.4px', marginBottom: 8,
          }}>
            DESKRIPSI
          </p>
          {product.description ? (
            <div style={{
              background: '#F8FAFC',
              borderRadius: 14,
              padding: '12px 14px',
              border: '0.5px solid #E2E8F0',
            }}>
              <p style={{
                fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0,
                whiteSpace: 'pre-wrap',
              }}>
                {product.description}
              </p>
            </div>
          ) : (
            <div style={{
              background: '#F8FAFC',
              borderRadius: 14,
              padding: '12px 14px',
              border: '0.5px solid #E2E8F0',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 12, color: '#CBD5E1', margin: 0, fontStyle: 'italic' }}>
                Belum ada deskripsi produk
              </p>
            </div>
          )}
        </div>

        {/* Out of stock fallback CTA */}
        {!inStock && (
          <div
            style={{
              padding: '13px 16px',
              background: '#F8FAFC',
              borderRadius: 14,
              textAlign: 'center',
              border: '1px solid #E2E8F0',
              color: '#94A3B8',
              fontSize: 13, fontWeight: 600,
            }}
          >
            Stok Habis
          </div>
        )}
      </div>

      {/* ── Sticky CTA (qty pill + cart circle) ───────────────────────── */}
      {isHelperMode ? (
        <div
          style={{
            position: 'fixed',
            bottom: 120,
            left: 0, right: 0, zIndex: 20,
            padding: '12px 16px',
            background: 'rgba(245,243,255,0.97)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderTop: '0.5px solid #DDD6FE',
            boxShadow: '0 -4px 20px rgba(109,40,217,0.06)',
          }}
        >
          <div style={{ maxWidth: 390, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🙋</span>
            <p style={{ fontSize: 13, color: '#6D28D9', fontWeight: 600, margin: 0 }}>
              Pemesanan dilakukan melalui petugas booth
            </p>
          </div>
        </div>
      ) : inStock && (
        <div
          style={{
            position: 'fixed',
            bottom: 120,
            left: 0, right: 0, zIndex: 20,
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderTop: '0.5px solid #E2E8F0',
            boxShadow: '0 -4px 20px rgba(99,102,241,0.06)',
          }}
        >
          <div
            style={{
              maxWidth: 390,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Qty pill */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                background: '#F1F5F9',
                borderRadius: 40,
                height: 48,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                style={{
                  flex: 1, height: 48,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 300, color: '#6366F1',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
                aria-label="Kurang"
              >
                −
              </button>
              <span style={{
                fontSize: 15, fontWeight: 700, color: '#0F172A',
                minWidth: 32, textAlign: 'center',
              }}>
                {qty}
              </span>
              <button
                onClick={() => setQty(q => Math.min(stock, q + 1))}
                style={{
                  flex: 1, height: 48,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 300, color: '#6366F1',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
                aria-label="Tambah"
              >
                +
              </button>
            </div>

            {/* Cart circle button */}
            <button
              onClick={handleAddToCart}
              disabled={added}
              aria-label="Tambah ke keranjang"
              style={{
                width: 48, height: 48, flexShrink: 0,
                borderRadius: '50%',
                background: added ? '#22C55E' : '#6366F1',
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: added ? 'default' : 'pointer',
                boxShadow: added
                  ? '0 4px 14px rgba(34,197,94,0.35)'
                  : '0 4px 14px rgba(99,102,241,0.35)',
                transition: 'background 0.2s, box-shadow 0.2s',
              }}
            >
              {added ? (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
