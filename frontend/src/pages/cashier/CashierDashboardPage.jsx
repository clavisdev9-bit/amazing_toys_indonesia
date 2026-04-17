import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTransactions } from '../../api/cashier';
import { lookupPayment } from '../../api/payments';
import { formatRupiah, formatDate } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function CashierDashboardPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [txnId, setTxnId] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    getTransactions().then((r) => {
      const items = r.data.data?.items ?? r.data.data ?? [];
      setRecent(items);
    }).catch(() => {});
  }, []);

  async function handleLookup(e) {
    e.preventDefault();
    if (!txnId.trim()) return;
    setLookupError('');
    setLooking(true);
    try {
      await lookupPayment(txnId.trim());
      navigate(`/cashier/bayar/${txnId.trim()}`);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
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

      {/* Lookup form */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">{t('cashier.search')}</h2>
        <form onSubmit={handleLookup} className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="TXN-20260415-00001"
              value={txnId}
              onChange={(e) => setTxnId(e.target.value.toUpperCase())}
              className="font-mono"
              error={lookupError}
            />
          </div>
          <Button type="submit" loading={looking} className="shrink-0">
            {t('cashier.searchBtn')}
          </Button>
        </form>
      </div>

      {/* Recent transactions */}
      {recent.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold text-gray-700 text-sm">
            {t('cashier.recent')}
          </div>
          <div className="divide-y">
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
        </div>
      )}
    </div>
  );
}
