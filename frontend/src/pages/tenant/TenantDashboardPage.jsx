import React, { useState, useEffect } from 'react';
import { getTenantDashboard } from '../../api/tenantOrders';
import { formatRupiah } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Spinner from '../../components/ui/Spinner';

// Use local date (not UTC) to avoid timezone mismatch with WIB server
function today() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function TenantDashboardPage() {
  const { t } = useLang();
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTenantDashboard({ date })
      .then((r) => {
        const payload = r.data.data;
        // Backend nests stats under `summary` — flatten for easy access
        setData({ ...payload.summary, top_products: payload.topProducts });
      })
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">{t('tenantDash.title')}</h1>
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
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: t('tenantDash.revenue'), value: formatRupiah(data.revenue_today ?? 0), big: true },
              { label: t('tenantDash.orders'),  value: data.orders_today ?? 0 },
              { label: t('tenantDash.done'),    value: data.items_done ?? 0 },
              { label: t('tenantDash.pending'), value: data.items_pending ?? 0 },
            ].map((card) => (
              <div key={card.label} className={`bg-white rounded-xl border p-4 ${card.big ? 'col-span-2' : ''}`}>
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className={`font-bold text-gray-900 ${card.big ? 'text-2xl text-blue-700' : 'text-xl'}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {data.top_products?.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">{t('tenantDash.topProducts')}</div>
              <div className="divide-y">
                {data.top_products.map((p, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between text-sm">
                    <span className="text-gray-700">{p.product_name}</span>
                    <span className="font-semibold text-blue-700">{t('tenantDash.sold', { n: p.total_sold })}</span>
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
