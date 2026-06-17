import React, { useState, useEffect, useCallback } from 'react';
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  gold: '#C9A227', goldLight: '#F5EAB7', goldDark: '#7A6010',
  crimson: '#C4283A', crimsonLight: '#F9E4E6', crimsonDark: '#7A0F1C',
  olive: '#6B7A2A', oliveLight: '#E8EDD0', oliveDark: '#3A4210',
  warmBg: '#FBF7F0', border: '#E8E2D5', soft: '#F4EEE2', muted: '#9B8E7E',
};

// ─── Sidebar menu config ──────────────────────────────────────────────────────
const MENUS = [
  {
    id: 'order', label: 'Buat Order', dot: C.olive,
    subs: [
      { id: 'membuat', label: 'Membuat Order' },
      { id: 'outstanding', label: 'Outstanding' },
      { id: 'paid', label: 'Paid' },
    ],
  },
  {
    id: 'approval', label: 'Approval', dot: C.gold, hasBadge: 'approval',
    subs: [
      { id: 'belum_approve', label: 'Belum Approve' },
      { id: 'sudah_approve', label: 'Sudah Approve' },
      { id: 'preorder_approval', label: 'Approval Pre-Order' },
    ],
  },
  { id: 'history', label: 'History', dot: C.muted, subs: null },
  {
    id: 'handover', label: 'Serah Terima', dot: C.crimson, hasBadge: 'handover',
    subs: [
      { id: 'handover_outstanding', label: 'Outstanding' },
      { id: 'sudah_handover', label: 'Sudah Serah Terima' },
    ],
  },
];

// ─── Panel metadata ───────────────────────────────────────────────────────────
const PANEL_META = {
  'order/membuat':             { title: 'Membuat Order',       subtitle: 'Buat pesanan baru untuk customer walk-in',    showScan: true,  scanPlaceholder: 'Cari produk / scan barcode...' },
  'order/outstanding':         { title: 'Order Outstanding',   subtitle: 'Pesanan yang belum selesai pembayaran',       showScan: true,  scanPlaceholder: 'Cari nomor order...' },
  'order/paid':                { title: 'Order Paid',          subtitle: 'Pesanan yang sudah dibayar',                  showScan: true,  scanPlaceholder: 'Cari nomor order...' },
  'approval/belum_approve':    { title: 'Antrian Approval',    subtitle: 'Pesanan customer menunggu persetujuan',       showScan: true,  scanPlaceholder: 'Cari / scan QR order...' },
  'approval/sudah_approve':    { title: 'Sudah Disetujui',     subtitle: 'Pesanan yang telah disetujui',                showScan: true,  scanPlaceholder: 'Cari nomor order...' },
  'approval/preorder_approval':{ title: 'Approval Pre-Order',  subtitle: 'Pre-order yang sudah dibayar — siap diproses', showScan: false },
  'history':                   { title: 'History',             subtitle: 'Semua transaksi booth hari ini',              showScan: false },
  'handover/handover_outstanding': { title: 'Serah Terima',   subtitle: 'Pesanan PAID siap diserahkan ke customer',    showScan: true,  scanPlaceholder: 'Scan QR atau ketik nomor order...' },
  'handover/sudah_handover':   { title: 'Sudah Serah Terima', subtitle: 'Serah terima telah selesai dilakukan',        showScan: true,  scanPlaceholder: 'Cari nomor order...' },
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

// ─── Shared sub-components ────────────────────────────────────────────────────
function Banner({ type, children }) {
  const S = {
    amber: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
    green: { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
    red:   { bg: C.crimsonLight, color: C.crimsonDark, border: '#FECACA' },
  };
  const s = S[type] || S.amber;
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
      {children}
    </div>
  );
}

function OrderCard({ order, action }) {
  const name = order.customer_name || order.customer_reg_phone || order.customer_phone || 'Walk-in';
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: action ? 8 : 0 }}>
        <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
          <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#2a1e10' }}>{order.transaction_id}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: C.muted }}>{name} · {formatDate(order.created_at)}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.goldDark }}>{formatRupiah(order.total_amount)}</p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#5a4e3e', marginTop: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusDot(order.status), display: 'inline-block', flexShrink: 0 }} />
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
    <button onClick={onClick} style={{ fontSize: 12, color: C.gold, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'none', fontFamily: 'inherit', padding: '2px 4px' }}>
      ↺ Refresh
    </button>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ activeMenu, activeSub, onNavigate, approvalCount, handoverCount, boothName, user, role, onLogout, lang, setLang, onOpenMap }) {
  const [expanded, setExpanded] = useState(activeMenu);
  const logoUrl = useAppLogo();

  function toggle(menu) {
    if (menu.subs) {
      const willExpand = expanded !== menu.id;
      setExpanded(willExpand ? menu.id : null);
      if (willExpand) onNavigate(menu.id, menu.subs[0].id);
    } else {
      setExpanded(menu.id);
      onNavigate(menu.id, null);
    }
  }

  return (
    <aside style={{ width: 200, minWidth: 200, background: '#fff', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* Brand header */}
      <div style={{ background: C.crimson, padding: '14px 12px 12px', color: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          {logoUrl
            ? <img src={logoUrl} alt="" style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 4 }} />
            : <span style={{ fontSize: 20 }}>🧸</span>
          }
          <div>
            <div style={{ fontWeight: 800, fontSize: 12.5, letterSpacing: 0.3 }}>Amazing Toys</div>
            <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.25)', padding: '1px 5px', borderRadius: 3, letterSpacing: 0.8 }}>HYBRID</span>
          </div>
        </div>
        {/* Map + Language row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 9 }}>
          <button
            onClick={onOpenMap}
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
          >
            📍 Map
          </button>
          <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.35)' }}>
            {SUPPORTED_LANGS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{
                  padding: '3px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: lang === code ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                  color: lang === code ? C.crimsonDark : '#fff',
                  borderLeft: code !== SUPPORTED_LANGS[0].code ? '1px solid rgba(255,255,255,0.3)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {/* Booth subtitle */}
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Helper · {boothName}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: 4, paddingBottom: 8 }}>
        {MENUS.map(menu => {
          const isMenuActive = activeMenu === menu.id;
          const isExpanded = expanded === menu.id;
          const badge = menu.hasBadge === 'approval' ? approvalCount : menu.hasBadge === 'handover' ? handoverCount : 0;

          return (
            <div key={menu.id}>
              <div
                onClick={() => toggle(menu)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px',
                  cursor: 'pointer',
                  background: isMenuActive && !menu.subs ? C.crimson : 'transparent',
                  color: isMenuActive && !menu.subs ? '#fff' : '#3a2e25',
                  fontWeight: 700, fontSize: 13, userSelect: 'none',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isMenuActive && !menu.subs ? 'rgba(255,255,255,0.75)' : menu.dot, flexShrink: 0 }} />
                <span style={{ flex: 1, lineHeight: 1.35 }}>{menu.label}</span>
                {badge > 0 && (
                  <span style={{ background: C.crimson, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 9, padding: '1px 5px', minWidth: 16, textAlign: 'center', lineHeight: '14px', flexShrink: 0 }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
                {menu.subs && (
                  <span style={{ fontSize: 9, color: isMenuActive ? C.crimson : '#bbb', flexShrink: 0 }}>{isExpanded ? '▼' : '▶'}</span>
                )}
              </div>

              {menu.subs && isExpanded && menu.subs.map(sub => {
                const isSubActive = isMenuActive && activeSub === sub.id;
                return (
                  <div
                    key={sub.id}
                    onClick={() => onNavigate(menu.id, sub.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 10px 7px 26px', cursor: 'pointer',
                      background: isSubActive ? C.goldLight : '#fafaf7',
                      color: isSubActive ? C.goldDark : '#5a5248',
                      fontWeight: isSubActive ? 700 : 500, fontSize: 12.5, userSelect: 'none',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: isSubActive ? C.gold : '#d0c8bc', flexShrink: 0 }} />
                    {sub.label}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* CR-050: Pre-Order links */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: '4px 0' }}>
        <Link
          to="/helper/preorder-handover"
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', color: '#EA580C', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EA580C', flexShrink: 0 }} />
          <span style={{ flex: 1, lineHeight: 1.35 }}>📦 Pre-Order</span>
        </Link>
        <Link
          to="/helper/products/preorder"
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', color: '#EA580C', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EA580C', flexShrink: 0 }} />
          <span style={{ flex: 1, lineHeight: 1.35 }}>🔖 Pre-Order Produk</span>
        </Link>
      </div>

      {/* Footer: user + logout */}
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#2a1e10', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.name || user?.username}
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{role}</div>
        <Link to="/settings/devices" style={{ display: 'block', fontSize: 11, color: C.muted, textDecoration: 'none', marginBottom: 5 }}>
          🖥️ Perangkat Saya
        </Link>
        <button onClick={onLogout} style={{ fontSize: 12, fontWeight: 700, color: C.crimson, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          Keluar
        </button>
      </div>
    </aside>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
function TopBar({ meta, searchQuery, setSearchQuery }) {
  const [scannerOpen, setScannerOpen] = useState(false);
  if (!meta) return null;

  return (
    <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${C.border}`, background: '#fff', flexShrink: 0 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#2a1e10' }}>{meta.title}</h2>
      {meta.subtitle && <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted, fontWeight: 500 }}>{meta.subtitle}</p>}
      {meta.showScan && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={meta.scanPlaceholder || 'Ketik atau scan...'}
            style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', background: C.warmBg, color: '#2a1e10', outline: 'none' }}
          />
          <button
            onClick={() => setScannerOpen(true)}
            style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#3a2e25', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
          >
            📷 Scan QR
          </button>
        </div>
      )}
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

// ─── Panel: Membuat Order ─────────────────────────────────────────────────────
function MembuatOrderPanel({ searchQuery }) {
  const navigate = useNavigate();
  const publicConfig = usePublicConfig();
  const ppnRate = parseFloat(publicConfig?.ppn_rate) || 0;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState({});
  const [phone, setPhone] = useState('');
  const [confirmModal, setConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // CR-05X: Shipping fields for preorder
  const [shipName, setShipName] = useState('');
  const [shipPhone, setShipPhone] = useState('');
  const [shipAddress, setShipAddress] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipProvince, setShipProvince] = useState('');

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

  const hasPreorder = cartItems.some(i => i.is_preorder);

  const subtotal = cartItems.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const taxAmt = Math.round(subtotal * ppnRate / 100);
  const total = subtotal + taxAmt;

  async function handleCreateOrder() {
    if (cartItems.length === 0) return;
    setError('');
    // Validate shipping fields for preorder
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
        payload.shipping_name    = shipName.trim();
        payload.shipping_phone   = shipPhone.trim() || null;
        payload.shipping_address = shipAddress.trim();
        payload.shipping_city    = shipCity.trim() || null;
        payload.shipping_province = shipProvince.trim() || null;
      }
      const res = await createHelperOrder(payload);
      setCart({});
      setPhone('');
      setShipName(''); setShipPhone(''); setShipAddress(''); setShipCity(''); setShipProvince('');
      setConfirmModal(false);
      navigate('/helper/order-success', { state: res.data.data });
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat order');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {error && <Banner type="red">{error}</Banner>}

      {/* Category pills */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {['Semua', ...categories].map(cat => {
            const isAll = cat === 'Semua';
            const active = isAll ? !activeCategory : activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(isAll ? null : (activeCategory === cat ? null : cat))}
                style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${active ? C.gold : C.border}`, background: active ? C.goldLight : '#fff', color: active ? C.goldDark : '#5a5248' }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Product list */}
      {filtered.length === 0 && (
        <p style={{ color: C.muted, textAlign: 'center', padding: '32px 0', fontSize: 13 }}>Tidak ada produk ditemukan</p>
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
              borderRadius: 10, padding: '10px 12px', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: restricted ? 0.6 : 1,
            }}
          >
            {p.image_url ? (
              <img src={p.image_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: 8, background: C.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🧸</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#2a1e10', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product_name}</p>
              <p style={{ margin: '1px 0', fontSize: 12, fontWeight: 800, color: C.goldDark }}>{formatRupiah(Math.round(p.price * (1 + ppnRate / 100)))}</p>
              <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Stok {p.stock_quantity}{p.sku || p.barcode ? ` · ${p.sku || p.barcode}` : ''}</p>
              <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                {oos && <span style={{ fontSize: 10, background: C.crimsonLight, color: C.crimsonDark, padding: '1px 6px', borderRadius: 5, fontWeight: 700 }}>Habis</span>}
                {p.is_display_only && <span style={{ fontSize: 10, background: '#FFF3E0', color: '#BF6000', padding: '1px 6px', borderRadius: 5, fontWeight: 700 }}>Display Only</span>}
                {p.is_on_hold && <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 5, fontWeight: 700 }}>On Hold</span>}
                {p.is_preorder && <span style={{ fontSize: 10, background: '#FED7AA', color: '#EA580C', padding: '1px 6px', borderRadius: 5, fontWeight: 700 }}>PRE-ORDER</span>}
              </div>
              {p.is_preorder && p.preorder_note && (
                <p style={{ margin: '2px 0 0', fontSize: 10.5, color: '#EA580C', fontStyle: 'italic' }}>{p.preorder_note}</p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => setQty(p.product_id, -1)}
                disabled={qty === 0 || restricted}
                style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${C.border}`, background: '#fff', cursor: qty === 0 || restricted ? 'not-allowed' : 'pointer', fontSize: 18, opacity: qty === 0 || restricted ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: 0 }}
              >−</button>
              <span style={{ width: 24, textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: inCart ? C.oliveDark : '#3a2e25' }}>{qty}</span>
              <button
                onClick={() => setQty(p.product_id, 1)}
                disabled={restricted || qty >= p.stock_quantity || (p.max_per_customer && qty >= p.max_per_customer)}
                style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 18, opacity: restricted || qty >= p.stock_quantity ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: 0 }}
              >+</button>
            </div>
          </div>
        );
      })}

      {/* Cart summary */}
      {cartItems.length > 0 && (
        <div style={{ marginTop: 8, background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#2a1e10' }}>🛒 Ringkasan Pesanan</h3>
          {cartItems.map(i => (
            <div key={i.product_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4, color: '#5a4e3e' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: 8 }}>{i.product_name} ×{i.qty}</span>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>{formatRupiah(Math.round((i.price || 0) * i.qty * (1 + ppnRate / 100)))}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px dashed ${C.border}`, margin: '8px 0 6px', paddingTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginBottom: 4 }}>
              <span>PPN ~{ppnRate}%</span>
              <span>≈ {formatRupiah(taxAmt)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, color: '#2a1e10' }}>
              <span>Total</span>
              <span style={{ color: C.goldDark }}>{formatRupiah(total)}</span>
            </div>
          </div>
          <input
            type="text"
            placeholder="No. HP customer (opsional)"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', background: C.warmBg, color: '#2a1e10', outline: 'none' }}
          />

          {/* CR-05X: Shipping address for pre-order items */}
          {hasPreorder && (
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#FFF7ED', border: '1.5px solid #FED7AA' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#EA580C' }}>📦 Alamat Pengiriman (Pre-Order)</p>
              {[
                { label: 'Nama Penerima *', val: shipName, set: setShipName, placeholder: 'Nama lengkap penerima', req: true },
                { label: 'No. HP Penerima', val: shipPhone, set: setShipPhone, placeholder: '08xxxxxxxxxx', req: false },
                { label: 'Alamat Lengkap *', val: shipAddress, set: setShipAddress, placeholder: 'Jl. ..., No. ...', req: true },
                { label: 'Kota / Kabupaten', val: shipCity, set: setShipCity, placeholder: 'Jakarta Selatan', req: false },
                { label: 'Provinsi', val: shipProvince, set: setShipProvince, placeholder: 'DKI Jakarta', req: false },
              ].map(({ label, val, set, placeholder, req }) => (
                <div key={label} style={{ marginBottom: 6 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#92400E' }}>{label}</p>
                  <input
                    type="text"
                    value={val}
                    onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    required={req}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 7, border: `1.5px solid ${req && !val.trim() ? '#FCA5A5' : '#FED7AA'}`, fontSize: 12.5, fontFamily: 'inherit', background: '#fff', outline: 'none' }}
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => { setError(''); setConfirmModal(true); }}
            style={{ width: '100%', marginTop: 10, padding: '10px 0', borderRadius: 10, background: C.olive, color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            🎫 Buat Order
          </button>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 340, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 16, color: '#2a1e10' }}>Konfirmasi Order</h3>
            {hasPreorder && (
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#EA580C', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '4px 8px' }}>
                ⚠ Order ini berisi PRE-ORDER — barang akan dikirim ke alamat customer.
              </p>
            )}
            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#5a4e3e' }}>Buat order senilai <strong>{formatRupiah(total)}</strong>?</p>
            {hasPreorder && shipName && (
              <p style={{ margin: '0 0 4px', fontSize: 12, color: C.muted }}>Dikirim ke: <strong>{shipName}</strong>{shipCity ? `, ${shipCity}` : ''}</p>
            )}
            <p style={{ margin: '0 0 16px', fontSize: 12, color: C.muted }}>
              {phone ? `QR akan dikirim ke ${phone}` : 'Tidak ada nomor HP — customer scan langsung di layar'}
            </p>
            {error && <p style={{ margin: '0 0 12px', fontSize: 12, color: C.crimson, fontWeight: 600 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setConfirmModal(false); setError(''); }}
                disabled={submitting}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
              >
                Batal
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={submitting}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: C.olive, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}
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

  if (loading) return <div style={{ padding: 24 }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <Banner type="amber">⏳ {orders.length} pesanan belum selesai pembayaran</Banner>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><RefreshBtn onClick={load} /></div>
      {filtered.length === 0 && <p style={{ color: C.muted, textAlign: 'center', padding: '32px 0', fontSize: 13 }}>Tidak ada order outstanding</p>}
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

  if (loading) return <div style={{ padding: 24 }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <Banner type="green">✅ {orders.length} pesanan sudah dibayar</Banner>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><RefreshBtn onClick={load} /></div>
      {filtered.length === 0 && <p style={{ color: C.muted, textAlign: 'center', padding: '32px 0', fontSize: 13 }}>Tidak ada order paid</p>}
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

  if (loading) return <div style={{ padding: 24 }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><RefreshBtn onClick={load} /></div>
      {filtered.length === 0 && <p style={{ color: C.muted, textAlign: 'center', padding: '32px 0', fontSize: 13 }}>Tidak ada order yang sudah disetujui</p>}
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

  if (loading) return <div style={{ padding: 24 }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><RefreshBtn onClick={load} /></div>
      {orders.length === 0 && <p style={{ color: C.muted, textAlign: 'center', padding: '32px 0', fontSize: 13 }}>Belum ada transaksi hari ini</p>}
      {orders.map(o => {
        const name = o.customer_name || o.customer_reg_phone || o.customer_phone || 'Walk-in';
        return (
          <div
            key={o.transaction_id}
            style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#2a1e10' }}>{o.transaction_id}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: C.muted }}>{formatDate(o.created_at)} · {name}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: C.goldDark }}>{formatRupiah(o.total_amount)}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#5a4e3e', marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusDot(o.status), display: 'inline-block' }} />
                {statusLabel(o.status)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Handover item row (needs its own state for imgErr) ──────────────────────
function HandoverItemRow({ item, checked, onToggle }) {
  const [imgErr, setImgErr] = useState(false);
  const qty = item.approved_quantity ?? item.quantity;
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', marginBottom: 6,
        background: '#fff', borderRadius: 10, border: `1.5px solid ${checked ? C.olive : C.border}`,
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: C.soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item.image_url && !imgErr
          ? <img src={item.image_url} alt={item.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
          : <span style={{ fontSize: 24 }}>🧸</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: checked ? C.oliveDark : '#2a1e10', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.product_name}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: C.muted }}>
          ×{qty}{item.barcode ? ` · ${item.barcode}` : ''}
        </p>
      </div>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${checked ? C.olive : '#ccc'}`,
        background: checked ? C.olive : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        {checked && <span style={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1 }}>✓</span>}
      </div>
    </div>
  );
}

// ─── T2: Handover Detail View ─────────────────────────────────────────────────
function HandoverDetailView({ order: initialOrder, onBack, onDone }) {
  const [order, setOrder] = useState(initialOrder);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemChecks, setItemChecks] = useState([]);
  const [confirmModal, setConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Untuk group invoice: re-fetch pakai group_code agar is_group_invoice tetap terbawa
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
      // Group invoice: handover via group_code agar setiap booth hanya mark item-nya sendiri
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
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#5a4e3e', fontFamily: 'inherit' }}
        >
          ← Kembali
        </button>
        <h3 style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 800, color: '#2a1e10', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Serah Terima · {order.transaction_id}
        </h3>
        <span style={{ background: C.oliveLight, color: C.oliveDark, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 8, flexShrink: 0 }}>
          {checkedCount}/{items.length} ✓
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {error && <Banner type="red">{error}</Banner>}

        {loading ? <Spinner /> : (
          <>
            {/* Summary card */}
            <div style={{ background: C.soft, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              {[
                ['ID Transaksi', <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2a1e10' }}>{order.transaction_id}</span>],
                ['Customer',     <span style={{ fontWeight: 600, color: '#2a1e10' }}>{customerName}</span>],
                ['Total',        <span style={{ fontWeight: 800, color: C.goldDark }}>{formatRupiah(order.total_amount)}</span>],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ color: C.muted, fontWeight: 500 }}>{label}</span>
                  {val}
                </div>
              ))}
            </div>

            {/* Checklist header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#2a1e10' }}>Tap item saat diserahkan</p>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{checkedCount}/{items.length}</span>
            </div>

            {/* Progress bar */}
            <div style={{ height: 5, borderRadius: 3, background: C.border, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: C.olive, transition: 'width 0.3s ease', borderRadius: 3 }} />
            </div>

            {/* Item checklist */}
            {items.map((item, idx) => (
              <HandoverItemRow
                key={item.item_id || idx}
                item={item}
                checked={itemChecks[idx]}
                onToggle={() => setItemChecks(prev => prev.map((v, i) => i === idx ? !v : v))}
              />
            ))}

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', color: C.muted }}>
              <div style={{ flex: 1, borderTop: `1.5px dashed ${C.border}` }} />
              <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>centang semua item untuk unlock</span>
              <div style={{ flex: 1, borderTop: `1.5px dashed ${C.border}` }} />
            </div>

            {/* Info banner */}
            <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#065F46', fontWeight: 600, marginBottom: 14 }}>
              ℹ️ Semua item harus di-centang sebelum konfirmasi serah terima
            </div>

            {/* Confirm button */}
            <button
              onClick={() => setConfirmModal(true)}
              disabled={!allChecked}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                background: allChecked ? C.olive : '#e0dbd4',
                color: allChecked ? '#fff' : '#9a9087',
                fontWeight: 800, fontSize: 14,
                cursor: allChecked ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', transition: 'background 0.2s',
              }}
            >
              ✅ Konfirmasi Serah Terima
            </button>
          </>
        )}
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 320, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 16, color: '#2a1e10' }}>Konfirmasi Serah Terima</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#5a4e3e' }}>
              Semua {items.length} item sudah diserahkan ke <strong>{customerName}</strong>?
            </p>
            {error && <p style={{ margin: '0 0 10px', fontSize: 12, color: C.crimson, fontWeight: 600 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setConfirmModal(false); setError(''); }}
                disabled={submitting}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
              >
                Tidak
              </button>
              <button
                onClick={doHandover}
                disabled={submitting}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: C.olive, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}
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

  // GRP-xxx direct lookup — saat helper scan/ketik kode group invoice
  useEffect(() => {
    const q = (searchQuery ?? '').trim();
    if (!/^GRP-/i.test(q)) { setGrpError(''); return; }
    if (q.length < 10) return; // tunggu kode lengkap sebelum lookup
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

  if (loading || grpLoading) return <div style={{ padding: 24 }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <Banner type="amber">📦 {orders.length} pesanan siap diserahkan</Banner>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><RefreshBtn onClick={load} /></div>
      {grpError && <Banner type="red">{grpError}</Banner>}
      {!grpError && filtered.length === 0 && (
        <p style={{ color: C.muted, textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
          Tidak ada pesanan untuk diserahkan
        </p>
      )}
      {filtered.map(o => (
        <OrderCard
          key={o.transaction_id}
          order={o}
          action={
            <button
              onClick={() => setSelectedOrder(o)}
              style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', background: C.olive, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}
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

  if (loading) return <div style={{ padding: 24 }}><Spinner /></div>;

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <Banner type="green">✅ {orders.length} serah terima selesai</Banner>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><RefreshBtn onClick={load} /></div>
      {filtered.length === 0 && <p style={{ color: C.muted, textAlign: 'center', padding: '32px 0', fontSize: 13 }}>Belum ada serah terima selesai</p>}
      {filtered.map(o => (
        <OrderCard
          key={o.transaction_id}
          order={o}
          action={
            <span style={{ display: 'inline-block', marginTop: 4, background: C.oliveLight, color: C.oliveDark, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>
              HANDOVER DONE
            </span>
          }
        />
      ))}
    </div>
  );
}

// ─── Panel: Approval Pre-Order (CR-050 Req-3, CR1 update) ────────────────────
function PreorderOrderCard({ txn }) {
  const isPendingApproval = txn.status === 'PENDING_APPROVAL';
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      {/* Card header */}
      <div style={{ background: isPendingApproval ? '#FFF7ED' : '#F0FDF4', borderBottom: `1px solid ${isPendingApproval ? '#FED7AA' : '#86EFAC'}`, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, color: '#2a1e10' }}>{txn.transaction_id}</span>
            <span style={{ fontSize: 11, fontWeight: 700, background: '#FED7AA', color: '#C2410C', padding: '1px 7px', borderRadius: 99, border: '1px solid #FDBA74' }}>🔖 PRE-ORDER</span>
            {isPendingApproval
              ? <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '1px 7px', borderRadius: 99, border: '1px solid #FDE68A' }}>⏳ Menunggu Approval</span>
              : <span style={{ fontSize: 11, fontWeight: 700, background: '#D1FAE5', color: '#065F46', padding: '1px 7px', borderRadius: 99, border: '1px solid #6EE7B7' }}>✓ PAID</span>
            }
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>{txn.customer_name || 'Walk-in'}{txn.customer_phone ? ` · ${txn.customer_phone}` : ''} · {formatDate(txn.created_at)}</p>
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, color: C.goldDark }}>{formatRupiah(txn.total_amount)}</span>
      </div>

      {/* Shipping details */}
      {txn.shipping_name ? (
        <div style={{ padding: '8px 16px', background: '#FFF7ED', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#7C2D12', marginBottom: 3 }}>📦 Data Pengiriman</p>
          <p style={{ margin: 0, color: '#3a2e25' }}><strong>{txn.shipping_name}</strong> · {txn.shipping_phone}</p>
          <p style={{ margin: '2px 0 0', color: C.muted }}>{txn.shipping_address}{txn.shipping_city ? `, ${txn.shipping_city}` : ''}{txn.shipping_province ? `, ${txn.shipping_province}` : ''}</p>
          {txn.courier && <p style={{ margin: '2px 0 0', color: C.muted }}>Kurir: {txn.courier}{txn.tracking_number ? ` · Resi: ${txn.tracking_number}` : ''}</p>}
        </div>
      ) : (
        <div style={{ padding: '8px 16px', background: '#FFFBEB', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: '#92400E', fontWeight: 600 }}>
          ⚠ Data pengiriman belum diisi — akan dilengkapi saat approve di tab "Belum Approve".
        </div>
      )}

      {/* Items */}
      <div style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {txn.items?.map(item => (
          <div key={item.item_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: '#F9FAFB', borderRadius: 8, padding: '6px 10px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 600, color: '#2a1e10' }}>{item.product_name}</span>
            {item.is_preorder && (
              <span style={{ fontSize: 10, fontWeight: 700, background: '#FED7AA', color: '#C2410C', padding: '1px 5px', borderRadius: 4 }}>PRE-ORDER</span>
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

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><Spinner /></div>;
  if (error)   return <div style={{ padding: 32, color: C.crimson, fontWeight: 700 }}>⚠ {error}</div>;

  const pendingApproval = orders.filter(o => o.status === 'PENDING_APPROVAL');
  const paid            = orders.filter(o => o.status === 'PAID');

  if (orders.length === 0) return (
    <div style={{ padding: 32, textAlign: 'center', color: C.muted }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🔖</div>
      <p style={{ fontWeight: 700, color: '#2a1e10' }}>Tidak ada pre-order aktif</p>
      <p style={{ fontSize: 12 }}>Pre-order menunggu approval atau yang sudah dibayar akan muncul di sini.</p>
    </div>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Section: Menunggu Approval */}
      {pendingApproval.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#92400E' }}>⏳ Menunggu Approval</span>
            <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 99, border: '1px solid #FDE68A' }}>{pendingApproval.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingApproval.map(txn => <PreorderOrderCard key={txn.transaction_id} txn={txn} />)}
          </div>
        </div>
      )}

      {/* Section: Sudah Dibayar */}
      {paid.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#065F46' }}>✓ Sudah Dibayar — Siap Diproses</span>
            <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 99, border: '1px solid #6EE7B7' }}>{paid.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

  // Live approval badge via WebSocket
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

  const panelKey = activeSub ? `${activeMenu}/${activeSub}` : activeMenu;
  const meta = PANEL_META[panelKey];
  const boothName = user?.tenant_name || user?.tenant_id || 'Booth';

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: C.warmBg, overflow: 'hidden' }}>
      <Sidebar
        activeMenu={activeMenu}
        activeSub={activeSub}
        onNavigate={handleNavigate}
        approvalCount={approvalCount}
        handoverCount={handoverCount}
        boothName={boothName}
        user={user}
        role={role}
        onLogout={handleLogout}
        lang={lang}
        setLang={setLang}
        onOpenMap={() => setMapOpen(true)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar meta={meta} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

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
      </div>

      {mapOpen && <MapModal onClose={() => setMapOpen(false)} />}
    </div>
  );
}
