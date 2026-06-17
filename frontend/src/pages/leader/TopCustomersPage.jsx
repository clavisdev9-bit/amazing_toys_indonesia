import React, { useState, useEffect } from 'react';
import { getTopCustomers } from '../../api/leader';
import { formatRupiah } from '../../utils/format';
import { exportToExcel } from '../../utils/exportExcel';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

function today() { return new Date().toISOString().split('T')[0]; }
function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

const MEDALS = ['🥇', '🥈', '🥉'];

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function TopCustomersPage() {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo,   setDateTo]   = useState(today());
  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(false);

  function fetch() {
    setLoading(true);
    getTopCustomers({ date_from: dateFrom, date_to: dateTo, limit: 10 })
      .then((r) => setData(r.data.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetch(); }, []);

  const grandTotal = data.reduce((s, r) => s + r.totalBelanja, 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Top 10 Customer Terbanyak Belanja</h1>
      <p className="text-xs text-gray-400 mb-4">Berdasarkan total nilai pembelian (transaksi PAID)</p>

      {/* Filter */}
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

      {!loading && data.length > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => exportToExcel(`Top_Customer_${dateFrom}_${dateTo}`, [{
              name: 'Top Customer',
              rows: data.map((c) => ({
                'Rank': c.rank,
                'Nama Customer': c.customerName,
                'No. HP': c.phone,
                'Total Transaksi': c.totalTransaksi,
                'Total Item': c.totalItem,
                'Avg Order': c.avgBelanja,
                'Total Belanja': c.totalBelanja,
                'Terakhir Beli': c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString('id-ID') : '-',
              })),
            }])}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 flex items-center gap-1"
          >
            ⬇ Export Excel
          </button>
        </div>
      )}

      {loading ? <Spinner /> : data.length === 0 ? (
        <EmptyState icon="👤" title="Tidak ada data customer" description="Ubah rentang tanggal" />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-3 text-center">
              <p className="text-xs text-blue-500 mb-0.5">Total Belanja Top 10</p>
              <p className="text-base font-bold text-blue-700">{formatRupiah(grandTotal)}</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-100 p-3 text-center">
              <p className="text-xs text-green-500 mb-0.5">Rata-rata per Customer</p>
              <p className="text-base font-bold text-green-700">
                {formatRupiah(data.length > 0 ? Math.round(grandTotal / data.length) : 0)}
              </p>
            </div>
            <div className="bg-purple-50 rounded-xl border border-purple-100 p-3 text-center">
              <p className="text-xs text-purple-500 mb-0.5">Top Spender</p>
              <p className="text-sm font-bold text-purple-700 truncate">{data[0]?.customerName ?? '-'}</p>
            </div>
          </div>

          {/* Podium top 3 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {data.slice(0, 3).map((c) => (
              <div key={c.rank} className={`rounded-xl border p-4 text-center ${
                c.rank === 1 ? 'bg-yellow-50 border-yellow-200' :
                c.rank === 2 ? 'bg-gray-50 border-gray-200' :
                'bg-amber-50 border-amber-200'
              }`}>
                <p className="text-2xl mb-1">{MEDALS[c.rank - 1]}</p>
                <p className="font-bold text-sm text-gray-900 truncate">{c.customerName}</p>
                <p className="text-xs text-gray-400">{c.phone}</p>
                <p className="font-bold text-blue-700 mt-1 text-sm">{formatRupiah(c.totalBelanja)}</p>
                <p className="text-xs text-gray-400">{c.totalTransaksi} transaksi</p>
              </div>
            ))}
          </div>

          {/* Full table #4 - #10 */}
          {data.length > 3 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">Peringkat 4 – 10</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['#', 'Customer', 'No. HP', 'Transaksi', 'Item', 'Avg Order', 'Total Belanja', 'Terakhir Beli'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.slice(3).map((c) => (
                    <tr key={c.rank} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">#{c.rank}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[120px] truncate">{c.customerName}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{c.phone}</td>
                      <td className="px-3 py-2.5 text-gray-700 text-center">{c.totalTransaksi}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-center">{c.totalItem}</td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">{formatRupiah(c.avgBelanja)}</td>
                      <td className="px-3 py-2.5 font-bold text-blue-700 whitespace-nowrap">{formatRupiah(c.totalBelanja)}</td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(c.lastPurchase)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
