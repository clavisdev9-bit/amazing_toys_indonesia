import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { getTransactions, getExpiredTransactions, getCustomerActiveTrx } from '../../api/cashier';
import { lookupPayment } from '../../api/payments';
import { formatRupiah, formatDate } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function CashierDashboardPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [txnId, setTxnId]             = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [looking, setLooking]         = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [recent, setRecent]           = useState([]);
  const [queue, setQueue]             = useState([]);
  const [expired, setExpired]         = useState([]);
  const [activeTab, setActiveTab]     = useState('queue');

  const loadQueue = useCallback(() => {
    client.get('/cashier/queue')
      .then(r => setQueue(r.data.data || []))
      .catch(() => {});
  }, []);

  const loadExpired = useCallback(() => {
    getExpiredTransactions()
      .then(r => setExpired(r.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadQueue();
    loadExpired();
    getTransactions().then((r) => {
      const items = r.data.data?.items ?? r.data.data ?? [];
      setRecent(items);
    }).catch(() => {});
  }, [loadQueue, loadExpired]);

  async function handleLookup(e) {
    e.preventDefault();
    if (!txnId.trim()) return;
    setLookupError('');
    setLooking(true);
    try {
      const txnRes = await lookupPayment(txnId.trim());
      const txnData = txnRes.data.data;

      // Check for other active TRX from the same customer
      const phone = txnData?.customer_phone ?? txnData?.walk_in_phone ?? null;
      if (phone) {
        const activeRes = await getCustomerActiveTrx({ phone }).catch(() => null);
        const activeTrx = activeRes?.data?.data ?? [];
        if (activeTrx.length > 1) {
          // Multiple TRX found — go to merge page
          navigate('/cashier/group-merge', {
            state: { transactions: activeTrx, scannedId: txnId.trim() },
          });
          return;
        }
      }

      // Single TRX — go directly to payment page (existing flow)
      const code = voucherCode.trim().toUpperCase() || undefined;
      navigate(`/cashier/bayar/${txnId.trim()}`, { state: code ? { preVoucher: code } : undefined });
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message;
      if (status === 409) setLookupError(t('cashier.err409'));
      else if (status === 410) setLookupError(t('cashier.err410'));
      else if (status === 404) setLookupError(t('cashier.err404'));
      else setLookupError(msg ?? t('cashier.errDefault'));
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">{t('cashier.title')}</h1>

      {/* POS Langsung shortcut */}
      <button
        onClick={() => navigate('/cashier/pos')}
        className="w-full flex items-center gap-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-4 mb-6 transition-colors shadow-sm text-left"
      >
        <span className="text-3xl">🛒</span>
        <div>
          <p className="font-bold text-base">{t('cashier.posTitle')}</p>
          <p className="text-blue-200 text-xs mt-0.5">{t('cashier.posDesc')}</p>
        </div>
        <span className="ml-auto text-blue-200 text-xl">→</span>
      </button>

      {/* Lookup form — always visible */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">{t('cashier.search')}</h2>
        <form onSubmit={handleLookup} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="TXN-20260415-00001"
                value={txnId}
                onChange={(e) => { setTxnId(e.target.value.toUpperCase()); setLookupError(''); }}
                className="font-mono"
                error={lookupError}
              />
            </div>
            <Button type="submit" loading={looking} className="shrink-0">
              {t('cashier.searchBtn')}
            </Button>
          </div>

          {/* Optional voucher code — auto-applied on the payment page */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <span className="text-base shrink-0">🏷️</span>
            <input
              type="text"
              placeholder={t('cashier.voucherPlaceholder')}
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              className="flex-1 text-sm font-mono bg-transparent focus:outline-none text-amber-900 placeholder:text-amber-400 uppercase tracking-wider"
              maxLength={50}
            />
            {voucherCode && (
              <button
                type="button"
                onClick={() => setVoucherCode('')}
                className="text-amber-400 hover:text-amber-700 text-xs shrink-0"
              >✕</button>
            )}
          </div>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'queue' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          {t('cashier.queueTab')} ({queue.length})
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'recent' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          {t('cashier.processedTab')}
        </button>
        <button
          onClick={() => { setActiveTab('expired'); loadExpired(); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'expired' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500'
          }`}
        >
          Kadaluarsa {expired.length > 0 && <span className="ml-1 bg-red-100 text-red-600 text-xs rounded-full px-1.5 py-0.5">{expired.length}</span>}
        </button>
      </div>

      {/* Queue tab — RESERVED + WAITING_PAYMENT + PENDING orders */}
      {activeTab === 'queue' && (
        <div>
          <div className="flex justify-end mb-2">
            <button onClick={loadQueue} className="text-xs text-blue-600 hover:underline">{t('helper.refresh')}</button>
          </div>
          {queue.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('cashier.noQueue')}</p>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden divide-y">
              {queue.map(txn => (
                <button
                  key={txn.transaction_id}
                  onClick={() => navigate(`/cashier/bayar/${txn.transaction_id}`)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-gray-900">{txn.transaction_id}</p>
                    <p className="text-xs text-gray-500">
                      {txn.booth_location ? `${txn.booth_location} · ` : ''}
                      {txn.customer_name || txn.customer_phone || txn.walk_in_phone || 'Walk-in'} ·{' '}
                      {formatDate(txn.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-blue-700">{formatRupiah(txn.total_amount)}</p>
                    <Badge status={txn.status} label={t(`badge.${txn.status}`)} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent tab — PAID transactions today */}
      {activeTab === 'recent' && (
        <div>
          {recent.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('cashier.noTransactions')}</p>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden divide-y">
              {recent.map((txn) => (
                <button
                  key={txn.transaction_id}
                  onClick={() => navigate(`/cashier/bayar/${txn.transaction_id}`)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-gray-900">{txn.transaction_id}</p>
                    <p className="text-xs text-gray-400">{txn.customer_name} · {txn.paid_at ? formatDate(txn.paid_at) : '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-700">{formatRupiah(txn.total_amount)}</p>
                    <Badge status={txn.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expired tab — EXPIRED transactions today */}
      {activeTab === 'expired' && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-gray-400">Transaksi yang melewati batas waktu tanpa pembayaran.</p>
            <button onClick={loadExpired} className="text-xs text-red-500 hover:underline">{t('helper.refresh')}</button>
          </div>
          {expired.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Tidak ada transaksi kadaluarsa hari ini.</p>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden divide-y">
              {expired.map((txn) => (
                <div
                  key={txn.transaction_id}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2 opacity-70"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-gray-700">{txn.transaction_id}</p>
                    <p className="text-xs text-gray-500">
                      {txn.booth_location ? `${txn.booth_location} · ` : ''}
                      {txn.customer_name || txn.customer_phone || txn.walk_in_phone || 'Walk-in'} ·{' '}
                      Dibuat {formatDate(txn.created_at)}
                    </p>
                    <p className="text-xs text-red-400 mt-0.5">Kadaluarsa: {formatDate(txn.expires_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-500">{formatRupiah(txn.total_amount)}</p>
                    <Badge status="EXPIRED" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
