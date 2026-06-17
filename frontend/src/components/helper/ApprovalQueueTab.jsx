import { useState, useEffect, useCallback, memo } from 'react';
import { getApprovalQueue, approveOrder, rejectOrder, approveItem, rejectItem } from '../../api/helper';
import { formatRupiah, formatDate } from '../../utils/format';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import { useWebSocket } from '../../hooks/useWebSocket';

// ── Smart merge helpers ────────────────────────────────────────────────────────
// Preserve unchanged object references so React's Virtual DOM diffing can skip
// subtrees that haven't changed — no blink, no unnecessary re-render.

function mergeItems(prevItems, nextItems) {
  if (!prevItems?.length) return nextItems;
  const prevMap = new Map(prevItems.map(i => [i.item_id, i]));
  return nextItems.map(i => {
    const old = prevMap.get(i.item_id);
    if (!old) return i;
    if (
      old.approval_status   === i.approval_status   &&
      old.approved_quantity === i.approved_quantity &&
      old.rejection_reason  === i.rejection_reason  &&
      old.quantity          === i.quantity
    ) return old; // same ref → React bails out of subtree re-render
    return i;
  });
}

function mergeQueue(prev, next) {
  const prevMap = new Map(prev.map(t => [t.transaction_id, t]));
  return next.map(t => {
    const old = prevMap.get(t.transaction_id);
    if (!old) return t;
    const mergedItems = mergeItems(old.items, t.items ?? []);
    const itemsUnchanged =
      mergedItems.length === (old.items ?? []).length &&
      mergedItems.every((it, idx) => it === (old.items ?? [])[idx]);
    if (itemsUnchanged && old.total_amount === t.total_amount) return old;
    return { ...t, items: mergedItems };
  });
}

// ── Per-item row ──────────────────────────────────────────────────────────────

const ItemRow = memo(function ItemRow({ txnId, item, onItemUpdated, onError }) {
  const [status, setStatus]           = useState(item.approval_status);
  const [busy, setBusy]               = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal]   = useState(false);
  const [approvedQty, setApprovedQty] = useState(String(item.quantity));
  const approvedQtyNum = Math.min(item.quantity, Math.max(1, parseInt(approvedQty, 10) || 1));
  const [rejectReason, setRejectReason] = useState('');

  // Sync when parent receives updated data from server
  useEffect(() => { setStatus(item.approval_status); }, [item.approval_status]);

  async function handleApproveConfirm() {
    setBusy(true);
    setShowApproveModal(false);
    try {
      const qty = approvedQtyNum < item.quantity ? approvedQtyNum : null;
      await approveItem(txnId, item.item_id, qty);
      setStatus('APPROVED');
      onItemUpdated();
    } catch (err) {
      onError(err.response?.data?.message || 'Gagal menyetujui item.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectConfirm() {
    setBusy(true);
    setShowRejectModal(false);
    try {
      await rejectItem(txnId, item.item_id, rejectReason || null);
      setStatus('REJECTED');
      setRejectReason('');
      onItemUpdated();
    } catch (err) {
      onError(err.response?.data?.message || 'Gagal menolak item.');
    } finally {
      setBusy(false);
    }
  }

  const isPending  = status === 'PENDING';
  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';

  const effectiveQty = isApproved && item.approved_quantity != null
    ? item.approved_quantity
    : item.quantity;

  return (
    <div className={`flex items-center gap-2 py-2 px-3 rounded-lg text-sm
      ${isApproved ? 'bg-emerald-50' : isRejected ? 'bg-red-50 line-through opacity-60' : 'bg-gray-50'}`}
    >
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0
        ${isApproved ? 'bg-emerald-500' : isRejected ? 'bg-red-400' : 'bg-amber-400'}`}
      />

      {/* Product name + qty */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-gray-800 font-medium truncate">{item.product_name}</span>
          {item.is_preorder ? (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 flex-shrink-0">
              🔖 PRE-ORDER
            </span>
          ) : (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">
              REGULER
            </span>
          )}
        </div>
        <span className="text-gray-400 text-xs">
          {isApproved && item.approved_quantity != null && item.approved_quantity < item.quantity
            ? <><span className="line-through mr-1">×{item.quantity}</span><span className="text-emerald-600 font-semibold">×{item.approved_quantity}</span></>
            : `×${effectiveQty}`
          }
          {isRejected && item.rejection_reason && (
            <span className="ml-1 text-red-400 italic">— {item.rejection_reason}</span>
          )}
        </span>
      </div>

      {/* Subtotal */}
      <span className="text-gray-500 tabular-nums text-xs flex-shrink-0">
        {formatRupiah(item.unit_price * effectiveQty)}
      </span>

      {/* Action buttons — only when PENDING */}
      {isPending && (
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            disabled={busy}
            onClick={() => { setApprovedQty(String(item.quantity)); setShowApproveModal(true); }}
            className="w-9 h-9 flex items-center justify-center text-base font-bold rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:bg-emerald-300 disabled:opacity-50"
          >
            {busy ? <span className="text-xs">...</span> : '✓'}
          </button>
          <button
            disabled={busy}
            onClick={() => { setRejectReason(''); setShowRejectModal(true); }}
            className="w-9 h-9 flex items-center justify-center text-base font-bold rounded-lg bg-red-100 text-red-600 hover:bg-red-200 active:bg-red-300 disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      )}

      {/* Status badge when resolved */}
      {!isPending && (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0
          ${isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
          {isApproved ? 'Disetujui' : 'Ditolak'}
        </span>
      )}

      {/* Approve modal — with qty adjustment */}
      <Modal open={showApproveModal} onClose={() => setShowApproveModal(false)} title="Setujui Item">
        <p className="text-sm text-gray-600 mb-3">
          <span className="font-semibold">{item.product_name}</span> — qty dipesan:{' '}
          <span className="font-bold">{item.quantity} pcs</span>
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Qty yang disetujui
        </label>
        <div className="flex items-center gap-2 mb-1">
          <input
            type="number"
            min={1}
            max={item.quantity}
            value={approvedQty}
            onChange={(e) => setApprovedQty(e.target.value)}
            onBlur={() => setApprovedQty(String(approvedQtyNum))}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <span className="text-xs text-gray-400">dari {item.quantity} pcs</span>
        </div>
        {approvedQtyNum < item.quantity && (
          <p className="text-xs text-amber-600 mb-3">
            ⚠ {item.quantity - approvedQtyNum} pcs tidak akan disetujui (misal: cacat/kurang stok)
          </p>
        )}
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" className="flex-1" onClick={() => setShowApproveModal(false)}>Batal</Button>
          <Button variant="primary" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleApproveConfirm}>
            ✓ Setujui {approvedQtyNum} pcs
          </Button>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)} title="Tolak Item">
        <p className="text-sm text-gray-600 mb-3">
          Tolak <span className="font-semibold">{item.product_name}</span> ×{item.quantity}?
        </p>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          rows={3}
          placeholder="Alasan penolakan (opsional): stok habis, barang cacat, dibatalkan customer, dsb..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" className="flex-1" onClick={() => setShowRejectModal(false)}>Batal</Button>
          <Button variant="danger" className="flex-1" onClick={handleRejectConfirm}>Tolak Item</Button>
        </div>
      </Modal>
    </div>
  );
});

// ── Approval card ─────────────────────────────────────────────────────────────

const ApprovalCard = memo(function ApprovalCard({ txn, onApproveAll, onRejectAll, approvingAll, rejectingAll, onRefresh }) {
  const [showRejectAllModal,  setShowRejectAllModal]  = useState(false);
  const [rejectAllReason,    setRejectAllReason]      = useState('');
  const [showApproveAllModal, setShowApproveAllModal] = useState(false);
  const [toast, setToast]                             = useState(null);
  const [mixedChecked, setMixedChecked]               = useState(false);
  const isPreorder    = txn.order_type === 'PREORDER';
  const hasMixedCart  = txn.items?.some(i => i.is_preorder) && txn.items?.some(i => !i.is_preorder);
  // CR2: Shipping form pre-filled from customer registration data + event default address
  const [shippingName,     setShippingName]     = useState(txn.customer_name  || '');
  const [shippingPhone,    setShippingPhone]    = useState(txn.customer_phone || '');
  const [shippingAddress,  setShippingAddress]  = useState('Event Amazing Toy Show Gandaria City');
  const [shippingCity,     setShippingCity]     = useState('');
  const [shippingProvince, setShippingProvince] = useState('');

  function showLocalToast(msg, type = 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const allResolved  = txn.items?.every(i => i.approval_status !== 'PENDING');
  const pendingCount = txn.items?.filter(i => i.approval_status === 'PENDING').length ?? 0;

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isPreorder ? 'bg-orange-50' : 'bg-emerald-50'}`}>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-bold text-gray-900">{txn.transaction_id}</p>
            {isPreorder && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                🔖 PRE-ORDER
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">{formatDate(txn.created_at)}</p>
        </div>
        <span className={`text-xs font-semibold border rounded-full px-2.5 py-1
          ${allResolved ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
          {allResolved ? '✓ Menunggu booth lain' : `⏳ ${pendingCount} item menunggu`}
        </span>
      </div>

      {/* Customer */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">👤</span>
          <div>
            <p className="text-sm font-medium text-gray-800">{txn.customer_name || 'Customer tidak diketahui'}</p>
            {txn.customer_phone && <p className="text-xs text-gray-400">{txn.customer_phone}</p>}
          </div>
        </div>
      </div>

      {/* Per-item list */}
      <div className="px-4 pb-2 space-y-1.5">
        {txn.items?.map((item) => (
          <ItemRow
            key={item.item_id}
            txnId={txn.transaction_id}
            item={item}
            onItemUpdated={onRefresh}
            onError={showLocalToast}
          />
        ))}
      </div>

      {/* Mixed cart warning */}
      {hasMixedCart && (
        <div className="mx-4 mb-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-300 flex items-start gap-2">
          <span className="text-red-500 text-sm leading-none mt-0.5 flex-shrink-0">⚠</span>
          <div>
            <p className="text-xs font-bold text-red-700">Anomali: Campuran PRE-ORDER &amp; REGULER</p>
            <p className="text-xs text-red-600 mt-0.5">Order ini mengandung kedua tipe item. Laporkan ke admin sebelum menyetujui.</p>
          </div>
        </div>
      )}

      {/* Local toast */}
      {toast && (
        <div className={`mx-4 mb-2 px-3 py-2 rounded-lg text-xs font-medium text-white
          ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-gray-50">
        <span className="text-sm text-gray-500">Total (estimasi)</span>
        <span className="font-bold text-base text-emerald-700">{formatRupiah(txn.total_amount)}</span>
      </div>

      {/* Bulk actions — only shown when there are still pending items */}
      {!allResolved && (
        <div className="flex gap-2 px-4 py-3 border-t bg-gray-50">
          <Button
            variant="danger"
            size="sm"
            className="flex-1"
            loading={rejectingAll}
            disabled={approvingAll}
            onClick={() => setShowRejectAllModal(true)}
          >
            Tolak Semua
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            loading={approvingAll}
            disabled={rejectingAll}
            onClick={() => setShowApproveAllModal(true)}
          >
            ✓ Setujui Semua
          </Button>
        </div>
      )}

      {/* Approve all confirmation modal */}
      <Modal open={showApproveAllModal} onClose={() => { setShowApproveAllModal(false); setMixedChecked(false); }} title={isPreorder ? 'Setujui Pre-Order' : 'Konfirmasi Setujui Semua'}>
        <p className="text-sm text-gray-600 mb-4">
          Apakah anda yakin menyetujui transaksi{' '}
          <span className="font-mono font-semibold">{txn.transaction_id}</span>?
        </p>
        {isPreorder && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-bold text-orange-700 mb-2">🔖 Data Pengiriman Pre-Order (wajib diisi)</p>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Nama penerima *" value={shippingName} onChange={e => setShippingName(e.target.value)} />
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="No. HP penerima *" value={shippingPhone} onChange={e => setShippingPhone(e.target.value)} />
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              rows={2} placeholder="Alamat lengkap *" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} />
            <div className="flex gap-2">
              <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Kota" value={shippingCity} onChange={e => setShippingCity(e.target.value)} />
              <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Provinsi" value={shippingProvince} onChange={e => setShippingProvince(e.target.value)} />
            </div>
          </div>
        )}
        {hasMixedCart && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-300">
            <p className="text-xs font-bold text-red-700 mb-2">⚠ Anomali Terdeteksi: Campuran PRE-ORDER &amp; REGULER</p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mixedChecked}
                onChange={e => setMixedChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500 flex-shrink-0"
              />
              <span className="text-xs text-red-700">Saya sudah periksa tipe barang dan memahami risiko menyetujui order campuran ini.</span>
            </label>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { setShowApproveAllModal(false); setMixedChecked(false); }}>
            Batal
          </Button>
          <Button
            variant="primary"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            loading={approvingAll}
            disabled={
              (isPreorder && (!shippingName.trim() || !shippingPhone.trim() || !shippingAddress.trim())) ||
              (hasMixedCart && !mixedChecked)
            }
            onClick={() => {
              const sf = isPreorder ? {
                shipping_name: shippingName, shipping_phone: shippingPhone,
                shipping_address: shippingAddress, shipping_city: shippingCity,
                shipping_province: shippingProvince,
              } : null;
              onApproveAll(txn.transaction_id, sf);
              setShowApproveAllModal(false);
              setMixedChecked(false);
            }}
          >
            Ya, Setujui
          </Button>
        </div>
      </Modal>

      {/* Reject all modal */}
      <Modal open={showRejectAllModal} onClose={() => setShowRejectAllModal(false)} title="Tolak Semua Item">
        <p className="text-sm text-gray-600 mb-3">
          Tolak <strong>semua item pending</strong> dari pesanan{' '}
          <span className="font-mono font-semibold">{txn.transaction_id}</span>?
        </p>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          rows={3}
          placeholder="Alasan penolakan (opsional)..."
          value={rejectAllReason}
          onChange={(e) => setRejectAllReason(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" className="flex-1" onClick={() => { setShowRejectAllModal(false); setRejectAllReason(''); }}>
            Batal
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={rejectingAll}
            onClick={() => {
              onRejectAll(txn.transaction_id, rejectAllReason || undefined);
              setShowRejectAllModal(false);
              setRejectAllReason('');
            }}
          >
            Tolak Semua
          </Button>
        </div>
      </Modal>
    </div>
  );
});

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function ApprovalQueueTab({ onCountChange }) {
  const [queue, setQueue]             = useState([]);
  const [loading, setLoading]         = useState(true);   // initial load only
  const [refreshing, setRefreshing]   = useState(false);  // silent background tick
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [fetchError, setFetchError]   = useState(null);   // API error message or null
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [toast, setToast]             = useState(null);
  const { subscribe }                 = useWebSocket();

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  /**
   * silent=true  → background poll / WS push — no spinner, no flicker
   * silent=false → initial load or manual refresh button
   */
  const fetchQueue = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else         setRefreshing(true);

    getApprovalQueue()
      .then((r) => {
        const data = r.data.data ?? [];
        // Smart merge: only swap items whose data actually changed.
        // Unchanged references let React skip those subtrees entirely.
        setQueue((prev) => mergeQueue(prev, data));
        onCountChange?.(data.length);
        setLastRefreshed(new Date());
        setFetchError(null);
      })
      .catch((err) => {
        const status = err.response?.status;
        const msg    = err.response?.data?.message;
        setFetchError(
          status === 500
            ? 'Gagal memuat antrian (server error 500). Pastikan migration database 015 dan 017 sudah diaplikasikan.'
            : msg || 'Gagal memuat antrian. Periksa koneksi atau coba refresh.'
        );
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [onCountChange]);

  // Initial load
  useEffect(() => { fetchQueue(false); }, [fetchQueue]);

  // Background polling every 20 s — silent so cards never blink
  useEffect(() => {
    const id = setInterval(() => fetchQueue(true), 20_000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  // WebSocket real-time push — also silent
  useEffect(() => {
    return subscribe('APPROVAL_QUEUE_UPDATE', () => fetchQueue(true));
  }, [subscribe, fetchQueue]);

  function removeFromQueue(txnId) {
    setQueue((prev) => {
      const updated = prev.filter((t) => t.transaction_id !== txnId);
      onCountChange?.(updated.length);
      return updated;
    });
  }

  async function handleApproveAll(txnId, shippingFields = null) {
    setApprovingId(txnId);
    try {
      await approveOrder(txnId, null, shippingFields);
      removeFromQueue(txnId);
      showToast('Semua item disetujui. Stok dikurangi dan timer dimulai.');
      fetchQueue(true);
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal menyetujui pesanan.', 'error');
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRejectAll(txnId, reason) {
    setRejectingId(txnId);
    try {
      await rejectOrder(txnId, reason);
      removeFromQueue(txnId);
      showToast('Pesanan ditolak.');
      fetchQueue(true);
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal menolak pesanan.', 'error');
    } finally {
      setRejectingId(null);
    }
  }

  // Format last-refreshed time as HH:MM:SS
  const lastRefreshedStr = lastRefreshed
    ? lastRefreshed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="space-y-4">
      {/* Global toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white
          ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}
          style={{ transform: 'translateX(-50%)', minWidth: '220px', textAlign: 'center' }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-800">Antrian Persetujuan</h2>
            {/* Pulsing dot — auto-refresh active indicator */}
            <span className="relative flex h-2 w-2" title="Auto-refresh aktif setiap 20 detik">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Setujui atau tolak item satu per satu
            {lastRefreshedStr && (
              <span className="ml-2 text-gray-300">
                · diperbarui {lastRefreshedStr}
                {refreshing && <span className="ml-1 text-emerald-400">↻</span>}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchQueue(false)}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs text-gray-400">
        <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"/>Menunggu</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"/>Disetujui</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1"/>Ditolak</span>
      </div>

      {/* API error banner */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Gagal memuat antrian</p>
            <p className="text-xs text-red-600 mt-0.5">{fetchError}</p>
            <button
              onClick={() => fetchQueue(false)}
              className="mt-2 text-xs text-red-700 underline hover:no-underline"
            >
              Coba lagi
            </button>
          </div>
        </div>
      )}

      {/* List — spinner only on true initial load (empty queue + loading) */}
      {loading && queue.length === 0 ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : queue.length === 0 && !fetchError ? (
        <div className="flex flex-col items-center py-12 text-center">
          <span className="text-5xl mb-3">✅</span>
          <p className="font-semibold text-gray-700">Antrian kosong</p>
          <p className="text-sm text-gray-400 mt-1">Tidak ada pesanan yang menunggu persetujuan.</p>
        </div>
      ) : queue.length > 0 ? (
        queue.map((txn) => (
          <ApprovalCard
            key={txn.transaction_id}
            txn={txn}
            approvingAll={approvingId === txn.transaction_id}
            rejectingAll={rejectingId === txn.transaction_id}
            onApproveAll={handleApproveAll}
            onRejectAll={handleRejectAll}
            onRefresh={() => fetchQueue(true)}
          />
        ))
      ) : null}
    </div>
  );
}
