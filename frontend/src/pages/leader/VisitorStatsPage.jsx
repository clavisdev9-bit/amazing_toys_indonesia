import React, { useState, useEffect } from 'react';
import { getVisitors } from '../../api/leader';
import { formatDateOnly } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

function today() { return new Date().toISOString().split('T')[0]; }
function weekAgo() {
  const d = new Date(); d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
}

export default function VisitorStatsPage() {
  const [startDate, setStartDate] = useState(weekAgo());
  const [endDate, setEndDate] = useState(today());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getVisitors({ start_date: startDate, end_date: endDate })
      .then((r) => setData(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const total = data.reduce((s, d) => s + parseInt(d.total ?? 0), 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Statistik Pengunjung</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Dari Tanggal</label>
          <input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Sampai Tanggal</label>
          <input type="date" value={endDate} min={startDate} max={today()} onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {total > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 mb-4 text-center">
          <p className="text-xs text-blue-600 mb-1">Total Pengunjung</p>
          <p className="text-3xl font-bold text-blue-700">{total}</p>
        </div>
      )}

      {loading ? <Spinner /> : data.length === 0 ? (
        <EmptyState icon="👥" title="Tidak ada data pengunjung" description="Ubah rentang tanggal" />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Tanggal', 'Total', 'Laki-laki', 'Perempuan', 'Lainnya'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((row) => (
                <tr key={row.date} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{formatDateOnly(row.date)}</td>
                  <td className="px-3 py-2 font-bold text-gray-900">{row.total ?? 0}</td>
                  <td className="px-3 py-2 text-gray-600">{row.male ?? 0}</td>
                  <td className="px-3 py-2 text-gray-600">{row.female ?? 0}</td>
                  <td className="px-3 py-2 text-gray-600">{row.other ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
