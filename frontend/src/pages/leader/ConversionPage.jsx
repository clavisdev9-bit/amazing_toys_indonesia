import React, { useState, useEffect } from 'react';
import { getConversionRate } from '../../api/leader';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

function today() { return new Date().toISOString().split('T')[0]; }
function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

function RateBadge({ value }) {
  const color = value >= 60 ? 'bg-green-100 text-green-700'
    : value >= 30 ? 'bg-yellow-100 text-yellow-700'
    : 'bg-red-100 text-red-700';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {value}%
    </span>
  );
}

export default function ConversionPage() {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo,   setDateTo]   = useState(today());
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  function fetch() {
    setLoading(true);
    getConversionRate({ date_from: dateFrom, date_to: dateTo })
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetch(); }, []);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Conversion Rate Pengunjung</h1>

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
          {/* Overall summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
              <p className="text-xs text-blue-500 mb-1">Total Pengunjung Unik</p>
              <p className="text-2xl font-bold text-blue-700">{data.overall.visitors}</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
              <p className="text-xs text-green-500 mb-1">Yang Membeli</p>
              <p className="text-2xl font-bold text-green-700">{data.overall.buyers}</p>
            </div>
            <div className="bg-purple-50 rounded-xl border border-purple-100 p-4 text-center">
              <p className="text-xs text-purple-500 mb-1">Conversion Rate</p>
              <p className="text-2xl font-bold text-purple-700">{data.overall.conversionRate}%</p>
            </div>
          </div>

          {/* Conversion funnel bar */}
          {data.overall.visitors > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs font-semibold text-gray-600 mb-3">Funnel Konversi</p>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Pengunjung</span>
                    <span className="font-bold">{data.overall.visitors}</span>
                  </div>
                  <div className="h-4 bg-blue-100 rounded-full" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Pembeli</span>
                    <span className="font-bold">{data.overall.buyers}</span>
                  </div>
                  <div className="h-4 bg-green-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full"
                      style={{ width: `${data.overall.conversionRate}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Daily table */}
          {data.rows.length === 0 ? (
            <EmptyState icon="📊" title="Tidak ada data" description="Ubah rentang tanggal" />
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">Data Harian</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Tanggal', 'Pengunjung', 'Pembeli', 'Transaksi', 'Conv. Rate'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.rows.map((r) => (
                    <tr key={r.date} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700">{r.date}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{r.visitors}</td>
                      <td className="px-3 py-2 text-gray-700">{r.buyers}</td>
                      <td className="px-3 py-2 text-gray-600">{r.paidTxn}</td>
                      <td className="px-3 py-2"><RateBadge value={r.conversionRate} /></td>
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
