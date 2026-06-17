import React, { useState, useEffect } from 'react';
import { getTenantRanking } from '../../api/leader';
import { formatRupiah } from '../../utils/format';
import { exportToExcel } from '../../utils/exportExcel';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

function today() { return new Date().toISOString().split('T')[0]; }
function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

export default function TenantRankingPage() {
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo,   setDateTo]   = useState(today());
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  function fetch() {
    setLoading(true);
    getTenantRanking({ date_from: dateFrom, date_to: dateTo })
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetch(); }, []);

  const maxRevenue = data?.rows?.[0]?.revenue ?? 1;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Ranking Revenue Tenant</h1>

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

      {data && (
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 mb-4 flex gap-6">
          <div className="text-center">
            <p className="text-xs text-blue-500 mb-0.5">Total Revenue</p>
            <p className="text-xl font-bold text-blue-700">{formatRupiah(data.totalRevenue)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-blue-500 mb-0.5">Jumlah Tenant Aktif</p>
            <p className="text-xl font-bold text-blue-700">{data.rows.length}</p>
          </div>
        </div>
      )}

      {!loading && data?.rows?.length > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => exportToExcel(`Ranking_Tenant_${dateFrom}_${dateTo}`, [{
              name: 'Ranking Tenant',
              rows: data.rows.map((t) => ({
                'Rank': t.rank,
                'Nama Tenant': t.tenantName,
                'Booth': t.boothLocation ?? '-',
                'Revenue': t.revenue,
                'Transaksi': t.totalTransaksi,
                'Total Item': t.totalItem,
                'Avg Order': t.avgOrderValue,
                '% dari Total': data.totalRevenue > 0 ? Math.round((t.revenue / data.totalRevenue) * 100) : 0,
              })),
            }])}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 flex items-center gap-1"
          >
            ⬇ Export Excel
          </button>
        </div>
      )}

      {loading ? <Spinner /> : !data || data.rows.length === 0 ? (
        <EmptyState icon="🏆" title="Tidak ada data" description="Ubah rentang tanggal" />
      ) : (
        <div className="space-y-2">
          {data.rows.map((t) => {
            const pct = data.totalRevenue > 0 ? Math.round((t.revenue / data.totalRevenue) * 100) : 0;
            return (
              <div key={t.tenantId} className="bg-white rounded-xl border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold w-8 text-center ${
                      t.rank === 1 ? 'text-yellow-500' :
                      t.rank === 2 ? 'text-gray-400' :
                      t.rank === 3 ? 'text-amber-600' : 'text-gray-400'
                    }`}>#{t.rank}</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.tenantName}</p>
                      {t.boothLocation && (
                        <p className="text-xs text-gray-400">Booth {t.boothLocation}</p>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-blue-700 text-sm">{formatRupiah(t.revenue)}</p>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full mb-2">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>{t.totalTransaksi} transaksi</span>
                  <span>{t.totalItem} item</span>
                  <span>Avg {formatRupiah(t.avgOrderValue)}</span>
                  <span className="ml-auto font-medium text-gray-700">{pct}% dari total</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
