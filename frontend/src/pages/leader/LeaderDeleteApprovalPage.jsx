import React, { useState, useEffect, useCallback } from 'react';
import { getDeleteRequests, reviewDeleteRequest } from '../../api/leader';
import { formatRupiah } from '../../utils/format';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import Spinner from '../../components/ui/Spinner';

function RequestCard({ request, onDecision }) {
  const [reason, setReason]       = useState('');
  const [showReason, setShowReason] = useState(false);
  const [loading, setLoading]     = useState(null); // 'approve' | 'reject' | null

  async function handleAction(action) {
    if (action === 'reject' && !showReason) {
      setShowReason(true);
      return;
    }
    setLoading(action);
    try {
      await onDecision(request.request_id, action, reason || undefined);
    } finally {
      setLoading(null);
    }
  }

  const subtotal = parseFloat(request.subtotal ?? 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{request.product_name}</p>
          {request.transaction_id && (
            <p className="text-[10px] font-mono text-gray-400 mt-0.5">{request.transaction_id}</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
          PENDING
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Qty</span>
          <span className="font-semibold text-gray-800">×{request.qty}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Subtotal</span>
          <span className="font-semibold text-gray-800">{formatRupiah(subtotal)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Kasir</span>
          <span className="font-medium text-gray-700">{request.cashier_name}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Waktu</span>
          <span className="text-gray-400">
            {new Date(request.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Rejection reason input */}
      {showReason && (
        <div className="px-4 pb-3">
          <input
            type="text"
            placeholder="Alasan penolakan (opsional)..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
            autoFocus
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={() => handleAction('approve')}
          disabled={loading !== null}
          className="flex-1 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {loading === 'approve' ? <Spinner className="w-3 h-3" /> : '✓'} Setujui
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={loading !== null}
          className="flex-1 py-2 rounded-lg text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {loading === 'reject' ? <Spinner className="w-3 h-3" /> : '✕'} Tolak
        </button>
      </div>
    </div>
  );
}

export default function LeaderDeleteApprovalPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const { subscribe }           = useWebSocket();
  const { toasts, addToast, removeToast } = useToast();

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    getDeleteRequests({ status: 'PENDING' })
      .then(r => setRequests(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: new delete request arrives
  useEffect(() => {
    return subscribe('delete_request:new', (msg) => {
      const req = msg.data ?? msg;
      setRequests(prev => {
        if (prev.some(r => r.request_id === req.request_id)) return prev;
        return [req, ...prev];
      });
    });
  }, [subscribe]);

  async function handleDecision(requestId, action, reason) {
    try {
      await reviewDeleteRequest(requestId, { action, reason });
      setRequests(prev => prev.filter(r => r.request_id !== requestId));
      addToast(
        action === 'approve' ? 'Item berhasil dihapus.' : 'Permintaan hapus ditolak.',
        action === 'approve' ? 'success' : 'info',
      );
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal memproses permintaan.', 'error');
      throw err;
    }
  }

  const pendingCount = requests.length;

  return (
    <div className="max-w-xl relative">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">Delete Approval</h1>
          {pendingCount > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center">
              {pendingCount}
            </span>
          )}
        </div>
        <button
          onClick={() => load(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : pendingCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center">
          <span className="text-5xl mb-4">📋</span>
          <p className="font-semibold text-sm text-gray-600">Belum ada permintaan</p>
          <p className="text-xs mt-1 max-w-[220px]">
            Permintaan hapus item dari kasir akan muncul di sini secara real-time.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <RequestCard key={req.request_id} request={req} onDecision={handleDecision} />
          ))}
        </div>
      )}
    </div>
  );
}
