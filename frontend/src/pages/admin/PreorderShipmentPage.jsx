import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPreorderList, updateShipment, confirmArrived, confirmReadyToShip } from '../../api/preorder';
import { formatRupiah, formatDate } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';

// ── Design tokens (same palette as HelperPage) ────────────────────────────────
const C = {
  gold:       '#B08D57', goldDark:   '#8a6a35', goldLight:  '#FFF8EC',
  olive:      '#4A7C59', oliveDark:  '#355c41', oliveLight: '#EDF7F0',
  crimson:    '#B03A2E', crimsonDark:'#7B1D14', crimsonLight:'#FDECEA',
  border:     '#E5DDD0', muted:      '#8a7968', warmBg:     '#FAFAF8',
  soft:       '#F5F1EB',
  orange:     '#EA580C', orangeLight: '#FFF7ED', orangeBorder: '#FED7AA',
};

function formatRupiahShort(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n ?? 0);
}

// BUG-051-02b: added 'pending' tab — PENDING/PENDING_APPROVAL pre-orders visible for admin monitoring.
// BUG-051-02: added 'paid' tab — PAID pre-orders now visible for admin processing.
const STATUS_TABS = [
  { key: 'pending',   label: 'Menunggu Pembayaran',  color: '#7C3AED' },
  { key: 'paid',      label: 'Sudah Dibayar',        color: C.orange },
  { key: 'awaiting',  label: 'Menunggu Kirim',       color: C.gold },
  { key: 'arrived',   label: 'Barang Sudah Sampai',  color: C.olive },
  { key: 'completed', label: 'Selesai',              color: C.muted },
];

function Banner({ children, color }) {
  return (
    <div style={{ background: `${color}18`, border: `1px solid ${color}55`, color, borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
      {children}
    </div>
  );
}

function ShipModal({ txn, onClose, onDone }) {
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!courier.trim() || !tracking.trim()) { setErr('Ekspedisi dan nomor resi wajib diisi.'); return; }
    setSaving(true);
    try {
      await updateShipment(txn.transaction_id, { courier: courier.trim(), tracking_number: tracking.trim() });
      onDone();
    } catch (e) {
      setErr(e.response?.data?.message || 'Gagal memperbarui pengiriman.');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 360, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15, color: '#2a1e10' }}>Input Resi Pengiriman</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: C.muted }}>{txn.transaction_id} — {txn.customer_name || txn.shipping_name}</p>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5a4e3e', marginBottom: 3 }}>Ekspedisi *</label>
          <input value={courier} onChange={e => setCourier(e.target.value)} placeholder="JNE / SiCepat / J&T / dll"
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5a4e3e', marginBottom: 3 }}>Nomor Resi *</label>
          <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="000000000000"
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        </div>
        {err && <p style={{ margin: '0 0 10px', fontSize: 12, color: C.crimson, fontWeight: 600 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} disabled={saving}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
            Batal
          </button>
          <button onClick={submit} disabled={saving}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: C.olive, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Menyimpan...' : 'Konfirmasi Kirim'}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_BADGE = {
  PENDING_APPROVAL: { label: 'Menunggu Approval Helper', bg: '#EDE9FE', color: '#7C3AED' },
  PENDING:          { label: 'Menunggu Pembayaran',       bg: '#FEF3C7', color: '#92400E' },
};

function TxnCard({ txn, tabKey, onAction }) {
  const name = txn.customer_name || txn.shipping_name || 'Walk-in';
  const phone = txn.customer_phone || txn.shipping_phone;
  const badge = STATUS_BADGE[txn.status];
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#2a1e10' }}>{txn.transaction_id}</p>
            {badge && (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
            )}
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>{name}{phone ? ` · ${phone}` : ''}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: C.muted }}>{formatDate(txn.paid_at || txn.created_at)}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.goldDark }}>{formatRupiahShort(txn.total_amount)}</p>
        </div>
      </div>

      {/* Shipping info */}
      {txn.shipping_address && (
        <div style={{ fontSize: 11.5, color: '#5a4e3e', marginBottom: 8, background: C.orangeLight, border: `1px solid ${C.orangeBorder}`, borderRadius: 6, padding: '5px 8px' }}>
          <strong>Pengiriman:</strong> {txn.shipping_name}{txn.shipping_city ? `, ${txn.shipping_city}` : ''}<br />
          {txn.shipping_address}
        </div>
      )}

      {/* Courier info for shipped/arrived */}
      {txn.courier && (
        <div style={{ fontSize: 11.5, color: '#2563EB', marginBottom: 8 }}>
          <strong>{txn.courier}</strong> · Resi: <span style={{ fontFamily: 'monospace' }}>{txn.tracking_number}</span>
          {txn.shipped_at && <span style={{ color: C.muted }}> · Dikirim {formatDate(txn.shipped_at)}</span>}
        </div>
      )}
      {txn.arrived_at && (
        <div style={{ fontSize: 11.5, color: C.olive, marginBottom: 8 }}>Tiba: {formatDate(txn.arrived_at)}</div>
      )}

      {/* Action buttons */}
      {tabKey === 'pending' && (
        <div style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600, textAlign: 'center', padding: '6px 0', background: '#EDE9FE', borderRadius: 7 }}>
          Menunggu {txn.status === 'PENDING_APPROVAL' ? 'persetujuan helper' : 'pembayaran customer'}
        </div>
      )}
      {tabKey === 'paid' && (
        <button onClick={() => onAction('ready', txn)}
          style={{ width: '100%', padding: '8px 0', borderRadius: 9, background: C.orange, color: '#fff', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          🚀 Proses Pengiriman
        </button>
      )}
      {/* CR-050: AWAITING_SHIPMENT → ARRIVED directly (no resi input needed) */}
      {tabKey === 'awaiting' && (
        <button onClick={() => onAction('arrived', txn)}
          style={{ width: '100%', padding: '8px 0', borderRadius: 9, background: C.olive, color: '#fff', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          ✅ Konfirmasi Barang Sudah Sampai
        </button>
      )}
      {tabKey === 'arrived' && (
        <div style={{ fontSize: 12, color: C.olive, fontWeight: 600, textAlign: 'center', padding: '6px 0' }}>
          Menunggu serah terima oleh Helper
        </div>
      )}
    </div>
  );
}

export default function PreorderShipmentPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shipModal, setShipModal] = useState(null);
  const [arrivedConfirm, setArrivedConfirm] = useState(null);
  const [readyConfirm, setReadyConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getPreorderList(activeTab)
      .then(r => setOrders(r.data.data || []))
      .catch(() => setError('Gagal memuat data pre-order.'))
      .finally(() => setLoading(false));
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  async function handleReady() {
    if (!readyConfirm) return;
    setActionLoading(true);
    try {
      await confirmReadyToShip(readyConfirm.transaction_id);
      setReadyConfirm(null);
      showToast('Status diperbarui ke AWAITING_SHIPMENT — pindah ke tab Menunggu Kirim.');
      load();
    } catch (e) {
      showToast(e.response?.data?.message || 'Gagal memproses pengiriman.', 'error');
    } finally { setActionLoading(false); }
  }

  async function handleArrived() {
    if (!arrivedConfirm) return;
    setActionLoading(true);
    try {
      await confirmArrived(arrivedConfirm.transaction_id);
      setArrivedConfirm(null);
      showToast('Status diperbarui ke ARRIVED.');
      load();
    } catch (e) {
      showToast(e.response?.data?.message || 'Gagal konfirmasi kedatangan.', 'error');
    } finally { setActionLoading(false); }
  }

  function handleAction(type, txn) {
    if (type === 'ready')  setReadyConfirm(txn);
    if (type === 'ship')   setShipModal(txn);
    if (type === 'arrived') setArrivedConfirm(txn);
  }

  return (
    <div style={{ minHeight: '100vh', background: C.warmBg, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 2000, background: toast.type === 'error' ? C.crimson : C.olive, color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: C.olive, color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/admin')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 700 }}>
          ← Kembali
        </button>
        <div>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>📦 Manajemen Pengiriman Pre-Order</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.8 }}>Kelola pengiriman barang pre-order kepada customer</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1.5px solid ${C.border}`, background: '#fff', overflowX: 'auto' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '11px 18px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
              border: 'none', borderBottom: activeTab === tab.key ? `2.5px solid ${tab.color}` : '2.5px solid transparent',
              background: activeTab === tab.key ? `${tab.color}12` : '#fff',
              color: activeTab === tab.key ? tab.color : C.muted,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 16, maxWidth: 680, margin: '0 auto' }}>
        {loading && <div style={{ padding: 32, textAlign: 'center' }}><Spinner /></div>}
        {error && <Banner color={C.crimson}>{error}</Banner>}

        {!loading && !error && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button onClick={load} style={{ fontSize: 12, color: C.gold, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'none', fontFamily: 'inherit' }}>
                ↺ Refresh
              </button>
            </div>

            {orders.length === 0 && (
              <p style={{ textAlign: 'center', color: C.muted, padding: '40px 0', fontSize: 13 }}>
                Tidak ada data pre-order untuk status ini.
              </p>
            )}

            {orders.map(txn => (
              <TxnCard key={txn.transaction_id} txn={txn} tabKey={activeTab} onAction={handleAction} />
            ))}
          </>
        )}
      </div>

      {/* Ready-to-ship confirm modal */}
      {readyConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 340, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 15, color: '#2a1e10' }}>🚀 Proses Pengiriman</h3>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: '#5a4e3e' }}>
              Konfirmasi bahwa <strong>{readyConfirm.transaction_id}</strong> siap diproses untuk pengiriman?
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: C.muted }}>
              Status akan berubah ke <strong>AWAITING_SHIPMENT</strong> — transaksi akan pindah ke tab "Menunggu Kirim".
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setReadyConfirm(null)} disabled={actionLoading}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                Batal
              </button>
              <button onClick={handleReady} disabled={actionLoading}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: C.orange, color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', opacity: actionLoading ? 0.7 : 1 }}>
                {actionLoading ? 'Memproses...' : 'Ya, Proses'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ship modal */}
      {shipModal && (
        <ShipModal
          txn={shipModal}
          onClose={() => setShipModal(null)}
          onDone={() => { setShipModal(null); showToast('Pengiriman dikonfirmasi — status SHIPPED.'); load(); }}
        />
      )}

      {/* Arrived confirm modal */}
      {arrivedConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 340, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 15, color: '#2a1e10' }}>Konfirmasi Kedatangan</h3>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: '#5a4e3e' }}>
              Konfirmasi bahwa barang <strong>{arrivedConfirm.transaction_id}</strong> sudah tiba di Indonesia?
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: C.muted }}>
              Status akan berubah ke ARRIVED dan Helper dapat melakukan serah terima.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setArrivedConfirm(null)} disabled={actionLoading}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                Batal
              </button>
              <button onClick={handleArrived} disabled={actionLoading}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: C.olive, color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', opacity: actionLoading ? 0.7 : 1 }}>
                {actionLoading ? 'Memproses...' : 'Ya, Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
