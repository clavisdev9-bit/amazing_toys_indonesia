import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getOrder, cancelOrder, updateOrderItem, deleteOrderItem, partialProcessOrder } from '../../api/orders';
import { getPublicOrder } from '../../api/helper';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useCountdown } from '../../hooks/useCountdown';
import { formatRupiah, formatDate } from '../../utils/format';
import { groupByTenant } from '../../utils/order';
import { useLang } from '../../context/LangContext';
import { usePublicConfig } from '../../hooks/useAppLogo';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';

// ── Countdown hook (dipakai di public mode) ───────────────────────────────────
function useCountdownTo(expiresAt) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    function tick() { setRemaining(Math.max(0, new Date(expiresAt) - Date.now())); }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const totalSecs = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins  = Math.floor((totalSecs % 3600) / 60);
  const secs  = totalSecs % 60;
  return { remaining, hours, mins, secs };
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC MODE — diakses via link WA tanpa login
// ═════════════════════════════════════════════════════════════════════════════
function PublicOrderView({ txnId, token }) {
  const [order, setOrder]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const { t } = useLang();
  const { remaining, hours, mins, secs } = useCountdownTo(order?.expiresAt);

  const fetchOrder = useCallback(() => {
    setLoading(true);
    getPublicOrder(txnId, token)
      .then(r => setOrder(r.data.data))
      .catch(err => setError(
        err.response?.data?.message || 'Link tidak valid atau sudah kedaluwarsa.',
      ))
      .finally(() => setLoading(false));
  }, [txnId, token]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // Poll setiap 30 detik untuk update status (RESERVED → PAID)
  useEffect(() => {
    const id = setInterval(fetchOrder, 30_000);
    return () => clearInterval(id);
  }, [fetchOrder]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  if (error) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h2 className="font-bold text-gray-800 mb-2">{t('order.invalidLink')}</h2>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  if (!order) return null;

  const paid    = order.paid || ['PAID','HANDED_OVER','COMPLETED'].includes(order.status);
  const expired = remaining === 0 && order.expiresAt;

  if (paid) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="font-bold text-gray-800 text-xl mb-2">{t('order.paymentDone')}</h2>
        <p className="text-sm text-gray-500 mb-1">{t('order.ordersFrom')} <span className="font-mono font-semibold">{order.txnId}</span></p>
        <p className="text-sm text-gray-500">
          {t('order.collectBooth', { name: order.boothName })}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      {/* Header booth */}
      <div className="text-center mb-5">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t('order.ordersFrom')}</p>
        <h2 className="font-bold text-gray-900 text-lg">{order.boothName}</h2>
        {order.boothLocation && (
          <p className="text-sm text-gray-500">{order.boothLocation}</p>
        )}
      </div>

      {/* QR Code besar */}
      <div className="flex justify-center mb-4">
        {order.qrData ? (
          <div className="bg-white p-4 rounded-2xl border-2 border-blue-200 shadow-sm">
            <QRCodeSVG value={order.txnId} size={240} level="M" includeMargin={false} />
          </div>
        ) : (
          <div className="w-64 h-64 bg-gray-100 rounded-2xl flex items-center justify-center">
            <p className="text-gray-400 text-sm text-center px-4">{t('order.qrNA')}</p>
          </div>
        )}
      </div>

      {/* Instruksi */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 px-4 py-3 mb-4 text-center">
        <p className="text-sm text-blue-800 font-medium">
          {t('order.showQRToCashier')}
        </p>
      </div>

      {/* Countdown */}
      {order.expiresAt && (
        <div className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 mb-4 text-sm font-semibold ${
          expired
            ? 'bg-red-100 text-red-700'
            : (hours === 0 && mins < 10)
              ? 'bg-amber-100 text-amber-700'
              : 'bg-green-100 text-green-700'
        }`}>
          <span>⏱</span>
          {expired
            ? t('order.qrExpired')
            : t('order.validFor', { time: `${hours > 0 ? `${hours}j ` : ''}${mins}m ${String(secs).padStart(2,'0')}d` })}
        </div>
      )}

      {/* Detail pesanan */}
      <div className="bg-white rounded-xl border divide-y mb-4">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="text-gray-700">{item.name} ×{item.qty}</span>
            <span className="text-gray-500">{formatRupiah(item.unitPrice * item.qty)}</span>
          </div>
        ))}
        <div className="flex justify-between items-center px-4 py-3 font-bold text-base">
          <span>Total</span>
          <span className="text-blue-700">{formatRupiah(order.totalAmount)}</span>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center font-mono">{order.txnId}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTHENTICATED MODE — perilaku existing, tidak berubah
// ═════════════════════════════════════════════════════════════════════════════
export default function OrderTrackingPage() {
  const { transactionId } = useParams();
  const [searchParams]    = useSearchParams();
  const publicToken       = searchParams.get('token');

  // ── Public mode: ada ?token= ──────────────────────────────────────────────
  if (publicToken) {
    return <PublicOrderView txnId={transactionId} token={publicToken} />;
  }

  // ── Authenticated mode ────────────────────────────────────────────────────
  return <AuthenticatedOrderView transactionId={transactionId} />;
}

function AuthenticatedOrderView({ transactionId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscribe } = useWebSocket();
  const { t } = useLang();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editQty, setEditQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // CR-040: inline notification for approve/reject events
  const [approvalEvent, setApprovalEvent]   = useState(null);
  const approvalTimerRef                    = useRef(null);
  const [partialModal, setPartialModal]     = useState(false);
  const [processing, setProcessing]         = useState(false);

  const fromApprovalSubmit = location.state?.fromApprovalSubmit ?? false;

  const expiresAt = order?.status === 'PENDING' ? order.expires_at : null;
  const { remaining, mins, secs } = useCountdown(expiresAt);
  const config  = usePublicConfig();
  const ppnRate = parseFloat(config?.ppn_rate) || 0;

  const fetchOrder = useCallback(() => {
    getOrder(transactionId)
      .then((r) => setOrder(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [transactionId]);

  function handleRefresh() {
    setRefreshing(true);
    getOrder(transactionId)
      .then((r) => setOrder(r.data.data))
      .finally(() => setRefreshing(false));
  }

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  useEffect(() => {
    return subscribe('PICKUP_DONE', (payload) => {
      if (payload.transactionId === transactionId) fetchOrder();
    });
  }, [transactionId, subscribe, fetchOrder]);

  // CR-036: listen for ORDER_RESERVED_FOR_CUSTOMER (customer online)
  useEffect(() => {
    return subscribe('ORDER_RESERVED_FOR_CUSTOMER', (data) => {
      if (data?.payload?.txnId === transactionId) fetchOrder();
    });
  }, [transactionId, subscribe, fetchOrder]);

  // CR-040: listen for ORDER_APPROVED / ORDER_REJECTED from helper
  useEffect(() => {
    const unsubApprove = subscribe('ORDER_APPROVED', (data) => {
      if (data?.transactionId !== transactionId) return;
      setApprovalEvent({ type: 'approved', expiresAt: data.expiresAt });
      fetchOrder();
      clearTimeout(approvalTimerRef.current);
      approvalTimerRef.current = setTimeout(() => setApprovalEvent(null), 10000);
    });
    const unsubReject = subscribe('ORDER_REJECTED', (data) => {
      if (data?.transactionId !== transactionId) return;
      setApprovalEvent({ type: 'rejected', reason: data.reason });
      fetchOrder();
      clearTimeout(approvalTimerRef.current);
      approvalTimerRef.current = setTimeout(() => setApprovalEvent(null), 10000);
    });
    const unsubPartial = subscribe('ORDER_PARTIAL_APPROVED', (data) => {
      if (data?.transactionId !== transactionId) return;
      fetchOrder();
    });
    return () => { unsubApprove(); unsubReject(); unsubPartial(); };
  }, [transactionId, subscribe, fetchOrder]);

  useEffect(() => () => clearTimeout(approvalTimerRef.current), []);

  function openEdit(item) {
    setEditItem(item);
    setEditQty(item.quantity);
  }

  async function handleSaveQty() {
    if (!editItem) return;
    setSaving(true);
    try {
      await updateOrderItem(transactionId, editItem.product_id, editQty);
      await fetchOrder();
      setEditItem(null);
    } finally { setSaving(false); }
  }

  async function handleDeleteItem() {
    if (!editItem) return;
    setDeleting(true);
    try {
      const res = await deleteOrderItem(transactionId, editItem.product_id);
      setDeleteConfirmModal(false);
      setEditItem(null);
      if (res.data?.data?.orderCancelled) {
        navigate('/pesanan');
      } else {
        await fetchOrder();
      }
    } finally { setDeleting(false); }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelOrder(transactionId);
      fetchOrder();
      setCancelModal(false);
    } finally { setCancelling(false); }
  }

  async function handlePartialProcess() {
    setProcessing(true);
    try {
      await partialProcessOrder(transactionId);
      setPartialModal(false);
      await fetchOrder();
    } finally {
      setProcessing(false);
    }
  }

  const groups = useMemo(() => groupByTenant(order?.items ?? []), [order?.items]);
  const hasAnyBoothApproved = order?.status === 'PENDING_APPROVAL' &&
    groups.some(g => g.items.every(i => i.approval_status === 'APPROVED'));

  if (loading) return <Spinner />;
  if (!order)  return <div className="p-4 text-center text-gray-500">{t('order.notFound')}</div>;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate('/pesanan')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
          {t('order.backHistory')}
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? t('order.refreshing') : t('order.refresh')}
        </button>
      </div>

      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm font-bold text-gray-900">{order.transaction_id}</p>
            <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
          </div>
          <Badge status={order.status} />
        </div>
        <p className="text-xl font-bold text-blue-700 mt-2">{formatRupiah(order.total_amount)}</p>
      </div>

      {/* CR-040: PENDING_APPROVAL banner */}
      {order.status === 'PENDING_APPROVAL' && (
        <div className="border-b px-4 py-5 text-center" style={{ background: 'rgba(236,253,245,0.8)' }}>
          {approvalEvent?.type === 'approved' ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">✅</span>
              <p className="text-emerald-700 font-bold text-base">Pesanan Disetujui!</p>
              <p className="text-sm text-emerald-600">Halaman akan memuat ulang…</p>
            </div>
          ) : approvalEvent?.type === 'rejected' ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">❌</span>
              <p className="text-red-700 font-bold text-base">Pesanan Ditolak</p>
              <p className="text-sm text-red-500">{approvalEvent.reason}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-3xl animate-pulse">
                🕐
              </div>
              <div>
                <p className="font-bold text-emerald-800 text-base">Menunggu Persetujuan Petugas</p>
                <p className="text-sm text-emerald-600 mt-1">
                  {fromApprovalSubmit
                    ? 'Pesanan Anda telah dikirim. Petugas booth akan segera mereview.'
                    : 'Pesanan ini menunggu review dari petugas booth.'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-xs text-emerald-700">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Anda akan mendapat notifikasi otomatis
              </div>
            </div>
          )}
        </div>
      )}

      {order.status === 'PENDING' && order.qr_payload && (
        <div className="bg-amber-50 border-b px-4 py-4 text-center">
          {approvalEvent?.type === 'approved' && (
            <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700 font-medium flex items-center gap-2 justify-center">
              <span>✅</span> Pesanan disetujui! Segera bayar sebelum waktu habis.
            </div>
          )}
          <p className="text-sm text-amber-700 font-medium mb-2">{t('order.showQR')}</p>
          <img
            src={`data:image/png;base64,${order.qr_payload}`}
            alt="QR Code"
            className="w-36 h-36 mx-auto border-2 border-amber-200 rounded-lg p-1"
          />
          <div className={`mt-3 rounded-lg px-4 py-2 text-sm font-medium ${remaining > 0 ? (mins < 5 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800') : 'bg-red-100 text-red-700'}`}>
            {remaining > 0
              ? t('checkout.payIn', { mins, secs: secs.toString().padStart(2, '0') })
              : t('checkout.expired')}
          </div>
        </div>
      )}

      <div className="divide-y">
        {groups.map((group) => {
          const allDone          = group.items.every((i) => i.pickup_status === 'DONE');
          const boothAllApproved = group.items.every(i => i.approval_status === 'APPROVED');
          const boothSubtotal    = group.items.reduce((sum, i) => sum + Number(i.subtotal), 0);

          let boothBadge;
          if (order.status === 'PENDING_APPROVAL') {
            boothBadge = boothAllApproved
              ? <Badge status="APPROVED" label="Disetujui" />
              : <Badge status="PENDING_APPROVAL" label="Menunggu" />;
          } else {
            boothBadge = <Badge status={allDone ? 'DONE' : order.status === 'PAID' ? 'PAID' : order.status} />;
          }

          return (
            <div key={group.tenant_id} className="bg-white px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-gray-800">{group.tenant_name}</p>
                  <p className="text-xs text-gray-400">{group.booth_location}</p>
                </div>
                {boothBadge}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.product_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">{item.product_name} × {item.quantity}</span>
                      {order.status === 'PENDING' && !order.approved_at && (
                        <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit jumlah">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <span className="text-gray-500">{formatRupiah(Math.round(item.unit_price * item.quantity * (1 + ppnRate / 100)))}</span>
                  </div>
                ))}
              </div>
              {order.status === 'PENDING_APPROVAL' && (
                <div className="flex justify-end mt-1.5 text-xs text-gray-500">
                  Subtotal: <span className="ml-1 font-medium text-gray-700">{formatRupiah(boothSubtotal)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(order.status === 'PAID' || order.status === 'DONE') && (
        <div className="p-4">
          <Button variant="primary" size="full" onClick={() => navigate(`/pesanan/${transactionId}/receipt`)}>
            {t('confirmed.cta')}
          </Button>
        </div>
      )}

      {hasAnyBoothApproved && (
        <div className="px-4 pt-4 pb-0">
          <Button variant="primary" size="full" onClick={() => setPartialModal(true)}>
            Proses Sekarang
          </Button>
        </div>
      )}

      {(order.status === 'PENDING' || order.status === 'PENDING_APPROVAL') && (
        <div className="p-4">
          <Button variant="danger" size="full" onClick={() => setCancelModal(true)}>
            {order.status === 'PENDING_APPROVAL' ? 'Batalkan Pesanan' : t('order.cancelBtn')}
          </Button>
        </div>
      )}

      <Modal open={!!editItem && !deleteConfirmModal} onClose={() => setEditItem(null)} title="Edit Jumlah">
        {editItem && (
          <>
            <p className="text-sm text-gray-600 mb-4">{editItem.product_name}</p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => { if (editQty === 1) { setEditQty(0); setDeleteConfirmModal(true); } else { setEditQty(q => q - 1); } }}
                className="w-10 h-10 rounded-full border border-gray-300 text-xl font-bold text-gray-600 hover:bg-gray-100 flex items-center justify-center disabled:opacity-40"
                disabled={editQty <= 0}
              >−</button>
              <span className="text-2xl font-bold w-10 text-center">{editQty}</span>
              <button onClick={() => setEditQty(q => q + 1)} className="w-10 h-10 rounded-full border border-gray-300 text-xl font-bold text-gray-600 hover:bg-gray-100 flex items-center justify-center">+</button>
            </div>
            <p className="text-center text-sm text-gray-500 mb-4">
              Subtotal: <span className="font-semibold text-gray-800">{formatRupiah(Math.round(editItem.unit_price * editQty * (1 + ppnRate / 100)))}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditItem(null)}>Batal</Button>
              <Button variant="primary" className="flex-1" loading={saving} onClick={handleSaveQty}>Simpan</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={deleteConfirmModal} onClose={() => { setDeleteConfirmModal(false); setEditQty(1); }} title="Hapus Item">
        <p className="text-sm text-gray-600 mb-4">
          Apakah anda yakin menghapus <span className="font-semibold">{editItem?.product_name}</span> dari pesanan ini?
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { setDeleteConfirmModal(false); setEditQty(1); }}>Tidak</Button>
          <Button variant="danger" className="flex-1" loading={deleting} onClick={handleDeleteItem}>Hapus</Button>
        </div>
      </Modal>

      <Modal open={cancelModal} onClose={() => setCancelModal(false)} title={t('order.cancelTitle')}>
        <p className="text-sm text-gray-600 mb-4">{t('order.cancelBody', { id: transactionId })}</p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setCancelModal(false)}>{t('order.cancelNo')}</Button>
          <Button variant="danger" className="flex-1" loading={cancelling} onClick={handleCancel}>{t('order.cancelYes')}</Button>
        </div>
      </Modal>

      <Modal open={partialModal} onClose={() => setPartialModal(false)} title="Lanjutkan Checkout Sebagian?">
        <p className="text-sm text-gray-500 mb-4">
          Sebagian barang belum mendapat konfirmasi ketersediaan stok dari booth.
        </p>
        {(() => {
          const approvedGroups = groups.filter(g => g.items.every(i => i.approval_status === 'APPROVED'));
          const pendingGroups  = groups.filter(g => g.items.some(i => i.approval_status !== 'APPROVED'));
          const checkoutTotal  = approvedGroups.reduce((sum, g) =>
            sum + g.items.reduce((s, i) => s + Number(i.subtotal), 0), 0);
          return (
            <>
              {approvedGroups.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Barang yang siap diproses</p>
                  {approvedGroups.map(g => (
                    <div key={g.tenant_id} className="mb-2">
                      <p className="text-sm font-medium text-emerald-700">✅ {g.tenant_name}</p>
                      {g.items.map(i => (
                        <div key={i.product_id} className="flex justify-between text-xs text-gray-600 pl-4 py-0.5">
                          <span>{i.product_name} × {i.quantity}</span>
                          <span>{formatRupiah(Number(i.subtotal))}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {pendingGroups.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Barang yang akan disimpan ke Wishlist</p>
                  {pendingGroups.map(g => (
                    <div key={g.tenant_id} className="mb-2">
                      <p className="text-sm font-medium text-amber-700">⏳ {g.tenant_name}</p>
                      {g.items.filter(i => i.approval_status !== 'APPROVED').map(i => (
                        <div key={i.product_id} className="flex justify-between text-xs text-gray-600 pl-4 py-0.5">
                          <span>{i.product_name} × {i.quantity}</span>
                          <span>{formatRupiah(Number(i.subtotal))}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t pt-3 flex justify-between text-sm font-semibold text-gray-800 mb-4">
                <span>Total checkout:</span>
                <span className="text-blue-700">{formatRupiah(checkoutTotal)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setPartialModal(false)}>Kembali</Button>
                <Button variant="primary" className="flex-1" loading={processing} onClick={handlePartialProcess}>
                  Ya, Lanjutkan Checkout
                </Button>
              </div>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}
