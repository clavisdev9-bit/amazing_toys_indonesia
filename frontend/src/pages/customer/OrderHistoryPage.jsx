import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyOrders } from '../../api/orders';
import { formatRupiah, formatDate } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useLang();

  useEffect(() => {
    getMyOrders()
      .then((r) => setOrders(r.data.data?.items ?? r.data.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon="📦"
        title={t('orders.empty.title')}
        description={t('orders.empty.desc')}
        action={
          <button onClick={() => navigate('/katalog')} className="text-blue-600 font-medium text-sm">
            {t('orders.toCatalog')}
          </button>
        }
      />
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-4 py-3 font-semibold text-gray-800 bg-white border-b sticky top-[57px] z-10">
        {t('orders.title')}
      </div>
      <div className="divide-y bg-white">
        {orders.map((order) => (
          <button
            key={order.transaction_id}
            onClick={() => navigate(`/pesanan/${order.transaction_id}`)}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-mono font-semibold text-gray-900">{order.transaction_id}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                <p className="text-sm font-bold text-blue-700 mt-1">{formatRupiah(order.total_amount)}</p>
              </div>
              <Badge status={order.status} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
