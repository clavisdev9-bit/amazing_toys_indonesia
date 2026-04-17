import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatRupiah } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useCountdown } from '../../hooks/useCountdown';
import Button from '../../components/ui/Button';

export default function CheckoutSuccessPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { t } = useLang();
  const { subscribe } = useWebSocket();

  const transactionId = state?.transactionId;
  const totalAmount   = state?.totalAmount;
  const expiresAt     = state?.expiresAt;
  const qrPayload     = state?.qrPayload;

  const { remaining, mins, secs } = useCountdown(expiresAt);

  const qrSrc = useMemo(
    () => (qrPayload ? `data:image/png;base64,${qrPayload}` : null),
    [qrPayload],
  );

  // Redirect to cart if arrived without order state
  useEffect(() => {
    if (!transactionId) navigate('/keranjang');
  }, [transactionId, navigate]);

  // Auto-redirect when cashier confirms payment
  useEffect(() => {
    if (!transactionId) return;
    return subscribe('ORDER_PAID', (payload) => {
      if (payload.transactionId === transactionId) {
        navigate(`/pesanan/${transactionId}/confirmed`);
      }
    });
  }, [transactionId, subscribe, navigate]);

  if (!transactionId) return null;

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">
        <div className="text-4xl mb-2">🎉</div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">{t('checkout.created')}</h1>
        <p className="text-sm text-gray-500 mb-4">{t('checkout.showQR')}</p>

        {qrSrc ? (
          <div className="flex flex-col items-center mb-4 gap-2">
            <div className="p-3 border-2 border-gray-200 rounded-xl inline-block">
              <img
                src={qrSrc}
                alt="QR Code Pembayaran"
                className="w-48 h-48"
              />
            </div>
            <a
              href={qrSrc}
              download={`QR-${transactionId}.png`}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Simpan QR
            </a>
          </div>
        ) : (
          <div className="flex justify-center mb-4 p-3 border-2 border-red-200 rounded-xl bg-red-50">
            <p className="text-red-600 text-sm">{t('checkout.qrMissing')}</p>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4">
          <p className="text-xs text-gray-500 mb-1">{t('checkout.txnId')}</p>
          <p className="font-mono font-bold text-gray-900 text-lg tracking-wider">{transactionId}</p>
        </div>

        <div className="flex items-center justify-between mb-4 px-2">
          <span className="text-gray-600">{t('checkout.total')}</span>
          <span className="text-xl font-bold text-blue-700">{formatRupiah(totalAmount)}</span>
        </div>

        {remaining > 0 ? (
          <div className={`rounded-lg px-4 py-3 mb-4 ${mins < 5 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
            <p className="text-sm font-medium">
              {t('checkout.payIn', { mins, secs: secs.toString().padStart(2, '0') })}
            </p>
          </div>
        ) : (
          <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm font-medium">
            {t('checkout.expired')}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button size="full" variant="outline" onClick={() => navigate(`/pesanan/${transactionId}`)}>
            {t('checkout.track')}
          </Button>
          <Button size="full" variant="secondary" onClick={() => navigate('/katalog')}>
            {t('checkout.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
