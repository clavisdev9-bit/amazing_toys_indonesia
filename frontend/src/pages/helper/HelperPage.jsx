import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { formatRupiah, formatDate } from '../../utils/format';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useLang, SUPPORTED_LANGS } from '../../context/LangContext';
import { useAuth } from '../../hooks/useAuth';
import { useAppLogo, usePublicConfig } from '../../hooks/useAppLogo';
import ApprovalQueueTab from '../../components/helper/ApprovalQueueTab';
import QrScannerModal from '../../components/ui/QrScannerModal';
import MapModal from '../../components/ui/MapModal';
import Spinner from '../../components/ui/Spinner';
import {
  getBoothProducts,
  getBoothOrders,
  getBoothOrder,
  createHelperOrder,
  handoverOrder,
  getPreorderApprovalOrders,
} from '../../api/helper';
import { lookupCustomerByPhone } from '../../api/cashier';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  gold: '#C9A227', goldLight: '#F5EAB7', goldDark: '#7A6010',
  crimson: '#C4283A', crimsonLight: '#F9E4E6', crimsonDark: '#7A0F1C',
  olive: '#6B7A2A', oliveLight: '#E8EDD0', oliveDark: '#3A4210',
  warmBg: '#FBF7F0', border: '#E8E2D5', soft: '#F4EEE2', muted: '#9B8E7E',
};

// ─── Bottom nav config ────────────────────────────────────────────────────────
const NAV_TABS = [
  {
    id: 'order', label: 'Order', icon: '🛒', color: C.olive,
    subs: [
      { id: 'membuat', label: 'Buat Order' },
      { id: 'outstanding', label: 'Outstanding' },
      { id: 'paid', label: 'Paid' },
    ],
  },
  {
    id: 'approval', label: 'Approval', icon: '✅', color: C.gold, hasBadge: 'approval',
    subs: [
      { id: 'belum_approve', label: 'Menunggu' },
      { id: 'sudah_approve', label: 'Disetujui' },
      { id: 'preorder_approval', label: 'Pre-Order' },
    ],
  },
  {
    id: 'history', label: 'History', icon: '📋', color: C.muted, subs: null,
  },
  {
    id: 'handover', label: 'Serah Terima', icon: '📦', color: C.crimson, hasBadge: 'handover',
    subs: [
      { id: 'handover_outstanding', label: 'Outstanding' },
      { id: 'sudah_handover', label: 'Selesai' },
    ],
  },
];

// ─── Panel metadata ───────────────────────────────────────────────────────────
const PANEL_META = {
  'order/membuat':             { title: 'Buat Order',          showScan: true,  scanPlaceholder: 'Cari produk / scan barcode...' },
  'order/outstanding':         { title: 'Order Outstanding',   showScan: true,  scanPlaceholder: 'Cari nomor order...' },
  'order/paid':                { title: 'Order Paid',          showScan: true,  scanPlaceholder: 'Cari nomor order...' },
  'approval/belum_approve':    { title: 'Antrian Approval',    showScan: true,  scanPlaceholder: 'Cari / scan QR order...' },
  'approval/sudah_approve':    { title: 'Sudah Disetujui',     showScan: true,  scanPlaceholder: 'Cari nomor order...' },
  'approval/preorder_approval':{ title: 'Approval Pre-Order',  showScan: false },
  'history':                   { title: 'History',             showScan: false },
  'handover/handover_outstanding': { title: 'Serah Terima',   showScan: true,  scanPlaceholder: 'Scan QR atau ketik nomor order...' },
  'handover/sudah_handover':   { title: 'Sudah Serah Terima', showScan: true,  scanPlaceholder: 'Cari nomor order...' },
};

// ─── Status helpers ───────────────────────────────────────────────────────────
function statusDot(status) {
  if (['PAID', 'APPROVED', 'HANDED_OVER', 'COMPLETED'].includes(status)) return C.olive;
  if (['PENDING', 'CREATED', 'RESERVED', 'WAITING_PAYMENT', 'PENDING_APPROVAL'].includes(status)) return C.gold;
  return C.crimson;
}

function statusLabel(status) {
  const MAP = {
    PAID: 'Paid', APPROVED: 'Approved', HANDED_OVER: 'Diserahkan', COMPLETED: 'Selesai',
    PENDING: 'Pending', CREATED: 'Created', RESERVED: 'Reserved',
    WAITING_PAYMENT: 'Menunggu Bayar', PENDING_APPROVAL: 'Menunggu Approval',
    CANCELLED: 'Dibatalkan', REJECTED: 'Ditolak', EXPIRED: 'Kedaluwarsa',
  };
  return MAP[status] || status;
}

// ─── Shared components ────────────────────────────────────────────────────────
function Banner({ type, children }) {
  const S = {
    amber: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
    green: { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
    red:   { bg: C.crimsonLight, color: C.crimsonDark, border: '#FECACA' },
  };
  const s = S[type] || S.amber;
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
      {children}
    </div>
  );
}

function OrderCard({ order, action }) {
  const name = order.customer_name || order.customer_reg_phone || order.customer_phone || 'Walk-in';
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: action ? 12 : 0 }}>
        <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
          <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#2a1e10' }}>{order.transaction_id}</p>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: C.muted }}>{name}</p>
          <p style={{ margin: '1px 0 0', fontSize: 11.5, color: C.muted }}>{formatDate(order.created_at)}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: C.goldDark }}>{formatRupiah(order.total_amount)}</p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: '#5a4e3e', marginTop: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot(order.status), display: 'inline-block', flexShrink: 0 }} />
            {statusLabel(order.status)}
          </span>
        </div>
      </div>
      {action}
    </div>
  );
}

function RefreshBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${C.border}`, background: '#fff', fontSize: 13, fontWeight: 700, color: '#5a4e3e', cursor: 'pointer', fontFamily: 'inherit' }}
    >
      ↺ Refresh
    </button>
  );
}

// ─── Mobile Header ────────────────────────────────────────────────────────────
function MobileHeader({ title, boothName, user, onOpenMap, onOpenProfile, lang, setLang }) {
  const logoUrl = useAppLogo();
  return (
    <div style={{ background: C.crimson, padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, boxShadow: '0 2px 8px rgba(196,40,58,0.25)' }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        {logoUrl
          ? <img src={logoUrl} alt="" style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} />
          : <span style={{ fontSize: 22, flexShrink: 0 }}>🧸</span>
        }
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', letterSpacing: 0.3, lineHeight: 1.2 }}>Amazing Toys</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Helper · {boothName}
          </div>
        </div>
      </div>

      {/* Language toggle */}
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.35)', flexShrink: 0 }}>
        {SUPPORTED_LANGS.map(({ code, label }) => (
          <button
            key={code}
            onClick={() => setLang(code)}
            style={{
              padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit', minWidth: 34,
              background: lang === code ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
              color: lang === code ? C.crimsonDark : '#fff',
              borderLeft: code !== SUPPORTED_LANGS[0].code ? '1px solid rgba(255,255,255,0.3)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Map button */}
      <button
        onClick={onOpenMap}
        style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        📍
      </button>

      {/* Profile button */}
      <button
        onClick={onOpenProfile}
        style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        👤
      </button>
    </div>
  );
}

// ─── Sub-nav (horizontal pill tabs) ──────────────────────────────────────────
function SubNav({ tab, activeSub, onSelect }) {
  if (!tab?.subs) return null;
  return (
    <div style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto', padding: '0 16px', scrollbarWidth: 'none' }}>
        {tab.subs.map(sub => {
          const active = activeSub === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => onSelect(sub.id)}
              style={{
                padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: active ? 800 : 600,
                color: active ? tab.color : '#9B8E7E',
                borderBottom: active ? `3px solid ${tab.color}` : '3px solid transparent',
                whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
              }}
            >
              {sub.label}
            </button>
          );
        })}

        {/* Pre-order quick links in sub-nav if on Order tab */}
        {tab.id === 'order' && (
          <>
            <div style={{ width: 1, background: C.border, margin: '8px 4px', flexShrink: 0 }} />
            <Link
              to="/helper/preorder-handover"
              style={{ padding: '12px 14px', fontSize: 12.5, fontWeight: 700, color: '#EA580C', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              📦 Pre-Order
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────────
function SearchBar({ meta, searchQuery, setSearchQuery }) {
  const [scannerOpen, setScannerOpen] = useState(false);
  if (!meta?.showScan) return null;

  return (
    <div style={{ padding: '10px 16px', background: '#fff', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={meta.scanPlaceholder || 'Ketik atau scan...'}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${C.border}`,
            fontSize: 14, fontFamily: 'inherit', background: C.warmBg, color: '#2a1e10', outline: 'none',
          }}
        />
        <button
          onClick={() => setScannerOpen(true)}
          style={{
            padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${C.border}`,
            background: '#fff', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, minWidth: 48,
          }}
        >
          📷
        </button>
      </div>
      {scannerOpen && (
        <QrScannerModal
          title="Scan QR"
          hint="Arahkan kamera ke QR code"
          resultParser={raw => raw?.trim() || null}
          onResult={val => { setSearchQuery(val); setScannerOpen(false); }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Bottom navigation ────────────────────────────────────────────────────────
function BottomNav({ activeMenu, onNavigate, approvalCount, handoverCount }) {
  return (
    <div style={{
      background: '#fff', borderTop: `1px solid ${C.border}`,
      display: 'flex', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
    }}>
      {NAV_TABS.map(tab => {
        const isActive = activeMenu === tab.id;
        const badge = tab.hasBadge === 'approval' ? approvalCount : tab.hasBadge === 'handover' ? handoverCount : 0;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id, tab.subs?.[0]?.id ?? null)}
            style={{
              flex: 1, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              padding: '10px 4px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              position: 'relative', minHeight: 56,
            }}
          >
            {badge > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: '50%', transform: 'translateX(10px)',
                background: C.crimson, color: '#fff', fontSize: 10, fontWeight: 800,
                borderRadius: 9, padding: '1px 5px', minWidth: 16, textAlign: 'center', lineHeight: '14px',
                border: '2px solid #fff',
              }}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{ fontSize: 10.5, fontWeight: isActive ? 800 : 600, color: isActive ? tab.color : '#9B8E7E', lineHeight: 1.2 }}>
              {tab.label}
            </span>
            {isActive && (
              <span style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 3, background: tab.color, borderRadius: '3px 3px 0 0' }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Profile sheet (bottom drawer) ───────────────────────────────────────────
function ProfileSheet({ user, role, onLogout, onClose }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
      />
      <div
        style={{ position: 'relative', background: '#fff', borderRadius: '20px 20px 0 0', padding: '8px 0 32px', boxShadow: '0 -4px 24px rgba(0,0,0,0.15)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ddd', margin: '0 auto 16px' }} />

        {/* User info */}
        <div style={{ padding: '0 20px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.crimsonLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
              👤
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#2a1e10' }}>{user?.name || user?.username}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted, fontWeight: 600 }}>{role}</p>
            </div>
          </div>
        </div>

        {/* Menu items */}
        <div style={{ padding: '8px 0' }}>
          <Link
            to="/helper/products/preorder"
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', textDecoration: 'none', color: '#EA580C' }}
          >
            <span style={{ fontSize: 20 }}>🔖</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Pre-Order Produk</span>
          </Link>
          <Link
            to="/settings/devices"
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', textDecoration: 'none', color: '#3a2e25' }}
          >
            <span style={{ fontSize: 20 }}>🖥️</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Perangkat Saya</span>
          </Link>
          <button
            onClick={onLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          >
            <span style={{ fontSize: 20 }}>🚪</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.crimson }}>Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel: Membuat Order ─────────────────────────────────────────────────────
function MembuatOrderPanel({ searchQuery }) {
  const navigate = useNavigate();
  const publicConfig = usePublicConfig();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState({});
  const [phone, setPhone] = useState('');
  const [customerInfo, setCustomerInfo]   = useState(null); // null | { found: true, ...data } | { found: false }
  const [lookupLoading, setLookupLoading] = useState(false);
  const lookupTimerRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [shipName, setShipName] = useState('');
  const [shipPhone, setShipPhone] = useState('');
  const [shipAddress, setShipAddress] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipProvince, setShipProvince] = useState('');
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    getBoothProducts()
      .then(r => {
        const prods = r.data.data || [];
        setProducts(prods);
        const cats = [...new Set(prods.map(p => p.category).filter(Boolean))];
        setCategories(cats);
      })
      .catch(() => setError('Gagal memuat produk. Coba refresh.'))
      .finally(() => setLoading(false));
  }, []);

  function setQty(productId, delta) {
    setCart(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: next };
    });
  }

  const filtered = products.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !searchQuery || p.product_name.toLowerCase().includes(q) || p.barcode?.includes(q);
    const matchCat = !activeCategory || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  const cartItems = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([pid, qty]) => {
      const p = products.find(x => x.product_id === pid);
      return { product_id: pid, qty, product_name: p?.product_name, price: p?.price, is_preorder: p?.is_preorder };
    });

  const hasPreorder  = cartItems.some(i =>  i.is_preorder);
  const hasRegular   = cartItems.some(i => !i.is_preorder);
  const hasMixedCart = hasPreorder && hasRegular;
  const subtotal = cartItems.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const total = subtotal;
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  function handlePhoneChange(val) {
    setPhone(val);
    setCustomerInfo(null);
    clearTimeout(lookupTimerRef.current);
    const trimmed = val.trim();
    if (!trimmed) { setLookupLoading(false); return; }
    setLookupLoading(true);
    lookupTimerRef.current = setTimeout(async () => {
      try {
        const res = await lookupCustomerByPhone(trimmed);
        const data = res.data.data;
        setCustomerInfo({ found: true, ...data });
        // CR-062: auto-fill shipping form langsung saat lookup berhasil
        setShipName(data.full_name || '');
        setShipPhone(data.phone_number || '');
        setShipAddress('Amazing Toy Show Indonesia');
      } catch (err) {
        if (err.response?.status === 404) setCustomerInfo({ found: false });
      } finally {
        setLookupLoading(false);
      }
    }, 600);
  }

  async function handleCreateOrder() {
    if (cartItems.length === 0) return;
    setError('');
    if (hasPreorder) {
      if (!shipName.trim()) { setError('Nama penerima wajib diisi untuk Pre-Order.'); return; }
      if (!shipAddress.trim()) { setError('Alamat pengiriman wajib diisi untuk Pre-Order.'); return; }
    }
    setSubmitting(true);
    try {
      const payload = {
        items: cartItems.map(i => ({ product_id: i.product_id, qty: i.qty })),
        customer_phone: phone || null,
      };
      if (hasPreorder) {
        payload.shipping_name     = shipName.trim();
        payload.shipping_phone    = shipPhone.trim() || null;
        payload.shipping_address  = shipAddress.trim();
        payload.shipping_city     = shipCity.trim() || null;
        payload.shipping_province = shipProvince.trim() || null;
      }
      const res = await createHelperOrder(payload);
      setCart({});
      setPhone('');
      setCustomerInfo(null);
      clearTimeout(lookupTimerRef.current);
      setShipName(''); setShipPhone(''); setShipAddress(''); setShipCity(''); setShipProvince('');
      setConfirmModal(false);
      setCartOpen(false);
      navigate('/helper/order-success', { state: res.data.data });
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat order');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Scrollable product list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', paddingBottom: cartCount > 0 ? 80 : 16 }}>
        {error && <Banner type="red">{error}</Banner>}

        {/* Category pills */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14, scrollbarWidth: 'none', paddingBottom: 2 }}>
            {['Semua', ...categories].map(cat => {
              const isAll = cat === 'Semua';
              const active = isAll ? !activeCategory : activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(isAll ? null : (activeCategory === cat ? null : cat))}
                  style={{
                    padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                    border: `1.5px solid ${active ? C.gold : C.border}`,
                    background: active ? C.goldLight : '#fff',
                    color: active ? C.goldDark : '#5a5248',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: C.muted }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Produk tidak ditemukan</p>
          </div>
        )}

        {filtered.map(p => {
          const qty = cart[p.product_id] || 0;
          const oos = p.stock_quantity === 0;
          const restricted = p.is_display_only || p.is_on_hold || oos;
          const inCart = qty > 0;
          return (
            <div
              key={p.product_id}
              style={{
                background: inCart ? C.oliveLight : '#fff',
                border: `1.5px solid ${inCart ? C.olive : C.border}`,
                borderRadius: 12, padding: '12px 14px', marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: restricted ? 0.55 : 1,
                boxShadow: inCart ? `0 2px 8px rgba(107,122,42,0.15)` : '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              {p.image_url ? (
                <img src={p.image_url} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 10, background: C.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🧸</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#2a1e10', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product_name}</p>
                <p style={{ margin: '2px 0', fontSize: 13, fontWeight: 800, color: C.goldDark }}>{formatRupiah(p.price)}</p>
                <p style={{ margin: 0, fontSize: 11.5, color: C.muted }}>Stok {p.stock_quantity}{p.sku || p.barcode ? ` · ${p.sku || p.barcode}` : ''}</p>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {oos && <span style={{ fontSize: 10.5, background: C.crimsonLight, color: C.crimsonDark, padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>Habis</span>}
                  {p.is_display_only && <span style={{ fontSize: 10.5, background: '#FFF3E0', color: '#BF6000', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>Display Only</span>}
                  {p.is_on_hold && <span style={{ fontSize: 10.5, background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>On Hold</span>}
                  {p.is_preorder && <span style={{ fontSize: 10.5, background: '#FED7AA', color: '#EA580C', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>PRE-ORDER</span>}
                </div>
              </div>
              {/* Qty stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => setQty(p.product_id, -1)}
                  disabled={qty === 0 || restricted}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: `2px solid ${qty > 0 ? C.olive : C.border}`,
                    background: qty > 0 ? C.olive : '#fff',
                    cursor: qty === 0 || restricted ? 'not-allowed' : 'pointer',
                    fontSize: 20, opacity: qty === 0 || restricted ? 0.3 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, padding: 0, color: qty > 0 ? '#fff' : '#3a2e25',
                  }}
                >−</button>
                <span style={{ width: 28, textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: inCart ? C.oliveDark : '#3a2e25' }}>{qty}</span>
                <button
                  onClick={() => setQty(p.product_id, 1)}
                  disabled={restricted || qty >= p.stock_quantity || (p.max_per_customer && qty >= p.max_per_customer)}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: `2px solid ${C.olive}`,
                    background: restricted || qty >= p.stock_quantity ? '#f0ede8' : C.oliveLight,
                    cursor: 'pointer', fontSize: 20,
                    opacity: restricted || qty >= p.stock_quantity ? 0.3 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, padding: 0, color: C.oliveDark,
                  }}
                >+</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, zIndex: 10 }}>
          <button
            onClick={() => setCartOpen(true)}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 14, border: 'none',
              background: C.olive, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(107,122,42,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>
                {cartCount}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Lihat Keranjang</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{formatRupiah(total)} →</span>
          </button>
        </div>
      )}

      {/* Cart bottom sheet */}
      {cartOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={() => setCartOpen(false)}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div
            style={{ position: 'relative', background: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 24px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ddd', margin: '10px auto 0' }} />
            <div style={{ padding: '12px 20px 8px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#2a1e10' }}>🛒 Keranjang ({cartCount})</h3>
              <button onClick={() => setCartOpen(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.muted, padding: 4 }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px' }}>
              {error && <Banner type="red">{error}</Banner>}

              {/* Cart items */}
              {cartItems.map(i => (
                <div key={i.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#2a1e10', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.product_name}</p>
                    {i.is_preorder && <span style={{ fontSize: 10.5, background: '#FED7AA', color: '#EA580C', padding: '1px 5px', borderRadius: 5, fontWeight: 700 }}>PRE-ORDER</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => setQty(i.product_id, -1)} style={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>−</button>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 14, width: 20, textAlign: 'center' }}>{i.qty}</span>
                    <button onClick={() => setQty(i.product_id, 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>+</button>
                    <span style={{ fontWeight: 700, fontSize: 13, color: C.goldDark, minWidth: 80, textAlign: 'right' }}>{formatRupiah((i.price || 0) * i.qty)}</span>
                  </div>
                </div>
              ))}

              {/* Mixed cart warning */}
              {hasMixedCart && (
                <div style={{ margin: '10px 0', padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1.5px solid #FECACA' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#991B1B' }}>⚠ Order ini mengandung item PRE-ORDER dan REGULAR</p>
                  <div style={{ marginBottom: 6 }}>
                    {cartItems.map(i => (
                      <div key={i.product_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#374151', marginBottom: 2 }}>
                        <span style={{ flex: 1 }}>{i.product_name}</span>
                        <span style={{ padding: '1px 6px', borderRadius: 5, fontWeight: 700, fontSize: 10.5, background: i.is_preorder ? '#FED7AA' : '#D1FAE5', color: i.is_preorder ? '#EA580C' : '#065F46' }}>
                          {i.is_preorder ? '🔖 PRE-ORDER' : '✓ REGULAR'}
                        </span>
                        <span style={{ color: '#6B7280', fontSize: 11 }}>×{i.qty}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: 11.5, color: '#B91C1C' }}>Barang PRE-ORDER tidak bisa digabung dengan REGULAR. Buat order terpisah.</p>
                </div>
              )}

              {/* Total */}
              <div style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: '#2a1e10' }}>
                  <span>Total</span>
                  <span style={{ color: C.goldDark }}>{formatRupiah(total)}</span>
                </div>
              </div>

              {/* Phone input — CR-061: debounced customer lookup */}
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 5 }}>No. HP Customer (opsional)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    placeholder="08xxxxxxxxxx"
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                      borderRadius: 10, fontSize: 14, fontFamily: 'inherit',
                      background: C.warmBg, color: '#2a1e10', outline: 'none',
                      border: `1.5px solid ${customerInfo?.found === true ? '#86EFAC' : customerInfo?.found === false ? '#FCD34D' : C.border}`,
                      paddingRight: phone ? 36 : 14,
                    }}
                  />
                  {lookupLoading && (
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.muted }}>…</span>
                  )}
                  {!lookupLoading && phone && (
                    <button
                      type="button"
                      onClick={() => { setPhone(''); setCustomerInfo(null); clearTimeout(lookupTimerRef.current); setLookupLoading(false); }}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 14, padding: 0, lineHeight: 1 }}
                    >✕</button>
                  )}
                </div>
                {customerInfo?.found === true && (
                  <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #86EFAC', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#16A34A', fontSize: 13, flexShrink: 0 }}>✓</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#15803D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customerInfo.full_name}</p>
                      {customerInfo.email && (
                        <p style={{ margin: 0, fontSize: 11, color: '#16A34A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customerInfo.email}</p>
                      )}
                    </div>
                  </div>
                )}
                {customerInfo?.found === false && (
                  <div style={{ marginTop: 6, padding: '7px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FCD34D', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#D97706', fontSize: 12, flexShrink: 0 }}>⚠</span>
                    <p style={{ margin: 0, fontSize: 11.5, color: '#B45309' }}>Customer belum terdaftar — akan dicatat sebagai Walk-in</p>
                  </div>
                )}
              </div>

              {/* Shipping for preorder */}
              {hasPreorder && (
                <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 12, background: '#FFF7ED', border: '1.5px solid #FED7AA' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#EA580C' }}>📦 Alamat Pengiriman (Pre-Order)</p>
                  {[
                    { label: 'Nama Penerima *', val: shipName, set: setShipName, placeholder: 'Nama lengkap penerima', req: true },
                    { label: 'No. HP Penerima', val: shipPhone, set: setShipPhone, placeholder: '08xxxxxxxxxx', req: false },
                    { label: 'Alamat Lengkap *', val: shipAddress, set: setShipAddress, placeholder: 'Jl. ..., No. ...', req: true },
                    { label: 'Kota / Kabupaten', val: shipCity, set: setShipCity, placeholder: 'Jakarta Selatan', req: false },
                    { label: 'Provinsi', val: shipProvince, set: setShipProvince, placeholder: 'DKI Jakarta', req: false },
                  ].map(({ label, val, set, placeholder, req }) => (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#92400E', display: 'block', marginBottom: 4 }}>{label}</label>
                      <input
                        type="text"
                        value={val}
                        onChange={e => set(e.target.value)}
                        placeholder={placeholder}
                        required={req}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${req && !val.trim() ? '#FCA5A5' : '#FED7AA'}`, fontSize: 13, fontFamily: 'inherit', background: '#fff', outline: 'none' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create order button */}
            <div style={{ padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))', borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={() => { if (hasMixedCart) return; setError(''); setConfirmModal(true); }}
                disabled={hasMixedCart}
                style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: hasMixedCart ? '#9CA3AF' : C.olive, color: '#fff', border: 'none', fontWeight: 800, fontSize: 15, cursor: hasMixedCart ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: hasMixedCart ? 0.7 : 1 }}
              >
                {hasMixedCart ? '⚠ Tidak Bisa — Pisahkan Order' : `🎫 Buat Order · ${formatRupiah(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 24, maxWidth: 360, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 17, color: '#2a1e10' }}>Konfirmasi Order</h3>
            {hasPreorder && (
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#EA580C', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '8px 12px' }}>
                ⚠ Order ini berisi PRE-ORDER — barang akan dikirim ke alamat customer.
              </p>
            )}
            <p style={{ margin: '0 0 6px', fontSize: 14, color: '#5a4e3e' }}>Buat order senilai <strong style={{ color: C.goldDark }}>{formatRupiah(total)}</strong>?</p>
            {hasPreorder && shipName && (
              <p style={{ margin: '0 0 6px', fontSize: 13, color: C.muted }}>Dikirim ke: <strong>{shipName}</strong>{shipCity ? `, ${shipCity}` : ''}</p>
            )}
            <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted }}>
              {phone ? `QR akan dikirim ke ${phone}` : 'Tidak ada nomor HP — customer scan langsung di layar'}
            </p>
            {error && <p style={{ margin: '0 0 12px', fontSize: 13, color: C.crimson, fontWeight: 600 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setConfirmModal(false); setError(''); }}
                disabled={submitting}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}
              >
                Batal
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={submitting}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: C.olive, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Memproses...' : 'Ya, Buat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel: Outstanding Orders ────────────────────────────────────────────────
function OutstandingOrderPanel({ searchQuery }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const OUTSTANDING = ['PENDING', 'CREATED', 'RESERVED', 'WAITING_PAYMENT', 'PENDING_APPROVAL'];

  const load = useCallback(() => {
    setLoading(true);
    getBoothOrders()
      .then(r => setOrders((r.data.data || []).filter(o => OUTSTANDING.includes(o.status))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => !searchQuery || o.transaction_id.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <Banner type="amber">⏳ {orders.length} pesanan belum selesai pembayaran</Banner>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><RefreshBtn onClick={load} /></div>
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 14, fontWeight: 600 }}>Tidak ada order outstanding</p>
        </div>
      )}
      {filtered.map(o => <OrderCard key={o.transaction_id} order={o} />)}
    </div>
  );
}

// ─── Panel: Paid Orders ───────────────────────────────────────────────────────
function PaidOrderPanel({ searchQuery }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getBoothOrders({ status: 'PAID' })
      .then(r => setOrders(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => !searchQuery || o.transaction_id.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <Banner type="green">✅ {orders.length} pesanan sudah dibayar</Banner>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><RefreshBtn onClick={load} /></div>
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 14, fontWeight: 600 }}>Tidak ada order paid</p>
        </div>
      )}
      {filtered.map(o => <OrderCard key={o.transaction_id} order={o} />)}
    </div>
  );
}

// ─── Panel: Sudah Approve ─────────────────────────────────────────────────────
function SudahApprovePanel({ searchQuery }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const APPROVED = ['PENDING', 'WAITING_PAYMENT', 'PAID', 'HANDED_OVER', 'COMPLETED'];

  const load = useCallback(() => {
    setLoading(true);
    getBoothOrders()
      .then(r => setOrders((r.data.data || []).filter(o => APPROVED.includes(o.status))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => !searchQuery || o.transaction_id.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><RefreshBtn onClick={load} /></div>
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 14, fontWeight: 600 }}>Belum ada order disetujui</p>
        </div>
      )}
      {filtered.map(o => <OrderCard key={o.transaction_id} order={o} />)}
    </div>
  );
}

// ─── Panel: History ───────────────────────────────────────────────────────────
function HistoryPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    setLoading(true);
    getBoothOrders({ date: today })
      .then(r => setOrders(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [today]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><RefreshBtn onClick={load} /></div>
      {orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 14, fontWeight: 600 }}>Belum ada transaksi hari ini</p>
        </div>
      )}
      {orders.map(o => {
        const name = o.customer_name || o.customer_reg_phone || o.customer_phone || 'Walk-in';
        return (
          <div
            key={o.transaction_id}
            style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#2a1e10' }}>{o.transaction_id}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: C.muted }}>{name}</p>
              <p style={{ margin: '1px 0 0', fontSize: 11.5, color: C.muted }}>{formatDate(o.created_at)}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: C.goldDark }}>{formatRupiah(o.total_amount)}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: '#5a4e3e', marginTop: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot(o.status), display: 'inline-block' }} />
                {statusLabel(o.status)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Handover item row ────────────────────────────────────────────────────────
function HandoverItemRow({ item, checked, onToggle }) {
  const [imgErr, setImgErr] = useState(false);
  const qty = item.approved_quantity ?? item.quantity;
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', marginBottom: 8,
        background: checked ? C.oliveLight : '#fff',
        borderRadius: 12, border: `2px solid ${checked ? C.olive : C.border}`,
        cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s',
        boxShadow: checked ? `0 2px 8px rgba(107,122,42,0.15)` : '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ width: 54, height: 54, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: C.soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item.image_url && !imgErr
          ? <img src={item.image_url} alt={item.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
          : <span style={{ fontSize: 26 }}>🧸</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: checked ? C.oliveDark : '#2a1e10', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.product_name}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: C.muted }}>
          Qty: ×{qty}{item.barcode ? ` · ${item.barcode}` : ''}
        </p>
      </div>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        border: `2.5px solid ${checked ? C.olive : '#ccc'}`,
        background: checked ? C.olive : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        {checked && <span style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1 }}>✓</span>}
      </div>
    </div>
  );
}

// ─── Handover Detail View ─────────────────────────────────────────────────────
function HandoverDetailView({ order: initialOrder, onBack, onDone }) {
  const [order, setOrder] = useState(initialOrder);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemChecks, setItemChecks] = useState([]);
  const [confirmModal, setConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const lookupKey = initialOrder.is_group_invoice
    ? initialOrder.group_code
    : initialOrder.transaction_id;

  useEffect(() => {
    getBoothOrder(lookupKey)
      .then(r => {
        const detail = r.data.data || {};
        setOrder(detail);
        const itms = detail.items || [];
        setItems(itms);
        setItemChecks(new Array(itms.length).fill(false));
      })
      .catch(() => setError('Gagal memuat detail order'))
      .finally(() => setLoading(false));
  }, [lookupKey]);

  const checkedCount = itemChecks.filter(Boolean).length;
  const allChecked = items.length > 0 && checkedCount === items.length;
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0;
  const customerName = order.customer_name || order.customer_reg_phone || order.customer_phone || 'Walk-in';

  async function doHandover() {
    setSubmitting(true);
    setError('');
    try {
      const handoverId = order.is_group_invoice ? order.group_code : order.transaction_id;
      await handoverOrder(handoverId);
      setConfirmModal(false);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal serah terima');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Back header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{ width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#2a1e10', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Serah Terima
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: C.muted, fontFamily: 'monospace' }}>{order.transaction_id}</p>
        </div>
        <span style={{ background: allChecked ? C.oliveLight : C.soft, color: allChecked ? C.oliveDark : C.muted, fontSize: 13, fontWeight: 800, padding: '6px 12px', borderRadius: 10, flexShrink: 0 }}>
          {checkedCount}/{items.length}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: C.border, flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: C.olive, transition: 'width 0.3s ease' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {error && <Banner type="red">{error}</Banner>}

        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div> : (
          <>
            {/* Summary */}
            <div style={{ background: C.soft, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              {[
                ['ID Transaksi', <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2a1e10', fontSize: 13 }}>{order.transaction_id}</span>],
                ['Customer',     <span style={{ fontWeight: 700, color: '#2a1e10' }}>{customerName}</span>],
                ['Total',        <span style={{ fontWeight: 800, color: C.goldDark, fontSize: 15 }}>{formatRupiah(order.total_amount)}</span>],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: C.muted, fontWeight: 500 }}>{label}</span>
                  {val}
                </div>
              ))}
            </div>

            <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#2a1e10' }}>
              Tap item saat diserahkan 👇
            </p>

            {items.map((item, idx) => (
              <HandoverItemRow
                key={item.item_id || idx}
                item={item}
                checked={itemChecks[idx]}
                onToggle={() => setItemChecks(prev => prev.map((v, i) => i === idx ? !v : v))}
              />
            ))}

            {!allChecked && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#92400E', fontWeight: 600, marginTop: 8 }}>
                ℹ️ Centang semua item untuk unlock tombol konfirmasi
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirm button */}
      <div style={{ padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))', borderTop: `1px solid ${C.border}`, background: '#fff', flexShrink: 0 }}>
        <button
          onClick={() => setConfirmModal(true)}
          disabled={!allChecked}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
            background: allChecked ? C.olive : '#e0dbd4',
            color: allChecked ? '#fff' : '#9a9087',
            fontWeight: 800, fontSize: 15,
            cursor: allChecked ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'background 0.2s',
          }}
        >
          ✅ Konfirmasi Serah Terima
        </button>
      </div>

      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 24, maxWidth: 360, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 17, color: '#2a1e10' }}>Konfirmasi Serah Terima</h3>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: '#5a4e3e' }}>
              Semua {items.length} item sudah diserahkan ke <strong>{customerName}</strong>?
            </p>
            {error && <p style={{ margin: '0 0 12px', fontSize: 13, color: C.crimson, fontWeight: 600 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setConfirmModal(false); setError(''); }}
                disabled={submitting}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit' }}
              >
                Tidak
              </button>
              <button
                onClick={doHandover}
                disabled={submitting}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: C.olive, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? '...' : 'Ya, Serahkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel: Serah Terima Outstanding ─────────────────────────────────────────
function HandoverOutstandingPanel({ searchQuery, onCountUpdate }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [grpLoading, setGrpLoading] = useState(false);
  const [grpError, setGrpError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getBoothOrders({ status: 'PAID' })
      .then(r => {
        const data = r.data.data || [];
        setOrders(data);
        onCountUpdate?.(data.length);
      })
      .catch(() => onCountUpdate?.(0))
      .finally(() => setLoading(false));
  }, [onCountUpdate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = (searchQuery ?? '').trim();
    if (!/^GRP-/i.test(q)) { setGrpError(''); return; }
    if (q.length < 10) return;
    setGrpLoading(true);
    setGrpError('');
    getBoothOrder(q)
      .then(r => setSelectedOrder(r.data.data))
      .catch(err => setGrpError(err.response?.data?.message || 'Group invoice tidak ditemukan di booth ini.'))
      .finally(() => setGrpLoading(false));
  }, [searchQuery]);

  if (selectedOrder) {
    return (
      <HandoverDetailView
        order={selectedOrder}
        onBack={() => setSelectedOrder(null)}
        onDone={() => { setSelectedOrder(null); load(); }}
      />
    );
  }

  const isGroupSearch = /^GRP-/i.test((searchQuery ?? '').trim());
  const filtered = isGroupSearch ? [] : orders.filter(o =>
    !searchQuery || o.transaction_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || grpLoading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <Banner type="amber">📦 {orders.length} pesanan siap diserahkan</Banner>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><RefreshBtn onClick={load} /></div>
      {grpError && <Banner type="red">{grpError}</Banner>}
      {!grpError && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 14, fontWeight: 600 }}>Tidak ada pesanan untuk diserahkan</p>
        </div>
      )}
      {filtered.map(o => (
        <OrderCard
          key={o.transaction_id}
          order={o}
          action={
            <button
              onClick={() => setSelectedOrder(o)}
              style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: C.olive, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              📦 Serah Terima →
            </button>
          }
        />
      ))}
    </div>
  );
}

// ─── Panel: Sudah Serah Terima ────────────────────────────────────────────────
function SudahHandoverPanel({ searchQuery }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getBoothOrders()
      .then(r => setOrders((r.data.data || []).filter(o => ['HANDED_OVER', 'COMPLETED'].includes(o.status))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o =>
    !searchQuery || o.transaction_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <Banner type="green">✅ {orders.length} serah terima selesai</Banner>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><RefreshBtn onClick={load} /></div>
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 14, fontWeight: 600 }}>Belum ada serah terima selesai</p>
        </div>
      )}
      {filtered.map(o => (
        <OrderCard
          key={o.transaction_id}
          order={o}
          action={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, background: C.oliveLight, color: C.oliveDark, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 8 }}>
              ✓ HANDOVER DONE
            </span>
          }
        />
      ))}
    </div>
  );
}

// ─── Panel: Approval Pre-Order ────────────────────────────────────────────────
function PreorderOrderCard({ txn }) {
  const isPendingApproval = txn.status === 'PENDING_APPROVAL';
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ background: isPendingApproval ? '#FFF7ED' : '#F0FDF4', borderBottom: `1px solid ${isPendingApproval ? '#FED7AA' : '#86EFAC'}`, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: '#2a1e10' }}>{txn.transaction_id}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, background: '#FED7AA', color: '#C2410C', padding: '2px 7px', borderRadius: 99 }}>🔖 PRE-ORDER</span>
            {isPendingApproval
              ? <span style={{ fontSize: 10.5, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: 99 }}>⏳ Menunggu</span>
              : <span style={{ fontSize: 10.5, fontWeight: 700, background: '#D1FAE5', color: '#065F46', padding: '2px 7px', borderRadius: 99 }}>✓ PAID</span>
            }
          </div>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{txn.customer_name || 'Walk-in'}{txn.customer_phone ? ` · ${txn.customer_phone}` : ''}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: C.muted }}>{formatDate(txn.created_at)}</p>
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: C.goldDark, flexShrink: 0 }}>{formatRupiah(txn.total_amount)}</span>
      </div>

      {txn.shipping_name ? (
        <div style={{ padding: '10px 16px', background: '#FFF7ED', borderBottom: `1px solid ${C.border}`, fontSize: 12.5 }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#7C2D12' }}>📦 Data Pengiriman</p>
          <p style={{ margin: 0, color: '#3a2e25' }}><strong>{txn.shipping_name}</strong>{txn.shipping_phone ? ` · ${txn.shipping_phone}` : ''}</p>
          <p style={{ margin: '2px 0 0', color: C.muted }}>{txn.shipping_address}{txn.shipping_city ? `, ${txn.shipping_city}` : ''}{txn.shipping_province ? `, ${txn.shipping_province}` : ''}</p>
        </div>
      ) : (
        <div style={{ padding: '10px 16px', background: '#FFFBEB', borderBottom: `1px solid ${C.border}`, fontSize: 12.5, color: '#92400E', fontWeight: 600 }}>
          ⚠ Data pengiriman belum diisi
        </div>
      )}

      <div style={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {txn.items?.map(item => (
          <div key={item.item_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: '#F9FAFB', borderRadius: 9, padding: '8px 12px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 600, color: '#2a1e10' }}>{item.product_name}</span>
            {item.is_preorder && (
              <span style={{ fontSize: 10.5, fontWeight: 700, background: '#FED7AA', color: '#C2410C', padding: '2px 6px', borderRadius: 5 }}>PRE-ORDER</span>
            )}
            <span style={{ color: C.muted, fontSize: 12 }}>×{item.quantity}</span>
            <span style={{ color: C.goldDark, fontWeight: 700, fontSize: 12 }}>{formatRupiah(item.unit_price * item.quantity)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreorderApprovalPanel() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    getPreorderApprovalOrders()
      .then(r => { setOrders(r.data.data ?? []); setError(null); })
      .catch(e => setError(e.response?.data?.message || 'Gagal memuat data pre-order.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>;
  if (error)   return <div style={{ padding: 32, color: C.crimson, fontWeight: 700 }}>⚠ {error}</div>;

  const pendingApproval = orders.filter(o => o.status === 'PENDING_APPROVAL');
  const paid            = orders.filter(o => o.status === 'PAID');

  if (orders.length === 0) return (
    <div style={{ padding: 48, textAlign: 'center', color: C.muted }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔖</div>
      <p style={{ fontWeight: 700, color: '#2a1e10', fontSize: 15 }}>Tidak ada pre-order aktif</p>
      <p style={{ fontSize: 13 }}>Pre-order menunggu approval atau yang sudah dibayar akan muncul di sini.</p>
    </div>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {pendingApproval.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#92400E' }}>⏳ Menunggu Approval</span>
            <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, border: '1px solid #FDE68A' }}>{pendingApproval.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingApproval.map(txn => <PreorderOrderCard key={txn.transaction_id} txn={txn} />)}
          </div>
        </div>
      )}
      {paid.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#065F46' }}>✓ Sudah Dibayar — Siap Diproses</span>
            <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, border: '1px solid #6EE7B7' }}>{paid.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {paid.map(txn => <PreorderOrderCard key={txn.transaction_id} txn={txn} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HelperPage() {
  const { user, role, logout } = useAuth();
  const { subscribe }          = useWebSocket();
  const navigate               = useNavigate();
  const { lang, setLang }      = useLang();

  const [activeMenu,    setActiveMenu]    = useState('order');
  const [activeSub,     setActiveSub]     = useState('membuat');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [approvalCount, setApprovalCount] = useState(0);
  const [handoverCount, setHandoverCount] = useState(0);
  const [mapOpen,       setMapOpen]       = useState(false);
  const [profileOpen,   setProfileOpen]   = useState(false);

  useEffect(() => {
    return subscribe('PENDING_APPROVAL_CREATED', () => {
      setApprovalCount(c => c + 1);
    });
  }, [subscribe]);

  function handleNavigate(menu, sub) {
    setActiveMenu(menu);
    setActiveSub(sub ?? null);
    setSearchQuery('');
    if (menu === 'approval') setApprovalCount(0);
  }

  function handleLogout() {
    logout();
    navigate('/staff/masuk');
  }

  const activeTab  = NAV_TABS.find(t => t.id === activeMenu);
  const panelKey   = activeSub ? `${activeMenu}/${activeSub}` : activeMenu;
  const meta       = PANEL_META[panelKey];
  const boothName  = user?.tenant_name || user?.tenant_id || 'Booth';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      fontFamily: "'Nunito', 'Nunito Sans', sans-serif",
      background: C.warmBg, overflow: 'hidden',
    }}>
      {/* Header */}
      <MobileHeader
        boothName={boothName}
        user={user}
        onOpenMap={() => setMapOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        lang={lang}
        setLang={setLang}
      />

      {/* Sub-nav */}
      <SubNav
        tab={activeTab}
        activeSub={activeSub}
        onSelect={sub => handleNavigate(activeMenu, sub)}
      />

      {/* Search bar */}
      <SearchBar meta={meta} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {panelKey === 'order/membuat'             && <MembuatOrderPanel searchQuery={searchQuery} />}
        {panelKey === 'order/outstanding'          && <OutstandingOrderPanel searchQuery={searchQuery} />}
        {panelKey === 'order/paid'                 && <PaidOrderPanel searchQuery={searchQuery} />}
        {panelKey === 'approval/belum_approve'     && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <ApprovalQueueTab onCountChange={setApprovalCount} />
          </div>
        )}
        {panelKey === 'approval/sudah_approve'     && <SudahApprovePanel searchQuery={searchQuery} />}
        {panelKey === 'approval/preorder_approval' && <PreorderApprovalPanel />}
        {panelKey === 'history'                    && <HistoryPanel />}
        {panelKey === 'handover/handover_outstanding' && (
          <HandoverOutstandingPanel searchQuery={searchQuery} onCountUpdate={setHandoverCount} />
        )}
        {panelKey === 'handover/sudah_handover'    && <SudahHandoverPanel searchQuery={searchQuery} />}
      </div>

      {/* Bottom navigation */}
      <BottomNav
        activeMenu={activeMenu}
        onNavigate={handleNavigate}
        approvalCount={approvalCount}
        handoverCount={handoverCount}
      />

      {/* Profile sheet */}
      {profileOpen && (
        <ProfileSheet
          user={user}
          role={role}
          onLogout={handleLogout}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {mapOpen && <MapModal onClose={() => setMapOpen(false)} />}
    </div>
  );
}
