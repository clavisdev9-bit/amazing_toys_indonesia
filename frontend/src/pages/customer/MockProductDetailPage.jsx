import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduct, getProductByBarcode } from '../../api/products';
import { getStockStatus } from '../../utils/stockUtils';
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
  const { t } = useLang();
  const { isWished, toggleWish } = useWishlist();
  const config  = usePublicConfig();
  const ppnRate = parseFloat(config?.ppn_rate) || 0;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
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
        <p className="text-sm font-medium text-gray-700 mb-1">{t('product.notFoundDetail')}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-[#6366F1]">
          {t('back')}
        </button>
      </div>
    );
  }

  const stock = product.stock_quantity ?? 0;
  const { key: stockKey, level: stockLevel } = getStockStatus(stock);
  const stockBadge = STOCK_BADGE[stockLevel] ?? STOCK_BADGE.available;
  const inStock = stock > 0;
  const isPreorder = !!product.is_preorder;
  const preorderNote = product.preorder_note || null;
  const categName = product.odoo_categ_name || product.category || '-';

  return (
    <div
      className="max-w-[390px] mx-auto"
      style={{ paddingBottom: 24 }}
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

        {/* Pre-Order overlay badge */}
        {isPreorder && (
          <span style={{
            position: 'absolute', bottom: 14, left: 14,
            fontSize: 11, fontWeight: 800, letterSpacing: '0.8px',
            padding: '4px 12px', borderRadius: 20,
            background: 'rgba(234,88,12,0.92)',
            color: '#fff',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 2px 8px rgba(234,88,12,0.35)',
          }}>
            PRE-ORDER
          </span>
        )}
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
        {/* Booth name (brand) + status badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#6366F1',
            textTransform: 'uppercase', letterSpacing: '0.9px',
          }}>
            {product.tenant_name}
          </span>
          {isPreorder ? (
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              padding: '3px 12px', borderRadius: 20,
              background: 'rgba(255,237,213,0.90)', color: '#C2410C',
              border: '1px solid rgba(234,88,12,0.18)',
            }}>
              Pre-Order
            </span>
          ) : (
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              padding: '3px 12px', borderRadius: 20,
              ...stockBadge,
            }}>
              {t(stockKey)}
            </span>
          )}
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

        {/* Pre-Order info box */}
        {isPreorder && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,237,213,0.80) 0%, rgba(254,215,170,0.60) 100%)',
            border: '1px solid rgba(234,88,12,0.20)',
            borderRadius: 14,
            padding: '12px 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>🔖</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#9A3412' }}>
                Produk Pre-Order
              </span>
              {preorderNote && (
                <span style={{ fontSize: 12, color: '#C2410C', lineHeight: 1.5 }}>
                  {preorderNote}
                </span>
              )}
              <span style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
                Pembayaran dilakukan sekarang. Barang dikirim/diambil sesuai estimasi.
              </span>
            </div>
          </div>
        )}

        {/* Spec strip */}
        <div style={{ display: 'flex', gap: 8 }}>
          <SpecItem emoji="🏪" value={product.tenant_name} label={t('product.booth')} />
          <SpecItem emoji="📍" value={product.booth_location ?? '-'} label={t('product.location')} />
        </div>

        {/* Category chips */}
        <div>
          <p style={{
            fontSize: 11, fontWeight: 700, color: '#334155',
            letterSpacing: '0.4px', marginBottom: 8,
          }}>
            {t('product.detail.category')}
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
                {t('product.detail.floor', { n: product.floor_label })}
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
            {t('product.detail.description')}
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
                {t('product.detail.noDesc')}
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
            {t('product.outOfStock')}
          </div>
        )}
      </div>

    </div>
  );
}
