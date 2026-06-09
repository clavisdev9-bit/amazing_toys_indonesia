import { useState, useEffect, useCallback } from 'react';
import { getApprovalQueue, approveOrder, rejectOrder } from '../../api/helper';
import { formatRupiah, formatDate } from '../../utils/format';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Modal from '../ui/Modal';
import { useWebSocket } from '../../hooks/useWebSocket';

function ApprovalCard({ txn, onApprove, onReject, approving, rejecting }) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-emerald-50">
        <div>
          <p className="font-mono text-sm font-bold text-gray-900">{txn.transaction_id}</p>
          <p className="text-xs text-gray-400">{formatDate(txn.created_at)}</p>
        </div>
        <span className="text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
          ⏳ Menunggu Approval
        </span>
      </div>

      {/* Customer info */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">👤</span>
          <div>
            <p className="text-sm font-medium text-gray-800">
              {txn.customer_name || 'Customer tidak diketahui'}
            </p>
            {txn.customer_phone && (
              <p className="text-xs text-gray-400">{txn.customer_phone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 pb-2 space-y-1">
        {txn.items?.map((item) => (
          <div key={item.product_id} className="flex justify-between text-sm">
            <span className="text-gray-700">{item.product_name} <span className="text-gray-400">×{item.quantity}</span></span>
            <span className="text-gray-500 tabular-nums">{formatRupiah(item.subtotal)}</span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-gray-50">
        <span className="text-sm text-gray-500">Total</span>
        <span className="font-bold text-base text-emerald-700">{formatRupiah(txn.total_amount)}</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-4 py-3 border-t">
        <Button
          variant="danger"
          size="sm"
          className="flex-1"
          loading={rejecting}
          disabled={approving}
          onClick={() => setShowRejectModal(true)}
        >
          Tolak
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          loading={approving}
          disabled={rejecting}
          onClick={() => onApprove(txn.transaction_id)}
        >
          ✓ Setujui
        </Button>
      </div>

      {/* Reject modal */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Tolak Pesanan"
      >
        <p className="text-sm text-gray-600 mb-3">
          Berikan alasan penolakan untuk pesanan <span className="font-mono font-semibold">{txn.transaction_id}</span>:
        </p>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          rows={3}
          placeholder="Contoh: Stok habis, produk rusak, dsb..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={rejecting}
            onClick={() => {
              onReject(txn.transaction_id, rejectReason || undefined);
              setShowRejectModal(false);
              setRejectReason('');
            }}
          >
            Tolak Pesanan
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function ApprovalQueueTab({ onCountChange }) {
  const [queue, setQueue]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [toast, setToast]       = useState(null);
  const { subscribe }           = useWebSocket();

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchQueue = useCallback(() => {
    setLoading(true);
    getApprovalQueue()
      .then((r) => {
        const data = r.data.data ?? [];
        setQueue(data);
        onCountChange?.(data.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [onCountChange]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Auto-refresh every 20s in case WS misses an event
  useEffect(() => {
    const id = setInterval(fetchQueue, 20_000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  // Real-time: refresh when another helper (other booth) acts on the queue
  useEffect(() => {
    return subscribe('APPROVAL_QUEUE_UPDATE', fetchQueue);
  }, [subscribe, fetchQueue]);

  function removeFromQueue(txnId) {
    setQueue((prev) => {
      const updated = prev.filter((t) => t.transaction_id !== txnId);
      onCountChange?.(updated.length);
      return updated;
    });
  }

  async function handleApprove(txnId) {
    setApprovingId(txnId);
    try {
      await approveOrder(txnId);
      removeFromQueue(txnId);
      showToast('Pesanan disetujui. Stok dikurangi dan timer dimulai.');
      fetchQueue();
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal menyetujui pesanan.', 'error');
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(txnId, reason) {
    setRejectingId(txnId);
    try {
      await rejectOrder(txnId, reason);
      removeFromQueue(txnId);
      showToast('Pesanan ditolak.');
      fetchQueue();
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal menolak pesanan.', 'error');
    } finally {
      setRejectingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
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
          <h2 className="text-sm font-bold text-gray-800">Antrian Persetujuan</h2>
          <p className="text-xs text-gray-400">Pesanan customer menunggu review Anda</p>
        </div>
        <button
          onClick={fetchQueue}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {loading && queue.length === 0 ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : queue.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <span className="text-5xl mb-3">✅</span>
          <p className="font-semibold text-gray-700">Antrian kosong</p>
          <p className="text-sm text-gray-400 mt-1">Tidak ada pesanan yang menunggu persetujuan.</p>
        </div>
      ) : (
        queue.map((txn) => (
          <ApprovalCard
            key={txn.transaction_id}
            txn={txn}
            approving={approvingId === txn.transaction_id}
            rejecting={rejectingId === txn.transaction_id}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))
      )}
    </div>
  );
}
