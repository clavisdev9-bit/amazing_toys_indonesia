import React, { useState, useEffect } from 'react';
import { getSettlementReport } from '../../api/leader';
import { formatRupiah, formatDate } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

function today() { return new Date().toISOString().split('T')[0]; }
function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

const METHOD_LABEL = { QRIS: 'QRIS / Transfer', CASH: 'Tunai', BCA_QRIS: 'BCA QRIS' };

export default function SettlementPage() {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo,   setDateTo]   = useState(today());
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  function fetch() {
    setLoading(true);
    getSettlementReport({ date_from: dateFrom, date_to: dateTo })
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetch(); }, []);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Laporan Settlement Pembayaran</h1>

      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Dari Tanggal</label>
          <input type="date" value={dateFrom} max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Sampai Tanggal</label>
          <input type="date" value={dateTo} min={dateFrom} max={today()}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={fetch}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          Tampilkan
        </button>
      </div>

      {loading ? <Spinner /> : !data ? null : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
              <p className="text-xs text-green-600 mb-1">Total Terbayar</p>
              <p className="text-lg font-bold text-green-700">{formatRupiah(data.totalPaid)}</p>
              <p className="text-xs text-green-500">{data.totalTxn} transaksi</p>
            </div>
            <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-4 text-center">
              <p className="text-xs text-yellow-600 mb-1">Pending / Belum Bayar</p>
              <p className="text-lg font-bold text-yellow-700">{formatRupiah(data.pending.amount)}</p>
              <p className="text-xs text-yellow-500">{data.pending.count} transaksi</p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
              <p className="text-xs text-blue-600 mb-1">Grand Total</p>
              <p className="text-lg font-bold text-blue-700">{formatRupiah(data.totalPaid + data.pending.amount)}</p>
            </div>
          </div>

          {/* Payment method breakdown */}
          {data.breakdown.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-gray-700 mb-3 text-sm">Breakdown Metode Pembayaran</h2>
              <div className="space-y-3">
                {data.breakdown.map((b) => {
                  const pct = data.totalPaid > 0 ? Math.round((b.amount / data.totalPaid) * 100) : 0;
                  return (
                    <div key={b.paymentMethod}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium">
                          {METHOD_LABEL[b.paymentMethod] ?? b.paymentMethod}
                          <span className="text-gray-400 font-normal ml-1">({b.count} txn)</span>
                        </span>
                        <span className="font-bold text-gray-900">{formatRupiah(b.amount)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 text-right">{pct}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daily trend */}
          {data.daily.length === 0 ? (
            <EmptyState icon="💳" title="Tidak ada transaksi terbayar" description="Ubah rentang tanggal" />
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">Tren Harian</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Tanggal', 'Transaksi', 'Total Terbayar'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.daily.map((r) => (
                    <tr key={r.date} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{r.date}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.count}</td>
                      <td className="px-4 py-2.5 font-semibold text-blue-700">{formatRupiah(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
