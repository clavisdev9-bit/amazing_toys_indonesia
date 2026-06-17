import React, { useState, useEffect } from 'react';
import { getTaxReport } from '../../api/leader';
import { formatRupiah } from '../../utils/format';
import { exportToExcel } from '../../utils/exportExcel';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

function today() { return new Date().toISOString().split('T')[0]; }
function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

export default function TaxReportPage() {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo,   setDateTo]   = useState(today());
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  function fetch() {
    setLoading(true);
    getTaxReport({ date_from: dateFrom, date_to: dateTo })
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetch(); }, []);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Laporan Pajak (PPN)</h1>

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

      {!loading && data && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => exportToExcel(`Laporan_Pajak_${dateFrom}_${dateTo}`, [
              {
                name: 'Ringkasan',
                rows: [
                  { 'Keterangan': 'DPP (Subtotal)', 'Nominal': data.totals.subtotal },
                  { 'Keterangan': 'Total Pajak', 'Nominal': data.totals.taxAmount },
                  { 'Keterangan': 'Total Keseluruhan', 'Nominal': data.totals.totalAmount },
                ],
              },
              {
                name: 'Per Rate Pajak',
                rows: data.byRate.map((r) => ({
                  'Rate (%)': r.taxRate,
                  'Jumlah Transaksi': r.txnCount,
                  'DPP': r.subtotal,
                  'Pajak': r.taxAmount,
                  'Total': r.totalAmount,
                })),
              },
              {
                name: 'Rincian Harian',
                rows: data.daily.map((r) => ({
                  'Tanggal': r.date,
                  'DPP': r.subtotal,
                  'Pajak': r.taxAmount,
                  'Total': r.totalAmount,
                })),
              },
            ])}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 flex items-center gap-1"
          >
            ⬇ Export Excel
          </button>
        </div>
      )}

      {loading ? <Spinner /> : !data ? null : (
        <div className="space-y-4">
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl border p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">DPP (Subtotal)</p>
              <p className="text-base font-bold text-gray-900">{formatRupiah(data.totals.subtotal)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl border border-orange-100 p-4 text-center">
              <p className="text-xs text-orange-600 mb-1">Total Pajak</p>
              <p className="text-base font-bold text-orange-700">{formatRupiah(data.totals.taxAmount)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-center">
              <p className="text-xs text-blue-600 mb-1">Total Keseluruhan</p>
              <p className="text-base font-bold text-blue-700">{formatRupiah(data.totals.totalAmount)}</p>
            </div>
          </div>

          {/* By tax rate */}
          {data.byRate.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">Rincian Per Rate Pajak</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Rate', 'Jumlah Txn', 'DPP', 'Pajak', 'Total'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.byRate.map((r) => (
                    <tr key={r.taxRate} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          {r.taxRate}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{r.txnCount}</td>
                      <td className="px-4 py-2.5 text-gray-700">{formatRupiah(r.subtotal)}</td>
                      <td className="px-4 py-2.5 font-semibold text-orange-600">{formatRupiah(r.taxAmount)}</td>
                      <td className="px-4 py-2.5 font-bold text-blue-700">{formatRupiah(r.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Daily trend */}
          {data.daily.length === 0 ? (
            <EmptyState icon="🧾" title="Tidak ada transaksi" description="Ubah rentang tanggal" />
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">Rincian Harian</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Tanggal', 'DPP', 'Pajak', 'Total'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.daily.map((r) => (
                    <tr key={r.date} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{r.date}</td>
                      <td className="px-4 py-2.5 text-gray-700">{formatRupiah(r.subtotal)}</td>
                      <td className="px-4 py-2.5 font-semibold text-orange-600">{formatRupiah(r.taxAmount)}</td>
                      <td className="px-4 py-2.5 font-bold text-blue-700">{formatRupiah(r.totalAmount)}</td>
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
