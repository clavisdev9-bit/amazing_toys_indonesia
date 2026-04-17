import React, { useState, useEffect } from 'react';
import { getSalesReport } from '../../api/leader';
import { getTenants } from '../../api/tenants';
import { formatRupiah, formatDate } from '../../utils/format';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

function today() { return new Date().toISOString().split('T')[0]; }
function weekAgo() {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

export default function SalesReportPage() {
  const [startDate, setStartDate] = useState(weekAgo());
  const [endDate, setEndDate] = useState(today());
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTenants().then((r) => setTenants(r.data.data ?? []));
  }, []);

  function fetchSales() {
    setLoading(true);
    const params = { start_date: startDate, end_date: endDate };
    if (tenantId) params.tenant_id = tenantId;
    getSalesReport(params)
      .then((r) => setSales(r.data.data?.items ?? r.data.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchSales(); }, []);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Laporan Penjualan</h1>

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
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Tenant</label>
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Semua Tenant</option>
            {tenants.map((t) => <option key={t.tenant_id} value={t.tenant_id}>{t.tenant_name}</option>)}
          </select>
        </div>
        <Button onClick={fetchSales} loading={loading}>Tampilkan</Button>
      </div>

      {loading ? <Spinner /> : sales.length === 0 ? (
        <EmptyState icon="📊" title="Tidak ada data" description="Ubah filter untuk melihat data lain" />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['ID Transaksi', 'Tanggal', 'Pelanggan', 'Total', 'Metode', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.map((row) => (
                  <tr key={row.transaction_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-gray-900">{row.transaction_id}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="px-3 py-2 text-gray-700">{row.customer_name}</td>
                    <td className="px-3 py-2 font-semibold text-blue-700 whitespace-nowrap">{formatRupiah(row.total_amount)}</td>
                    <td className="px-3 py-2 text-gray-600">{row.payment_method ?? '-'}</td>
                    <td className="px-3 py-2"><Badge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
