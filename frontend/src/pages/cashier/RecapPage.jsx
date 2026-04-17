import React, { useState, useEffect } from 'react';
import { getRecap, getTransactions } from '../../api/cashier';
import { formatRupiah, formatDate } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function RecapPage() {
  const { t } = useLang();
  const [date, setDate] = useState(today());
  const [recap, setRecap] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getRecap({ date }),
      getTransactions({ date }),
    ]).then(([r1, r2]) => {
      setRecap(r1.data.data);
      setTransactions(r2.data.data?.items ?? r2.data.data ?? []);
    }).finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">{t('recap.title')}</h1>
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? <Spinner /> : recap && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: t('recap.txnCount'),   value: recap.txn_count,      format: (v) => v },
              { label: t('recap.grandTotal'), value: recap.grand_total,    format: formatRupiah, big: true },
              { label: t('recap.cash'),       value: recap.total_cash,     format: formatRupiah },
              { label: t('recap.qris'),       value: recap.total_qris,     format: formatRupiah },
              { label: t('recap.edc'),        value: recap.total_edc,      format: formatRupiah },
              { label: t('recap.transfer'),   value: recap.total_transfer, format: formatRupiah },
            ].map((card) => (
              <div key={card.label} className={`bg-white rounded-xl border p-4 ${card.big ? 'col-span-2' : ''}`}>
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className={`font-bold text-gray-900 ${card.big ? 'text-2xl text-blue-700' : 'text-lg'}`}>
                  {card.format(card.value ?? 0)}
                </p>
              </div>
            ))}
          </div>

          {/* Transactions list */}
          {transactions.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">
                {t('recap.txnList', { count: transactions.length })}
              </div>
              <div className="divide-y overflow-auto max-h-96">
                {transactions.map((txn) => (
                  <div key={txn.transaction_id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-mono font-semibold text-gray-900">{txn.transaction_id}</p>
                      <p className="text-xs text-gray-400">{txn.customer_name} · {txn.payment_method}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-700">{formatRupiah(txn.total_amount)}</p>
                      <Badge status={txn.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
