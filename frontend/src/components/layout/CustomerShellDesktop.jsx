import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth }        from '../../hooks/useAuth';
import { useCart }        from '../../hooks/useCart';
import { usePublicConfig } from '../../hooks/useAppLogo';
import { useLang, SUPPORTED_LANGS } from '../../context/LangContext';
import { useWishlist }    from '../../hooks/useWishlist';
import { useWebSocket }   from '../../hooks/useWebSocket';
import { useCatalogueState } from '../../hooks/useCatalogueState';
import { CatalogueContext } from '../../context/CatalogueContext';
import { formatRupiah }   from '../../utils/format';
import VoucherInput       from '../cart/VoucherInput';
import QrScannerModal     from '../ui/QrScannerModal';
import MapModal           from '../ui/MapModal';

// ── Design tokens ─────────────────────────────────────────────────────────────
const MESH_BG = `
  radial-gradient(ellipse 65% 55% at 15% 8%,  rgba(160,190,255,0.80) 0%, transparent 68%),
  radial-gradient(ellipse 55% 50% at 88% 18%, rgba(210,170,255,0.65) 0%, transparent 65%),
  radial-gradient(ellipse 55% 50% at 8%  75%, rgba(140,215,255,0.60) 0%, transparent 65%),
  radial-gradient(ellipse 60% 55% at 82% 82%, rgba(255,180,215,0.55) 0%, transparent 68%),
  radial-gradient(ellipse 45% 40% at 50% 48%, rgba(200,215,255,0.45) 0%, transparent 60%),
  linear-gradient(155deg, #b8ccff 0%, #dcc8ff 38%, #ffc8e0 68%, #b8e8ff 100%)
`;

const GLASS = {
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(22px) saturate(1.9)',
  WebkitBackdropFilter: 'blur(22px) saturate(1.9)',
};

const SIDEBAR_GLASS = {
  background: 'rgba(255,255,255,0.45)',
  backdropFilter: 'blur(24px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
};

const NOTIF_TTL_MS = 8_000;

// ── Language dropdown ─────────────────────────────────────────────────────────
function LangDropdown({ lang, setLang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = SUPPORTED_LANGS.find(l => l.code === lang) ?? SUPPORTED_LANGS[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(248,249,254,0.85)', border: '1.5px solid #DEE2E6',
          borderRadius: 20, padding: '4px 10px',
          cursor: 'pointer', fontSize: 11, fontWeight: 700,
          color: '#3B5BDB', lineHeight: 1, fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>🌐</span>
        <span>{current.code.toUpperCase()}</span>
        <span style={{ fontSize: 9, color: '#868E96', marginLeft: 1 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#fff', border: '1.5px solid #DEE2E6',
          borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          overflow: 'hidden', zIndex: 200, minWidth: 90,
        }}>
          {SUPPORTED_LANGS.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => { setLang(code); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 14px', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                background: lang === code ? '#EEF2FF' : 'transparent',
                color: lang === code ? '#3B5BDB' : '#495057',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Order notification card ───────────────────────────────────────────────────
function OrderNotifCard({ notif, onDismiss, onOpen }) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), NOTIF_TTL_MS);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line

  return (
    <div
      role="alertdialog"
      style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(59,91,219,0.22), 0 2px 8px rgba(59,91,219,0.10)',
        border: '1.5px solid rgba(59,91,219,0.18)',
        cursor: 'pointer', maxWidth: 320,
        animation: 'desktopNotifSlide 260ms cubic-bezier(.22,.68,0,1.2)',
      }}
      onClick={onOpen}
    >
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, #3B5BDB, #748FFC)',
        animationName: 'desktopNotifProgress',
        animationDuration: `${NOTIF_TTL_MS}ms`,
        animationTimingFunction: 'linear',
        animationFillMode: 'forwards',
      }} />
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>🛒</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#3B5BDB', marginBottom: 1 }}>Pesanan siap dibayar</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1A1B2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {notif.boothName}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#3B5BDB', marginTop: 3 }}>
            {formatRupiah(notif.totalAmount)}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          style={{ background: 'none', border: 'none', color: '#CED4DA', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
          aria-label="Tutup notifikasi"
        >✕</button>
      </div>
    </div>
  );
}

// ── Cart panel ────────────────────────────────────────────────────────────────
function CartPanel() {
  const navigate = useNavigate();
  const { items, totalItems, totalPrice, discountAmount, appliedVoucher,
          updateQty, removeItem, applyVoucher, removeVoucher } = useCart();
  const config   = usePublicConfig();
  const ppnRate  = parseFloat(config?.ppn_rate) || 0;

  const subtotalAfterDiscount = Math.max(0, totalPrice - discountAmount);
  const taxAmount  = Math.round(subtotalAfterDiscount * (ppnRate / 100));
  const grandTotal = subtotalAfterDiscount + taxAmount;

  const tenantIds  = [...new Set(items.map(i => i.tenant_id))];
  const boothCount = tenantIds.length;

  return (
    <aside
      style={{
        ...SIDEBAR_GLASS,
        borderLeft: '1px solid rgba(255,255,255,0.60)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid rgba(200,210,240,0.35)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14, color: '#1A1B2E' }}>
          Keranjang
          {totalItems > 0 && (
            <span style={{
              background: '#FF6B6B', color: '#fff', fontSize: 10, fontWeight: 800,
              borderRadius: 9999, padding: '2px 8px',
            }}>{totalItems}</span>
          )}
        </div>
        {boothCount > 0 && (
          <div style={{ fontSize: 11, color: '#868E96', marginTop: 3 }}>
            {items.length} produk dari {boothCount} booth
          </div>
        )}
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(200,210,240,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
              🛒
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#495057' }}>Keranjang kosong</div>
            <div style={{ fontSize: 11, color: '#868E96' }}>Tambahkan produk dari katalog</div>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.product_id}
              style={{
                display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 12,
                background: 'rgba(255,255,255,0.62)',
                border: '1.5px solid rgba(255,255,255,0.70)',
                alignItems: 'center',
              }}
            >
              {/* Thumbnail */}
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(145deg, #E8EDFF, #F0E8FF)',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.product_name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 22 }}>🧸</span>
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1B2E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                  {item.product_name}
                </div>
                <div style={{ fontSize: 10, color: '#868E96' }}>{item.tenant_name}</div>
              </div>

              {/* Right: price + qty + remove */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#3B5BDB', fontVariantNumeric: 'tabular-nums' }}>
                  {formatRupiah(item.price * item.quantity)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: 8, overflow: 'hidden', border: '1.5px solid rgba(200,210,240,0.50)', background: 'rgba(255,255,255,0.70)' }}>
                  <button
                    onClick={() => item.quantity <= 1 ? removeItem(item.product_id) : updateQty(item.product_id, item.quantity - 1)}
                    style={{ width: 24, height: 24, background: 'none', border: 'none', cursor: 'pointer', color: item.quantity <= 1 ? '#C92A2A' : '#3B5BDB', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
                  >
                    {item.quantity <= 1 ? '×' : '−'}
                  </button>
                  <span style={{ padding: '0 8px', fontSize: 12, fontWeight: 800, color: '#1A1B2E', fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'center' }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQty(item.product_id, item.quantity + 1)}
                    style={{ width: 24, height: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#3B5BDB', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
                  >+</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Voucher + Summary — hanya tampil jika ada item */}
      {items.length > 0 && (
        <>
          {/* Voucher */}
          <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
            <VoucherInput
              cartTotal={totalPrice}
              tenantIds={tenantIds}
              items={items.map(i => ({ price: i.price, quantity: i.quantity, tenant_id: i.tenant_id }))}
              onVoucherApplied={applyVoucher}
              onVoucherRemoved={removeVoucher}
            />
          </div>

          {/* Summary */}
          <div style={{
            padding: '12px 16px 16px', flexShrink: 0,
            borderTop: '1px solid rgba(200,210,240,0.35)',
          }}>
            {[
              { label: 'Subtotal', value: formatRupiah(totalPrice) },
              ...(discountAmount > 0 ? [{ label: 'Diskon voucher', value: `−${formatRupiah(discountAmount)}`, isDiscount: true }] : []),
              ...(ppnRate > 0 ? [{ label: `PPN ${ppnRate}%`, value: formatRupiah(taxAmount) }] : []),
            ].map(({ label, value, isDiscount }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: '#495057', fontWeight: 500 }}>{label}</span>
                <span style={{ color: isDiscount ? '#2F9E44' : '#1A1B2E', fontWeight: 700 }}>{value}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 0', borderTop: '1px solid rgba(200,210,240,0.35)', marginTop: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#1A1B2E' }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#3B5BDB', fontVariantNumeric: 'tabular-nums' }}>
                {formatRupiah(grandTotal)}
              </span>
            </div>

            <button
              onClick={() => navigate('/keranjang')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', height: 44, borderRadius: 14, marginTop: 12,
                background: 'linear-gradient(135deg, #3B5BDB, #748FFC)',
                color: '#fff', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59,91,219,0.35)', fontFamily: 'inherit',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(59,91,219,0.42)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,91,219,0.35)'; }}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/>
                <path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
              </svg>
              Lanjut ke Pembayaran
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

// ── Sidebar nav item ──────────────────────────────────────────────────────────
function SideNavItem({ to, icon, label, badge }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
        textDecoration: 'none', fontWeight: 600, fontSize: 13, position: 'relative',
        border: '1.5px solid transparent',
        transition: 'all 0.15s',
        background: isActive ? '#EEF2FF' : 'transparent',
        borderColor: isActive ? 'rgba(116,143,252,0.30)' : 'transparent',
        color: isActive ? '#3B5BDB' : '#495057',
        boxShadow: isActive ? '0 2px 8px rgba(59,91,219,0.08)' : 'none',
      })}
    >
      {icon}
      {label}
      {badge > 0 && (
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: '#FF6B6B', color: '#fff', fontSize: 10, fontWeight: 800,
          borderRadius: 9999, minWidth: 18, height: 18, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '0 4px',
        }}>{badge > 9 ? '9+' : badge}</span>
      )}
    </NavLink>
  );
}

// ── Icon helpers ──────────────────────────────────────────────────────────────
function Icon({ d, size = 18 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
      {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
    </svg>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────
export default function CustomerShellDesktop() {
  const { user } = useAuth();
  const { totalItems } = useCart();
  const navigate       = useNavigate();
  const { pathname }   = useLocation();
  const publicConfig   = usePublicConfig();
  const { lang, setLang } = useLang();
  const { count: wishCount, setWishlistMode } = useWishlist();
  const { subscribe }  = useWebSocket();

  const logoUrl   = publicConfig?.logo_url ?? null;
  const eventName = publicConfig?.event_name ?? 'Amazing Toys Fair';
  const venue     = publicConfig?.venue ?? 'Marketplace';

  const [mapOpen,    setMapOpen]    = useState(false);
  const [scanOpen,   setScanOpen]   = useState(false);
  const [orderNotifs, setOrderNotifs] = useState([]);

  // Catalogue state — provided via context so BrowsePageDesktop and the
  // sidebar category filter share the same data without a second API call.
  const catalogue = useCatalogueState();
  const { state: catState, actions: catActions } = catalogue;

  // CR-036 Layer 2 order notification
  useEffect(() => {
    return subscribe('ORDER_RESERVED_FOR_CUSTOMER', (data) => {
      const p = data?.payload;
      if (!p?.txnId) return;
      setOrderNotifs(prev => [
        ...prev,
        { id: Date.now(), txnId: p.txnId, boothName: p.boothName || 'Booth', totalAmount: p.totalAmount || 0 },
      ]);
    });
  }, [subscribe]);

  function handleQrResult(text) {
    setScanOpen(false);
    navigate(`/product_cart/${text}`);
  }

  const isOnKatalog = pathname === '/katalog';

  return (
    <CatalogueContext.Provider value={catalogue}>
      <div style={{ minHeight: '100vh', background: MESH_BG, display: 'grid', gridTemplateRows: '60px 1fr', gridTemplateColumns: '248px 1fr 300px', position: 'relative' }}>

        {/* ── Decorative blobs ─────────────────────────────────────── */}
        <div style={{ position: 'fixed', top: 80, right: 320, width: 180, height: 180, borderRadius: '50%', background: 'rgba(180,160,255,0.22)', filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', top: '35%', left: 260, width: 200, height: 200, borderRadius: '50%', background: 'rgba(130,210,255,0.18)', filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0 }} />

        {/* ── HEADER ───────────────────────────────────────────────── */}
        <header style={{
          gridColumn: '1 / -1',
          ...GLASS,
          borderBottom: '1px solid rgba(255,255,255,0.55)',
          boxShadow: '0 2px 16px rgba(100,130,220,0.10)',
          position: 'sticky', top: 0, zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px',
        }}>
          {/* Brand — aligned to sidebar width */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 228, flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #3B5BDB, #748FFC)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {logoUrl
                ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 10 }} />
                : <span style={{ fontSize: 18 }}>🧸</span>
              }
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#3B5BDB', lineHeight: 1.1 }}>{eventName}</div>
              <div style={{ fontSize: 10, color: '#868E96', fontWeight: 500 }}>{venue}</div>
            </div>
          </div>

          {/* Search — controls catalogue state */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, maxWidth: 600 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px',
              borderRadius: 12, background: 'rgba(255,255,255,0.52)',
              backdropFilter: 'blur(16px) saturate(1.7)', WebkitBackdropFilter: 'blur(16px) saturate(1.7)',
              border: '1.5px solid rgba(255,255,255,0.75)',
              boxShadow: '0 2px 10px rgba(100,130,220,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#ADB5BD" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={catState.search}
                onChange={e => { catActions.setSearch(e.target.value); if (!isOnKatalog) navigate('/katalog'); }}
                placeholder="Cari produk, toko, kategori…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 500, color: '#1A1B2E', fontFamily: 'inherit' }}
              />
              {catState.search && (
                <button onClick={() => catActions.setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ADB5BD', lineHeight: 1, padding: 0 }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>

            {/* QR scan */}
            <button
              onClick={() => setScanOpen(true)}
              title="Scan QR Produk"
              style={{
                width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 12, background: 'rgba(255,255,255,0.52)', border: '1.5px solid rgba(255,255,255,0.75)',
                boxShadow: '0 2px 10px rgba(100,130,220,0.08)', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3B5BDB" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/>
                <rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/>
              </svg>
            </button>

            {/* Map */}
            <button
              onClick={() => setMapOpen(true)}
              title="Peta Lantai"
              style={{
                width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 12, background: 'rgba(255,255,255,0.52)', border: '1.5px solid rgba(255,255,255,0.75)',
                boxShadow: '0 2px 10px rgba(100,130,220,0.08)', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3B5BDB" strokeWidth="2">
                <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
            </button>
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <LangDropdown lang={lang} setLang={setLang} />

            {/* Wishlist */}
            <button
              onClick={() => { setWishlistMode(v => !v); if (!isOnKatalog) navigate('/katalog'); }}
              title="Wishlist"
              style={{
                position: 'relative', width: 34, height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 10, background: 'rgba(248,249,254,0.80)',
                border: '1.5px solid rgba(200,210,240,0.50)', cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#868E96" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {wishCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5,
                  background: '#F03E3E', color: '#fff', fontSize: 9, fontWeight: 800,
                  borderRadius: 9999, width: 16, height: 16, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff',
                }}>{wishCount > 9 ? '9+' : wishCount}</span>
              )}
            </button>

            {/* Profile chip */}
            <NavLink
              to="/profil"
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 12px 4px 4px', borderRadius: 20,
                background: isActive ? '#EEF2FF' : 'rgba(248,249,254,0.85)',
                border: isActive ? '1.5px solid rgba(116,143,252,0.30)' : '1.5px solid rgba(200,210,240,0.50)',
                textDecoration: 'none', cursor: 'pointer',
              })}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #3B5BDB, #748FFC)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 800,
              }}>
                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1B2E', whiteSpace: 'nowrap' }}>
                {user?.name ?? 'Profil'}
              </span>
            </NavLink>
          </div>
        </header>

        {/* ── SIDEBAR ───────────────────────────────────────────────── */}
        <aside style={{
          ...SIDEBAR_GLASS,
          borderRight: '1px solid rgba(255,255,255,0.60)',
          overflowY: 'auto', padding: '16px 12px',
          display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', zIndex: 1,
        }}>
          {/* Nav */}
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#868E96', padding: '4px 10px 6px' }}>
            Navigasi
          </div>

          <SideNavItem
            to="/katalog"
            label="Katalog"
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
            }
          />
          <SideNavItem
            to="/pesanan"
            label="Pesanan Saya"
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            }
          />
          <SideNavItem
            to="/profil"
            label="Profil Saya"
            icon={
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            }
          />

          {/* Category filter — hanya tampil di halaman /katalog */}
          {isOnKatalog && (
            <>
              <div style={{ height: 1, background: 'rgba(200,210,240,0.35)', margin: '8px 10px' }} />
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#868E96', padding: '4px 10px 6px' }}>
                Kategori
              </div>

              {catState.categories.map((cat) => {
                const isActive = catState.curCat === cat;
                const count = cat === 'All' ? catState.products.length : catState.products.filter(p => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => catActions.setCurCat(cat)}
                    style={{
                      display: 'block', width: '100%', padding: '7px 12px', borderRadius: 10,
                      fontSize: 12, fontWeight: isActive ? 700 : 600,
                      color: isActive ? '#3B5BDB' : '#495057',
                      background: isActive ? '#EEF2FF' : 'transparent',
                      border: `1.5px solid ${isActive ? 'rgba(116,143,252,0.30)' : 'transparent'}`,
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                  >
                    {cat === 'All' ? 'Semua Produk' : cat}
                    <span style={{
                      float: 'right', fontSize: 11, fontWeight: 700,
                      color: isActive ? '#3B5BDB' : '#868E96',
                      background: isActive ? 'rgba(59,91,219,0.12)' : 'rgba(200,210,240,0.30)',
                      borderRadius: 9999, padding: '1px 7px',
                    }}>{count}</span>
                  </button>
                );
              })}

              {/* Quick filters */}
              <div style={{ height: 1, background: 'rgba(200,210,240,0.35)', margin: '8px 10px' }} />
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#868E96', padding: '4px 10px 6px' }}>
                Filter
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#495057' }}>
                <input type="checkbox" style={{ accentColor: '#3B5BDB' }} /> Tersedia stok
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#EA580C' }}>
                <input type="checkbox" style={{ accentColor: '#EA580C' }} /> 🔖 Pre-Order
              </label>
            </>
          )}
        </aside>

        {/* ── MAIN CONTENT (Outlet) ─────────────────────────────────── */}
        <main style={{ overflowY: 'auto', position: 'relative', zIndex: 1, minHeight: 0 }}>
          <Outlet />
        </main>

        {/* ── CART PANEL ────────────────────────────────────────────── */}
        <CartPanel />

        {/* ── Modals ────────────────────────────────────────────────── */}
        {mapOpen  && <MapModal onClose={() => setMapOpen(false)} />}
        {scanOpen && (
          <QrScannerModal
            title="Scan QR Produk"
            hint="Arahkan kamera ke QR code produk"
            resultParser={text => text}
            onResult={handleQrResult}
            onClose={() => setScanOpen(false)}
          />
        )}

        {/* ── Order notifications ────────────────────────────────────── */}
        {orderNotifs.length > 0 && (
          <div style={{
            position: 'fixed', top: 72, right: 312, zIndex: 60,
            display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto',
          }}>
            {orderNotifs.slice(-2).map(notif => (
              <OrderNotifCard
                key={notif.id}
                notif={notif}
                onDismiss={() => setOrderNotifs(prev => prev.filter(n => n.id !== notif.id))}
                onOpen={() => { navigate(`/pesanan/${notif.txnId}`); setOrderNotifs(prev => prev.filter(n => n.id !== notif.id)); }}
              />
            ))}
          </div>
        )}

        <style>{`
          @keyframes desktopNotifSlide {
            from { opacity: 0; transform: translateY(-8px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes desktopNotifProgress {
            from { width: 100%; } to { width: 0%; }
          }
          @media (prefers-reduced-motion: reduce) {
            * { transition: none !important; animation: none !important; }
          }
        `}</style>
      </div>
    </CatalogueContext.Provider>
  );
}
