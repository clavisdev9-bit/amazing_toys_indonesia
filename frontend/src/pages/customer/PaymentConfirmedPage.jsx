import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrder } from '../../api/orders';
import { formatRupiah, formatDate } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Spinner from '../../components/ui/Spinner';

export default function PaymentConfirmedPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrder(transactionId)
      .then((r) => setOrder(r.data.data))
      .finally(() => setLoading(false));
  }, [transactionId]);

  if (loading) return <Spinner />;
  if (!order) return <div className="p-4 text-center text-gray-500">{t('order.notFound')}</div>;

  return (
    <div className="max-w-lg mx-auto p-4">

      {/* Success animation */}
      <div className="text-center mb-6">
        <div
          className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ animation: 'scaleIn 0.35s ease-out both' }}
        >
          <svg
            className="w-10 h-10 text-green-500"
            fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t('confirmed.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('confirmed.subtitle')}</p>
      </div>

      {/* Transaction summary card */}
      <div className="bg-white rounded-2xl border divide-y mb-4">
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-500">{t('confirmed.txnId')}</span>
          <span className="font-mono text-sm font-bold text-gray-900">#{order.transaction_id}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-500">{t('confirmed.totalPaid')}</span>
          <span className="text-sm font-bold text-red-600">{formatRupiah(order.total_amount)}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-500">{t('confirmed.payment')}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {order.payment_method ?? 'QR Code'}
          </span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-500">{t('confirmed.datetime')}</span>
          <span className="text-sm text-gray-700">{formatDate(order.paid_at ?? order.created_at)}</span>
        </div>
      </div>

      {/* Non-returnable banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 mb-6">
        <span className="text-base mt-0.5">🧾</span>
        <p className="text-sm text-amber-800">{t('confirmed.nonReturnable')}</p>
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate(`/pesanan/${transactionId}/receipt`)}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 rounded-xl text-base transition-colors"
      >
        {t('confirmed.cta')}
      </button>
      <p className="text-center text-xs text-gray-400 mt-2">{t('confirmed.ctaHint')}</p>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
