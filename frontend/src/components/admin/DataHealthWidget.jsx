import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDataHealth } from '../../api/dataHealth';

function HealthRow({ icon, label, value, status, sub, onClick }) {
  const dot =
    status === 'ok'   ? 'bg-green-400' :
    status === 'warn' ? 'bg-amber-400' :
    status === 'err'  ? 'bg-red-400'   : 'bg-gray-300';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 py-1 px-1 rounded hover:bg-white hover:shadow-sm transition-all text-left group"
    >
      <span className="text-sm leading-none w-4 text-center shrink-0">{icon}</span>
      <span className="flex-1 text-xs text-gray-600 leading-tight truncate group-hover:text-blue-600">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {sub != null && (
          <span className="text-[10px] text-gray-400">{sub}</span>
        )}
        <span className="text-xs font-semibold text-gray-700 tabular-nums w-8 text-right">
          {value ?? '—'}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      </div>
    </button>
  );
}

export default function DataHealthWidget() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDataHealth();
      if (res.data?.success) {
        setData(res.data.data);
        setLastFetch(new Date());
      }
    } catch {
      // silent — widget non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const go = (tab) => navigate(`/admin?tab=${tab}`);

  const d = data;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data Health</span>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="px-2 pb-2.5">
        {/* Wajib */}
        <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-widest mt-1 mb-0.5 px-1">Wajib</p>

        <HealthRow
          icon="👤" label="Customer" value={d?.customers_total}
          status={d ? (d.customers_total > 0 ? 'ok' : 'warn') : null}
          onClick={() => go('audit-log')}
        />
        <HealthRow
          icon="🛒" label="Order" value={d?.orders_total}
          status={d ? (d.orders_total > 0 ? 'ok' : 'warn') : null}
          sub={d ? `${d.orders_active} aktif` : null}
          onClick={() => go('audit-log')}
        />
        <HealthRow
          icon="📦" label="Stok Produk" value={d?.products_active}
          status={d ? (d.products_active > 0 ? 'ok' : 'err') : null}
          sub={d ? `${(d.stock_total ?? 0).toLocaleString('id')} unit` : null}
          onClick={() => go('master-data')}
        />
        <HealthRow
          icon="🏷️" label="Staff Aktif" value={d?.staff_active}
          status={d ? (d.staff_active > 0 ? 'ok' : 'err') : null}
          onClick={() => go('user-role')}
        />
        <HealthRow
          icon="💬" label="WA Terkirim" value={d?.wa_sent}
          status={d ? (d.wa_failed > 0 ? 'err' : d.wa_sent > 0 ? 'ok' : 'warn') : null}
          sub={d?.wa_failed > 0 ? `${d.wa_failed} gagal` : null}
          onClick={() => go('wa-gateway')}
        />
        <HealthRow
          icon="🔄" label="Odoo Sync" value={d?.odoo_sync_total}
          status={d ? (d.odoo_sync_error > 0 ? 'warn' : d.odoo_sync_total > 0 ? 'ok' : 'warn') : null}
          sub={d?.odoo_sync_error > 0 ? `${d.odoo_sync_error} error` : null}
          onClick={() => go('integration')}
        />
        <HealthRow
          icon="💳" label="Payment QRIS" value={d?.payments_qris}
          status={d ? (d.payments_qris > 0 ? 'ok' : 'warn') : null}
          onClick={() => go('integration')}
        />

        {/* Nice to have */}
        <p className="text-[9px] font-semibold text-violet-400 uppercase tracking-widest mt-2 mb-0.5 px-1">Tambahan</p>
        <HealthRow
          icon="🎟️" label="Voucher Dipakai" value={d?.voucher_usages}
          status={d ? 'ok' : null}
          onClick={() => go('voucher')}
        />
        <HealthRow
          icon="🚫" label="Login Diblokir" value={d?.blocked_logins}
          status={d ? (d.blocked_logins > 0 ? 'warn' : 'ok') : null}
          onClick={() => go('audit-log')}
        />
      </div>

      {lastFetch && (
        <div className="px-3 pb-2 text-[9px] text-gray-300 text-right">
          {lastFetch.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}
    </div>
  );
}
