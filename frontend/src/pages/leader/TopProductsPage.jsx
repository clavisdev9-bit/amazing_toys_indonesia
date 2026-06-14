import React, { useState, useEffect } from 'react';
import { getTopProducts } from '../../api/leader';
import { getTenants } from '../../api/tenants';
import { formatRupiah } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

function today() { return new Date().toISOString().split('T')[0]; }
function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

export default function TopProductsPage() {
  const [dateFrom,  setDateFrom]  = useState(monthStart());
  const [dateTo,    setDateTo]    = useState(today());
  const [tenantId,  setTenantId]  = useState('');
  const [tenants,   setTenants]   = useState([]);
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    getTenants().then((r) => setTenants(r.data.data ?? []));
  }, []);

  function fetch() {
    setLoading(true);
    const params = { date_from: dateFrom, date_to: dateTo };
    if (tenantId) params.tenant_id = tenantId;
    getTopProducts(params)
      .then((r) => setData(r.data.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetch(); }, []);

  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Top Produk Terlaris</h1>

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
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Tenant</label>
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Tenant</option>
            {tenants.map((t) => <option key={t.tenant_id} value={t.tenant_id}>{t.tenant_name}</option>)}
          </select>
        </div>
        <button onClick={fetch}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          Tampilkan
        </button>
      </div>

      {loading ? <Spinner /> : data.length === 0 ? (
        <EmptyState icon="🏷️" title="Tidak ada data produk" description="Ubah filter untuk melihat data lain" />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['#', 'Produk', 'Tenant', 'Kategori', 'Harga', 'Qty Terjual', 'Revenue'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((r) => {
                const pct = totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 100) : 0;
                return (
                  <tr key={r.productId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 font-mono text-xs w-8">
                      <span className={r.rank <= 3 ? 'font-bold text-yellow-500' : ''}>{r.rank}</span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900 text-xs">{r.productName}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{r.tenantName}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{r.category ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">{formatRupiah(r.price)}</td>
                    <td className="px-3 py-2 font-bold text-gray-900">{r.qtySold}</td>
                    <td className="px-3 py-2">
                      <p className="font-bold text-blue-700 text-xs whitespace-nowrap">{formatRupiah(r.revenue)}</p>
                      <p className="text-xs text-gray-400">{pct}%</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
