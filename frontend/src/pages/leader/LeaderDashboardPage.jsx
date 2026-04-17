import React, { useState, useEffect } from 'react';
import { getLeaderDashboard } from '../../api/leader';
import { formatRupiah, formatDateOnly } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';

function today() { return new Date().toISOString().split('T')[0]; }

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function LeaderDashboardPage() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getLeaderDashboard({ date })
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard KPI</h1>
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? <Spinner /> : data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Total Pendapatan"
              value={formatRupiah(data.summary?.total_revenue ?? 0)}
            />
            <StatCard
              label="Transaksi Lunas"
              value={data.summary?.paid_count ?? 0}
            />
            <StatCard
              label="Menunggu Bayar"
              value={data.summary?.pending_count ?? 0}
            />
            <StatCard
              label="Pengunjung Unik"
              value={data.uniqueVisitors ?? 0}
            />
          </div>

          {/* Payment Breakdown */}
          {data.paymentBreakdown?.length > 0 && (
            <div className="bg-white rounded-xl border p-4 mb-4">
              <h2 className="font-semibold text-gray-700 mb-3 text-sm">Metode Pembayaran</h2>
              <div className="space-y-2">
                {data.paymentBreakdown.map((pb) => {
                  const total = data.paymentBreakdown.reduce((s, x) => s + parseInt(x.amount || 0), 0);
                  const pct = total ? Math.round((parseInt(pb.amount) / total) * 100) : 0;
                  return (
                    <div key={pb.payment_method}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="text-gray-600">{pb.payment_method} ({pb.count} txn)</span>
                        <span className="font-semibold">{formatRupiah(pb.amount)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Tenants */}
          {data.topTenants?.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">Top Tenant</div>
              <div className="divide-y">
                {data.topTenants.map((t, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-mono w-5">#{i + 1}</span>
                      <span className="text-gray-800 font-medium">{t.tenant_name}</span>
                    </div>
                    <span className="font-bold text-blue-700">{formatRupiah(t.revenue ?? t.total_revenue ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
