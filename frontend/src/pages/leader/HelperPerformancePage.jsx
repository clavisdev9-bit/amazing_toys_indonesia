import React, { useState, useEffect } from 'react';
import { getHelperPerformance } from '../../api/leader';
import { formatRupiah } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

function today() { return new Date().toISOString().split('T')[0]; }
function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

export default function HelperPerformancePage() {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo,   setDateTo]   = useState(today());
  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(false);

  function fetch() {
    setLoading(true);
    getHelperPerformance({ date_from: dateFrom, date_to: dateTo })
      .then((r) => setData(r.data.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetch(); }, []);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Kinerja Helper</h1>

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

      {loading ? <Spinner /> : data.length === 0 ? (
        <EmptyState icon="🙋" title="Tidak ada data helper" description="Belum ada order yang dibuat oleh Helper pada periode ini" />
      ) : (
        <div className="space-y-3">
          {data.map((h, i) => (
            <div key={h.userId} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-gray-100 text-gray-600' :
                    i === 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-50 text-blue-600'
                  }`}>#{i + 1}</span>
                  <p className="font-semibold text-gray-900">{h.displayName}</p>
                </div>
                <p className="font-bold text-blue-700">{formatRupiah(h.revenue)}</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">Total Order</p>
                  <p className="font-bold text-gray-900">{h.totalOrder}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-xs text-green-500">Lunas</p>
                  <p className="font-bold text-green-700">{h.paidOrder}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="text-xs text-red-400">Batal</p>
                  <p className="font-bold text-red-600">{h.cancelledOrder}</p>
                </div>
                <div className={`rounded-lg p-2 ${
                  h.successRate >= 70 ? 'bg-green-50' :
                  h.successRate >= 40 ? 'bg-yellow-50' : 'bg-red-50'
                }`}>
                  <p className="text-xs text-gray-500">Success Rate</p>
                  <p className={`font-bold ${
                    h.successRate >= 70 ? 'text-green-700' :
                    h.successRate >= 40 ? 'text-yellow-700' : 'text-red-700'
                  }`}>{h.successRate}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
