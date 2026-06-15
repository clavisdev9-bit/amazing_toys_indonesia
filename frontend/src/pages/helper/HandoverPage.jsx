import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPreorderList, handoverPreorder } from '../../api/preorder';
import { formatRupiah, formatDate } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';

// Design tokens matching HelperPage
const C = {
  gold:        '#B08D57', goldDark:    '#8a6a35', goldLight:   '#FFF8EC',
  olive:       '#4A7C59', oliveDark:   '#355c41', oliveLight:  '#EDF7F0',
  crimson:     '#B03A2E', crimsonDark: '#7B1D14', crimsonLight:'#FDECEA',
  border:      '#E5DDD0', muted:       '#8a7968', warmBg:      '#FAFAF8',
  soft:        '#F5F1EB',
  orange:      '#EA580C', orangeLight: '#FFF7ED', orangeBorder:'#FED7AA',
};

function formatRupiahLocal(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n ?? 0);
}

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

export default function HandoverPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmTxn, setConfirmTxn] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getPreorderList('arrived')
      .then(r => setOrders(r.data.data || []))
      .catch(() => setError('Gagal memuat data pre-order.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleHandover() {
    if (!confirmTxn) return;
    setSubmitting(true);
    try {
      await handoverPreorder(confirmTxn.transaction_id);
      setConfirmTxn(null);
      showToast('Serah terima berhasil! Transaksi COMPLETED.');
      load();
    } catch (e) {
      showToast(e.response?.data?.message || 'Gagal melakukan serah terima.', 'error');
    } finally { setSubmitting(false); }
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
      <div style={{ background: C.crimson, color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/helper')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 700 }}>
          ← Kembali
        </button>
        <div>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>📦 Serah Terima Pre-Order</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.85 }}>Barang sudah tiba — serahkan kepada customer</p>
        </div>
        <button onClick={load} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 700 }}>
          ↺ Refresh
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: 16, maxWidth: 580, margin: '0 auto' }}>
        {loading && <div style={{ padding: 32, textAlign: 'center' }}><Spinner /></div>}
        {error && <Banner type="red">{error}</Banner>}

        {!loading && !error && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>Tidak ada barang yang perlu diserahkan</p>
            <p style={{ fontSize: 12.5, marginTop: 4 }}>Semua pre-order sudah selesai atau belum ada yang tiba.</p>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <>
            <Banner type="amber">
              📦 {orders.length} barang pre-order siap diserahkan ke customer
            </Banner>

            {orders.map(txn => {
              const name  = txn.customer_name || txn.shipping_name || 'Walk-in';
              const phone = txn.customer_phone || txn.shipping_phone;
              return (
                <div key={txn.transaction_id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                      <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#2a1e10' }}>{txn.transaction_id}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>{name}{phone ? ` · ${phone}` : ''}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: C.goldDark }}>{formatRupiahLocal(txn.total_amount)}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, background: C.oliveLight, color: C.oliveDark, padding: '2px 7px', borderRadius: 5 }}>ARRIVED</span>
                    </div>
                  </div>

                  {/* Shipping info */}
                  <div style={{ fontSize: 11.5, color: '#5a4e3e', marginBottom: 8, background: C.orangeLight, border: `1px solid ${C.orangeBorder}`, borderRadius: 6, padding: '6px 8px' }}>
                    <strong>Dikirim ke:</strong> {txn.shipping_name}
                    {txn.shipping_city ? `, ${txn.shipping_city}` : ''}
                    {txn.shipping_province ? `, ${txn.shipping_province}` : ''}<br />
                    {txn.shipping_address && <span>{txn.shipping_address}<br /></span>}
                    {txn.courier && <span style={{ color: '#2563EB' }}>{txn.courier} · {txn.tracking_number}</span>}
                  </div>

                  {/* Items */}
                  {(txn.items || []).length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {txn.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#5a4e3e', marginBottom: 2 }}>
                          <span>{item.product_name} ×{item.approved_quantity ?? item.quantity}</span>
                          <span style={{ fontWeight: 700 }}>{formatRupiahLocal(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setConfirmTxn(txn)}
                    style={{ width: '100%', padding: '10px 0', borderRadius: 10, background: C.olive, color: '#fff', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    ✅ Serahkan Barang ke Customer
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Confirm modal */}
      {confirmTxn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 340, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 15, color: '#2a1e10' }}>Konfirmasi Serah Terima</h3>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: '#5a4e3e' }}>
              Konfirmasi barang <strong>{confirmTxn.transaction_id}</strong> sudah diserahkan kepada customer?
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: C.muted }}>
              Customer: <strong>{confirmTxn.customer_name || confirmTxn.shipping_name}</strong>
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: C.muted }}>
              Transaksi akan otomatis COMPLETED setelah konfirmasi.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmTxn(null)} disabled={submitting}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                Batal
              </button>
              <button onClick={handleHandover} disabled={submitting}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: C.olive, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Memproses...' : 'Ya, Serahkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
