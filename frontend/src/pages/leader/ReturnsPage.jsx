import React, { useState, useEffect } from 'react';
import { getReturns, updateReturn, createReturn } from '../../api/leader';
import { formatDate } from '../../utils/format';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

const STATUS_TABS = ['PENDING', 'APPROVED', 'REJECTED'];

export default function ReturnsPage() {
  const { toasts, addToast, removeToast } = useToast();
  const [tab, setTab] = useState('PENDING');
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionModal, setActionModal] = useState(null); // { requestId, type: 'approve'|'reject' }
  const [rejectNote, setRejectNote] = useState('');
  const [acting, setActing] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [newReturn, setNewReturn] = useState({ transaction_id: '', reason: '' });
  const [creating, setCreating] = useState(false);

  function fetchReturns() {
    setLoading(true);
    getReturns({ status: tab })
      .then((r) => setReturns(r.data.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchReturns(); }, [tab]);

  async function handleAction() {
    setActing(true);
    try {
      const { requestId, type } = actionModal;
      const body = type === 'approve'
        ? { approved: true }
        : { approved: false, rejection_note: rejectNote };
      await updateReturn(requestId, body);
      addToast(type === 'approve' ? 'Retur disetujui.' : 'Retur ditolak.', 'success');
      setActionModal(null);
      fetchReturns();
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal memproses retur', 'error');
    } finally {
      setActing(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await createReturn(newReturn);
      addToast('Permintaan retur dibuat.', 'success');
      setCreateModal(false);
      setNewReturn({ transaction_id: '', reason: '' });
      fetchReturns();
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal membuat retur', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Retur & Pembatalan</h1>
          <Button size="sm" onClick={() => setCreateModal(true)}>+ Buat Retur</Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-4">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
                ${tab === s ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {s === 'PENDING' ? 'Menunggu' : s === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
            </button>
          ))}
        </div>

        {loading ? <Spinner /> : returns.length === 0 ? (
          <EmptyState icon="📋" title="Tidak ada retur" description={`Status: ${tab}`} />
        ) : (
          <div className="bg-white rounded-xl border divide-y overflow-hidden">
            {returns.map((r) => (
              <div key={r.request_id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-bold text-gray-900">{r.transaction_id}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(r.created_at)}</p>
                    <p className="text-sm text-gray-700 mt-1">{r.reason}</p>
                    {r.rejection_note && (
                      <p className="text-xs text-red-500 mt-0.5">Catatan: {r.rejection_note}</p>
                    )}
                  </div>
                  <Badge status={r.status} />
                </div>
                {tab === 'PENDING' && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => { setActionModal({ requestId: r.request_id, type: 'approve' }); setRejectNote(''); }}
                    >
                      Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => { setActionModal({ requestId: r.request_id, type: 'reject' }); setRejectNote(''); }}
                    >
                      Tolak
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      <Modal
        open={!!actionModal}
        onClose={() => setActionModal(null)}
        title={actionModal?.type === 'approve' ? 'Setujui Retur?' : 'Tolak Retur?'}
      >
        {actionModal?.type === 'reject' && (
          <div className="mb-4">
            <Input
              label="Alasan penolakan"
              placeholder="Masukkan alasan..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setActionModal(null)}>Batal</Button>
          <Button
            variant={actionModal?.type === 'approve' ? 'success' : 'danger'}
            className="flex-1"
            loading={acting}
            onClick={handleAction}
          >
            {actionModal?.type === 'approve' ? 'Setujui' : 'Tolak'}
          </Button>
        </div>
      </Modal>

      {/* Create Return Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Buat Permintaan Retur">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="ID Transaksi"
            placeholder="TXN-20260415-00001"
            value={newReturn.transaction_id}
            onChange={(e) => setNewReturn((n) => ({ ...n, transaction_id: e.target.value.toUpperCase() }))}
            required
            className="font-mono"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Alasan</label>
            <textarea
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Masukkan alasan retur..."
              value={newReturn.reason}
              onChange={(e) => setNewReturn((n) => ({ ...n, reason: e.target.value }))}
              required
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setCreateModal(false)}>Batal</Button>
            <Button type="submit" className="flex-1" loading={creating}>Buat Retur</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
