import React, { useState, useEffect } from 'react';
import { getVoucherReport } from '../../api/leader';
import { formatRupiah } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

function today() { return new Date().toISOString().split('T')[0]; }
function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

export default function VoucherReportPage() {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo,   setDateTo]   = useState(today());
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  function fetch() {
    setLoading(true);
    getVoucherReport({ date_from: dateFrom, date_to: dateTo })
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetch(); }, []);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Laporan Penggunaan Voucher</h1>

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
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-purple-50 rounded-xl border border-purple-100 p-4 text-center">
              <p className="text-xs text-purple-600 mb-1">Total Pemakaian Voucher</p>
              <p className="text-2xl font-bold text-purple-700">{data.summary.totalUsage}</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-100 p-4 text-center">
              <p className="text-xs text-red-600 mb-1">Total Diskon Diberikan</p>
              <p className="text-2xl font-bold text-red-700">{formatRupiah(data.summary.totalDiscount)}</p>
            </div>
          </div>

          {data.vouchers.length === 0 ? (
            <EmptyState icon="🎟️" title="Tidak ada voucher dipakai" description="Ubah rentang tanggal" />
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">Detail Per Voucher</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Kode', 'Deskripsi', 'Tipe', 'Nilai', 'Pemakaian', 'Total Diskon'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.vouchers.map((v) => (
                    <tr key={v.code} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs font-bold text-purple-700">{v.code}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{v.description ?? '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          v.discountType === 'PERCENT'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {v.discountType === 'PERCENT' ? `${v.discountValue}%` : formatRupiah(v.discountValue)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {v.discountType === 'PERCENT' ? `${v.discountValue}%` : formatRupiah(v.discountValue)}
                      </td>
                      <td className="px-3 py-2 font-bold text-gray-900">{v.usageCount}x</td>
                      <td className="px-3 py-2 font-bold text-red-600">{formatRupiah(v.totalDiscount)}</td>
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
