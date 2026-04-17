import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrder, cancelOrder, updateOrderItem } from '../../api/orders';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useCountdown } from '../../hooks/useCountdown';
import { formatRupiah, formatDate } from '../../utils/format';
import { groupByTenant } from '../../utils/order';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';

export default function OrderTrackingPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { subscribe } = useWebSocket();
  const { t } = useLang();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editItem, setEditItem] = useState(null); // { product_id, product_name, quantity, unit_price }
  const [editQty, setEditQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const expiresAt = order?.status === 'PENDING' ? order.expires_at : null;
  const { remaining, mins, secs } = useCountdown(expiresAt);

  const fetchOrder = useCallback(() => {
    getOrder(transactionId)
      .then((r) => setOrder(r.data.data))
      .catch(() => {/* order stays null — "not found" message shown */})
      .finally(() => setLoading(false));
  }, [transactionId]);

  function handleRefresh() {
    setRefreshing(true);
    getOrder(transactionId)
      .then((r) => setOrder(r.data.data))
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    return subscribe('PICKUP_DONE', (payload) => {
      if (payload.transactionId === transactionId) fetchOrder();
    });
  }, [transactionId, subscribe, fetchOrder]);

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
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelOrder(transactionId);
      fetchOrder();
      setCancelModal(false);
    } finally {
      setCancelling(false);
    }
  }

  const groups = useMemo(() => groupByTenant(order?.items ?? []), [order?.items]);

  if (loading) return <Spinner />;
  if (!order) return <div className="p-4 text-center text-gray-500">{t('order.notFound')}</div>;

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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
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

      {/* QR code + countdown (only for pending) */}
      {order.status === 'PENDING' && order.qr_payload && (
        <div className="bg-amber-50 border-b px-4 py-4 text-center">
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

      {/* Items grouped by tenant */}
      <div className="divide-y">
        {groups.map((group) => {
          const allDone = group.items.every((i) => i.pickup_status === 'DONE');
          return (
            <div key={group.tenant_id} className="bg-white px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm text-gray-800">{group.tenant_name}</p>
                  <p className="text-xs text-gray-400">{group.booth_location}</p>
                </div>
                <Badge status={allDone ? 'DONE' : order.status === 'PAID' ? 'PAID' : order.status} />
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.product_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">{item.product_name} × {item.quantity}</span>
                      {order.status === 'PENDING' && (
                        <button
                          onClick={() => openEdit(item)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit jumlah"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <span className="text-gray-500">{formatRupiah(item.unit_price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Receipt button */}
      {(order.status === 'PAID' || order.status === 'DONE') && (
        <div className="p-4">
          <Button variant="primary" size="full" onClick={() => navigate(`/pesanan/${transactionId}/receipt`)}>
            {t('confirmed.cta')}
          </Button>
        </div>
      )}

      {/* Cancel button */}
      {order.status === 'PENDING' && (
        <div className="p-4">
          <Button variant="danger" size="full" onClick={() => setCancelModal(true)}>
            {t('order.cancelBtn')}
          </Button>
        </div>
      )}

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Jumlah">
        {editItem && (
          <>
            <p className="text-sm text-gray-600 mb-4">{editItem.product_name}</p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => setEditQty(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-full border border-gray-300 text-xl font-bold text-gray-600 hover:bg-gray-100 flex items-center justify-center disabled:opacity-40"
                disabled={editQty <= 1}
              >−</button>
              <span className="text-2xl font-bold w-10 text-center">{editQty}</span>
              <button
                onClick={() => setEditQty(q => q + 1)}
                className="w-10 h-10 rounded-full border border-gray-300 text-xl font-bold text-gray-600 hover:bg-gray-100 flex items-center justify-center"
              >+</button>
            </div>
            <p className="text-center text-sm text-gray-500 mb-4">
              Subtotal: <span className="font-semibold text-gray-800">{formatRupiah(editItem.unit_price * editQty)}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditItem(null)}>Batal</Button>
              <Button variant="primary" className="flex-1" loading={saving} onClick={handleSaveQty}>Simpan</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={cancelModal} onClose={() => setCancelModal(false)} title={t('order.cancelTitle')}>
        <p className="text-sm text-gray-600 mb-4">
          {t('order.cancelBody', { id: transactionId })}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setCancelModal(false)}>{t('order.cancelNo')}</Button>
          <Button variant="danger" className="flex-1" loading={cancelling} onClick={handleCancel}>{t('order.cancelYes')}</Button>
        </div>
      </Modal>
    </div>
  );
}
