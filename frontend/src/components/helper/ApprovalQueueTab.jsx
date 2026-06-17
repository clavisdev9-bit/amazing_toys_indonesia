import { useState, useEffect, useCallback, memo } from 'react';
import { getApprovalQueue, approveOrder, rejectOrder, approveItem, rejectItem } from '../../api/helper';
import { formatRupiah, formatDate } from '../../utils/format';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useLang } from '../../context/LangContext';

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
  const { t } = useLang();
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
      onError(err.response?.data?.message || t('approval.itemApproveErr'));
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
      onError(err.response?.data?.message || t('approval.itemRejectErr'));
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
          {item.is_preorder && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 flex-shrink-0">
              🔖 PRE-ORDER
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
        <div className="flex gap-1 flex-shrink-0">
          <button
            disabled={busy}
            onClick={() => { setApprovedQty(String(item.quantity)); setShowApproveModal(true); }}
            className="px-2 py-1 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
          >
            {busy ? '...' : '✓'}
          </button>
          <button
            disabled={busy}
            onClick={() => { setRejectReason(''); setShowRejectModal(true); }}
            className="px-2 py-1 text-xs font-semibold rounded-md bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      )}

      {/* Status badge when resolved */}
      {!isPending && (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0
          ${isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
          {isApproved ? t('approval.itemApproved') : t('approval.itemRejected')}
        </span>
      )}

      {/* Approve modal — with qty adjustment */}
      <Modal open={showApproveModal} onClose={() => setShowApproveModal(false)} title={t('approval.itemApproveTitle')}>
        <p className="text-sm text-gray-600 mb-3">
          <span className="font-semibold">{item.product_name}</span>{' '}
          — {t('approval.orderedQty', { qty: item.quantity })}
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('approval.qtyLabel')}
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
          <span className="text-xs text-gray-400">{t('approval.qtyFrom', { n: item.quantity })}</span>
        </div>
        {approvedQtyNum < item.quantity && (
          <p className="text-xs text-amber-600 mb-3">
            {t('approval.qtyPartialWarn', { n: item.quantity - approvedQtyNum })}
          </p>
        )}
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" className="flex-1" onClick={() => setShowApproveModal(false)}>
            {t('approval.cancelBtn')}
          </Button>
          <Button variant="primary" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleApproveConfirm}>
            {t('approval.approveItemBtn', { qty: approvedQtyNum })}
          </Button>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)} title={t('approval.itemRejectTitle')}>
        <p className="text-sm text-gray-600 mb-3">
          {t('approval.itemRejectTitle')} <span className="font-semibold">{item.product_name}</span> ×{item.quantity}?
        </p>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          rows={3}
          placeholder={t('approval.rejectReasonPh')}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" className="flex-1" onClick={() => setShowRejectModal(false)}>
            {t('approval.cancelBtn')}
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleRejectConfirm}>
            {t('approval.rejectItemBtn')}
          </Button>
        </div>
      </Modal>
    </div>
  );
});

// ── Approval card ─────────────────────────────────────────────────────────────

const ApprovalCard = memo(function ApprovalCard({ txn, onApproveAll, onRejectAll, approvingAll, rejectingAll, onRefresh }) {
  const { t } = useLang();
  const [showRejectAllModal,  setShowRejectAllModal]  = useState(false);
  const [rejectAllReason,    setRejectAllReason]      = useState('');
  const [showApproveAllModal, setShowApproveAllModal] = useState(false);
  const [toast, setToast]                             = useState(null);
  const isPreorder = txn.order_type === 'PREORDER';
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
          {allResolved ? t('approval.allResolved') : t('approval.pendingCount', { n: pendingCount })}
        </span>
      </div>

      {/* Customer */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">👤</span>
          <div>
            <p className="text-sm font-medium text-gray-800">{txn.customer_name || t('approval.unknownCustomer')}</p>
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

      {/* Local toast */}
      {toast && (
        <div className={`mx-4 mb-2 px-3 py-2 rounded-lg text-xs font-medium text-white
          ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-gray-50">
        <span className="text-sm text-gray-500">{t('approval.totalEstimate')}</span>
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
            {t('approval.rejectAllBtn')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            loading={approvingAll}
            disabled={rejectingAll}
            onClick={() => setShowApproveAllModal(true)}
          >
            {t('approval.approveAllBtn')}
          </Button>
        </div>
      )}

      {/* Approve all confirmation modal */}
      <Modal
        open={showApproveAllModal}
        onClose={() => setShowApproveAllModal(false)}
        title={t(isPreorder ? 'approval.approveAllPreTitle' : 'approval.approveAllTitle')}
      >
        <p className="text-sm text-gray-600 mb-4">
          {t('approval.approveAllBody', { id: txn.transaction_id })}
        </p>
        {isPreorder && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-bold text-orange-700 mb-2">{t('approval.shippingTitle')}</p>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder={t('approval.shippingNamePh')} value={shippingName} onChange={e => setShippingName(e.target.value)} />
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder={t('approval.shippingPhonePh')} value={shippingPhone} onChange={e => setShippingPhone(e.target.value)} />
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              rows={2} placeholder={t('approval.shippingAddressPh')} value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} />
            <div className="flex gap-2">
              <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder={t('approval.shippingCityPh')} value={shippingCity} onChange={e => setShippingCity(e.target.value)} />
              <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder={t('approval.shippingProvincePh')} value={shippingProvince} onChange={e => setShippingProvince(e.target.value)} />
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setShowApproveAllModal(false)}>
            {t('approval.cancelBtn')}
          </Button>
          <Button
            variant="primary"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            loading={approvingAll}
            disabled={isPreorder && (!shippingName.trim() || !shippingPhone.trim() || !shippingAddress.trim())}
            onClick={() => {
              const sf = isPreorder ? {
                shipping_name: shippingName, shipping_phone: shippingPhone,
                shipping_address: shippingAddress, shipping_city: shippingCity,
                shipping_province: shippingProvince,
              } : null;
              onApproveAll(txn.transaction_id, sf);
              setShowApproveAllModal(false);
            }}
          >
            {t('approval.approveConfirmBtn')}
          </Button>
        </div>
      </Modal>

      {/* Reject all modal */}
      <Modal open={showRejectAllModal} onClose={() => setShowRejectAllModal(false)} title={t('approval.rejectAllTitle')}>
        <p className="text-sm text-gray-600 mb-3">
          {t('approval.rejectAllBody', { id: txn.transaction_id })}
        </p>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          rows={3}
          placeholder={t('approval.rejectAllReasonPh')}
          value={rejectAllReason}
          onChange={(e) => setRejectAllReason(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" className="flex-1" onClick={() => { setShowRejectAllModal(false); setRejectAllReason(''); }}>
            {t('approval.cancelBtn')}
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
            {t('approval.rejectAllBtn')}
          </Button>
        </div>
      </Modal>
    </div>
  );
});

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function ApprovalQueueTab({ onCountChange }) {
  const { t } = useLang();
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
            ? t('approval.loadFail500')
            : msg || t('approval.loadFailGeneral')
        );
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [onCountChange, t]);

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
      const updated = prev.filter((tx) => tx.transaction_id !== txnId);
      onCountChange?.(updated.length);
      return updated;
    });
  }

  async function handleApproveAll(txnId, shippingFields = null) {
    setApprovingId(txnId);
    try {
      await approveOrder(txnId, null, shippingFields);
      removeFromQueue(txnId);
      showToast(t('approval.approveOkToast'));
      fetchQueue(true);
    } catch (err) {
      showToast(err.response?.data?.message || t('approval.approveErrToast'), 'error');
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRejectAll(txnId, reason) {
    setRejectingId(txnId);
    try {
      await rejectOrder(txnId, reason);
      removeFromQueue(txnId);
      showToast(t('approval.rejectOkToast'));
      fetchQueue(true);
    } catch (err) {
      showToast(err.response?.data?.message || t('approval.rejectErrToast'), 'error');
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
            <h2 className="text-sm font-bold text-gray-800">{t('approval.queueTitle')}</h2>
            {/* Pulsing dot — auto-refresh active indicator */}
            <span className="relative flex h-2 w-2" title={t('approval.autoRefreshHint')}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
          <p className="text-xs text-gray-400">
            {t('approval.queueSubtitle')}
            {lastRefreshedStr && (
              <span className="ml-2 text-gray-300">
                · {t('approval.updatedAt', { time: lastRefreshedStr })}
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
          {t('approval.refresh')}
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs text-gray-400">
        <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"/>{t('approval.legend.waiting')}</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"/>{t('approval.legend.approved')}</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1"/>{t('approval.legend.rejected')}</span>
      </div>

      {/* API error banner */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-semibold text-red-700">{t('approval.loadFail')}</p>
            <p className="text-xs text-red-600 mt-0.5">{fetchError}</p>
            <button
              onClick={() => fetchQueue(false)}
              className="mt-2 text-xs text-red-700 underline hover:no-underline"
            >
              {t('approval.retry')}
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
          <p className="font-semibold text-gray-700">{t('approval.emptyTitle')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('approval.emptyDesc')}</p>
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
