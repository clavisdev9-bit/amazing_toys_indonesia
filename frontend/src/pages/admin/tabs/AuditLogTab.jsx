import React, { useState, useEffect, useCallback } from 'react';
import { getAuditLog } from '../../../api/admin';
import { formatDate } from '../../../utils/format';
import Spinner from '../../../components/ui/Spinner';
import EmptyState from '../../../components/ui/EmptyState';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';

const ENTITY_TYPES = ['TRANSACTION', 'PRODUCT', 'USER', 'PAYMENT', 'ORDER'];
const ACTOR_ROLES  = ['CUSTOMER', 'CASHIER', 'TENANT', 'LEADER', 'SYSTEM'];

const roleBadge = {
  CUSTOMER: 'bg-purple-100 text-purple-700',
  CASHIER:  'bg-blue-100 text-blue-700',
  TENANT:   'bg-orange-100 text-orange-700',
  LEADER:   'bg-green-100 text-green-700',
  SYSTEM:   'bg-gray-100 text-gray-600',
};

export default function AuditLogTab() {
  const [logs, setLogs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const [detail, setDetail]     = useState(null);

  const [filters, setFilters] = useState({
    entity_type: '', actor_role: '', search: '', date_from: '', date_to: '',
  });

  const limit = 50;

  const fetchLogs = useCallback(() => {
    setLoading(true);
    getAuditLog({
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      page,
      limit,
    })
      .then((r) => {
        setLogs(r.data.data?.items ?? []);
        setTotal(r.data.data?.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function applyFilters(e) {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  }

  function clearFilters() {
    setFilters({ entity_type: '', actor_role: '', search: '', date_from: '', date_to: '' });
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 text-white mb-4">
        <span className="text-base">📋</span>
        <h2 className="text-sm font-semibold flex-1">Monitor Aktivitas</h2>
        <span className="text-xs text-emerald-100">{total.toLocaleString('id-ID')} entri</span>
      </div>

      {/* Filter bar */}
      <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Cari</label>
          <input type="text" placeholder="Action / Entity ID..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Entity Type</label>
          <select value={filters.entity_type}
            onChange={(e) => setFilters((f) => ({ ...f, entity_type: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Semua</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Actor Role</label>
          <select value={filters.actor_role}
            onChange={(e) => setFilters((f) => ({ ...f, actor_role: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Semua</option>
            {ACTOR_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Dari Tanggal</label>
          <input type="date" value={filters.date_from}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Sampai Tanggal</label>
          <input type="date" value={filters.date_to}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <Button type="submit" size="sm">Terapkan</Button>
        <button type="button" onClick={clearFilters}
          className="text-sm text-gray-500 hover:text-gray-700 underline">Reset</button>
      </form>

      <p className="text-xs text-gray-400 mb-3">Halaman {page} / {totalPages || 1}</p>

      {loading ? <Spinner /> : logs.length === 0 ? (
        <EmptyState icon="📋" title="Tidak ada log ditemukan" />
      ) : (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['#','Waktu','Action','Actor','Role','Entity Type','Entity ID','Detail'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.log_id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{log.log_id}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs font-medium text-gray-800">{log.action}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">
                        {log.actor_name || log.actor_username || (
                          <span className="font-mono text-gray-400">{log.actor_id.slice(0, 8)}…</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge[log.actor_role] || 'bg-gray-100 text-gray-500'}`}>
                          {log.actor_role}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{log.entity_type}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-gray-500">{log.entity_id}</td>
                      <td className="px-3 py-2.5">
                        {(log.old_value || log.new_value) && (
                          <button onClick={() => setDetail(log)}
                            className="px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100">
                            Lihat
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 mt-4 justify-center">
              <Button size="sm" variant="secondary" disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}>← Prev</Button>
              <span className="text-sm text-gray-600">{page} / {totalPages}</span>
              <Button size="sm" variant="secondary" disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}>Next →</Button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Log #${detail?.log_id} — ${detail?.action}`}>
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-400">Actor:</span> <span className="font-medium">{detail.actor_name || detail.actor_id}</span></div>
              <div><span className="text-gray-400">Role:</span> <span className="font-medium">{detail.actor_role}</span></div>
              <div><span className="text-gray-400">Entity:</span> <span className="font-medium">{detail.entity_type} / {detail.entity_id}</span></div>
              <div><span className="text-gray-400">IP:</span> <span className="font-mono">{detail.ip_address || '—'}</span></div>
            </div>
            {detail.old_value && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Sebelum:</p>
                <pre className="bg-red-50 rounded-lg p-3 text-xs overflow-auto max-h-40 text-red-800 whitespace-pre-wrap">
                  {JSON.stringify(detail.old_value, null, 2)}
                </pre>
              </div>
            )}
            {detail.new_value && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Sesudah:</p>
                <pre className="bg-green-50 rounded-lg p-3 text-xs overflow-auto max-h-40 text-green-800 whitespace-pre-wrap">
                  {JSON.stringify(detail.new_value, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
