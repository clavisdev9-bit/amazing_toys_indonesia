import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrder } from '../../api/orders';
import { formatRupiah } from '../../utils/format';
import { groupByTenant } from '../../utils/order';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useLang } from '../../context/LangContext';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';

function pickupBadgeStyle(status) {
  if (status === 'DONE')  return 'bg-green-100 text-green-700';
  if (status === 'READY') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

export default function PickupStatusPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const { subscribe } = useWebSocket();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barcodeModal, setBarcodeModal] = useState(false);

  const fetchOrder = useCallback(() => {
    getOrder(transactionId)
      .then((r) => setOrder(r.data.data))
      .finally(() => setLoading(false));
  }, [transactionId]);

  function handleRefresh() {
    setRefreshing(true);
    getOrder(transactionId)
      .then((r) => setOrder(r.data.data))
      .finally(() => setRefreshing(false));
  }

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // Real-time update via WebSocket
  useEffect(() => {
    return subscribe('PICKUP_DONE', (payload) => {
      if (payload.transactionId === transactionId) fetchOrder();
    });
  }, [transactionId, subscribe, fetchOrder]);

  // Polling fallback every 10 seconds
  useEffect(() => {
    const id = setInterval(fetchOrder, 10000);
    return () => clearInterval(id);
  }, [fetchOrder]);

  if (loading) return <Spinner />;
  if (!order) return <div className="p-4 text-center text-gray-500">{t('order.notFound')}</div>;

  const groups = groupByTenant(order.items);
  const totalItems  = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const doneItems   = order.items
    .filter((i) => i.pickup_status === 'DONE')
    .reduce((sum, i) => sum + i.quantity, 0);
  const progressPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const allDone     = totalItems > 0 && doneItems === totalItems;

  function pickupLabel(status) {
    if (status === 'DONE')  return t('pickup.done');
    if (status === 'READY') return t('pickup.ready');
    return t('pickup.preparing');
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => navigate(`/pesanan/${transactionId}/receipt`)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
        >
          {t('back')}
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

      {/* Info banner */}
      <div className="mx-4 mb-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
        {t('pickup.infoBanner')}
      </div>

      {/* Item list grouped by tenant */}
      <div className="bg-white border-y divide-y">
        {groups.map((group) => (
          <div key={group.tenant_id}>
            <div className="px-4 py-2 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {group.tenant_name} · {group.booth_location}
              </p>
            </div>
            {group.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.product_name}</p>
                  <p className="text-xs text-gray-400">
                    ×{item.quantity} · {formatRupiah(item.unit_price * item.quantity)}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pickupBadgeStyle(item.pickup_status)}`}>
                  {pickupLabel(item.pickup_status)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Progress summary */}
      <div className="mx-4 my-4 bg-white border rounded-xl px-4 py-4 text-center">
        <p className="text-xs text-gray-400 mb-1">{t('pickup.collected')}</p>
        <p className="text-2xl font-bold text-gray-900 mb-3">
          {doneItems} / {totalItems} {t('pickup.items')}
        </p>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {allDone && (
          <p className="text-sm text-green-600 font-semibold mt-3">{t('pickup.allDone')}</p>
        )}
      </div>

      {/* Show barcode CTA */}
      <div className="px-4 pb-6">
        <button
          onClick={() => setBarcodeModal(true)}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m0 14v1M4 12h1m14 0h1m-2.05-6.364l-.707.707M6.757 17.657l-.707.707m0-12.728l.707.707M17.243 17.657l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
          {t('pickup.showBarcode')}
        </button>
      </div>

      {/* Barcode modal */}
      <Modal open={barcodeModal} onClose={() => setBarcodeModal(false)} title={t('pickup.modalTitle')}>
        <div className="text-center py-2">
          {order.qr_payload ? (
            <img
              src={`data:image/png;base64,${order.qr_payload}`}
              alt="QR Code"
              className="w-48 h-48 mx-auto border-2 border-gray-200 rounded-xl p-1 mb-3"
            />
          ) : (
            <div className="w-48 h-48 mx-auto border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center mb-3 text-gray-400 text-sm">
              {t('checkout.qrMissing')}
            </div>
          )}
          <p className="font-mono font-bold text-gray-800 text-base tracking-wider">
            {order.transaction_id}
          </p>
        </div>
      </Modal>
    </div>
  );
}
