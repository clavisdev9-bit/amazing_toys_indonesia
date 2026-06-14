import { useState, useEffect, useCallback } from 'react';
import { getDataHealth } from '../../../api/dataHealth';

// ── Status badge ──────────────────────────────────────────────────────────────
function Badge({ status, label }) {
  const styles = {
    OK:      'bg-emerald-100 text-emerald-700 border border-emerald-200',
    WARNING: 'bg-amber-100  text-amber-700  border border-amber-200',
    ERROR:   'bg-red-100    text-red-700    border border-red-200',
    EMPTY:   'bg-gray-100   text-gray-500   border border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? styles.EMPTY}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'OK' ? 'bg-emerald-500' : status === 'WARNING' ? 'bg-amber-500' : status === 'ERROR' ? 'bg-red-500' : 'bg-gray-400'
      }`} />
      {label}
    </span>
  );
}

// ── Category chip ─────────────────────────────────────────────────────────────
function CategoryChip({ type }) {
  return type === 'WAJIB'
    ? <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Wajib</span>
    : <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-violet-100 text-violet-700 border border-violet-200">Nice to Have</span>;
}

// ── Build rows from API data ───────────────────────────────────────────────────
function buildRows(d) {
  if (!d) return [];
  return [
    {
      id:       1,
      icon:     '👤',
      data:     'Customer',
      kategori: 'WAJIB',
      total:    d.customers_total,
      keterangan: 'Data customer terdaftar — dibutuhkan untuk troubleshoot login & OTP',
      status:   d.customers_total > 0 ? 'OK' : 'WARNING',
      statusLabel: d.customers_total > 0 ? 'OK' : 'Kosong',
      detail:   `${d.customers_total} customer`,
      navTab:   'audit-log',
    },
    {
      id:       2,
      icon:     '🛒',
      data:     'Order / Transaksi',
      kategori: 'WAJIB',
      total:    d.orders_total,
      keterangan: 'Semua transaksi — audit trail untuk dispute & refund',
      status:   d.orders_total > 0 ? 'OK' : 'WARNING',
      statusLabel: d.orders_total > 0 ? 'OK' : 'Kosong',
      detail:   `${d.orders_active} aktif · ${d.orders_paid} selesai`,
      navTab:   'audit-log',
    },
    {
      id:       3,
      icon:     '📦',
      data:     'Stok Produk',
      kategori: 'WAJIB',
      total:    d.products_active,
      keterangan: 'Produk aktif + unit tersedia di booth',
      status:   d.products_active > 0 ? 'OK' : 'ERROR',
      statusLabel: d.products_active > 0 ? 'OK' : 'Kritis',
      detail:   `${(d.stock_total ?? 0).toLocaleString('id')} unit tersedia`,
      navTab:   'master-data',
    },
    {
      id:       4,
      icon:     '🏷️',
      data:     'Staff Aktif',
      kategori: 'WAJIB',
      total:    d.staff_active,
      keterangan: 'Helper & cashier yang dapat login dan beroperasi',
      status:   d.staff_active > 0 ? 'OK' : 'ERROR',
      statusLabel: d.staff_active > 0 ? 'OK' : 'Kritis',
      detail:   `${d.staff_active} user aktif`,
      navTab:   'user-role',
    },
    {
      id:       5,
      icon:     '💬',
      data:     'WA Delivery Log',
      kategori: 'WAJIB',
      total:    d.wa_sent,
      keterangan: 'Log pengiriman notifikasi WhatsApp ke customer',
      status:   d.wa_failed > 0 ? 'ERROR' : d.wa_sent > 0 ? 'OK' : 'WARNING',
      statusLabel: d.wa_failed > 0 ? `${d.wa_failed} Gagal` : d.wa_sent > 0 ? 'OK' : 'Belum Ada',
      detail:   `${d.wa_sent} terkirim${d.wa_failed > 0 ? ` · ${d.wa_failed} gagal` : ''}`,
      navTab:   'wa-gateway',
    },
    {
      id:       6,
      icon:     '🔄',
      data:     'Odoo Sync Log',
      kategori: 'WAJIB',
      total:    d.odoo_sync_total,
      keterangan: 'Riwayat sinkronisasi stok & produk ke Odoo 18',
      status:   d.odoo_sync_error > 0 ? 'WARNING' : d.odoo_sync_total > 0 ? 'OK' : 'WARNING',
      statusLabel: d.odoo_sync_error > 0 ? `${d.odoo_sync_error} Error` : d.odoo_sync_total > 0 ? 'OK' : 'Belum Ada',
      detail:   `${d.odoo_sync_total} record${d.odoo_sync_error > 0 ? ` · ${d.odoo_sync_error} error` : ''}`,
      navTab:   'integration',
    },
    {
      id:       7,
      icon:     '💳',
      data:     'Payment Log',
      kategori: 'WAJIB',
      total:    d.payments_qris,
      keterangan: 'Transaksi QRIS — bukti pembayaran untuk rekonsiliasi kas',
      status:   d.payments_qris > 0 ? 'OK' : 'WARNING',
      statusLabel: d.payments_qris > 0 ? 'OK' : 'Belum Ada',
      detail:   `${d.payments_qris} transaksi QRIS`,
      navTab:   'integration',
    },
    {
      id:       8,
      icon:     '🎟️',
      data:     'Voucher Usage',
      kategori: 'NICE',
      total:    d.voucher_usages,
      keterangan: 'Pemakaian voucher — deteksi potensi abuse diskon',
      status:   'OK',
      statusLabel: 'OK',
      detail:   `${d.voucher_usages} penggunaan`,
      navTab:   'voucher',
    },
    {
      id:       9,
      icon:     '🚫',
      data:     'Login Diblokir',
      kategori: 'NICE',
      total:    d.blocked_logins,
      keterangan: 'Customer yang login-nya terkunci karena terlalu banyak percobaan gagal',
      status:   d.blocked_logins > 0 ? 'WARNING' : 'OK',
      statusLabel: d.blocked_logins > 0 ? `${d.blocked_logins} Diblokir` : 'Aman',
      detail:   d.blocked_logins > 0 ? `${d.blocked_logins} nomor terkunci` : 'Tidak ada blokir aktif',
      navTab:   'audit-log',
    },
  ];
}

// ── Filter constants ──────────────────────────────────────────────────────────
const STATUS_OPTIONS  = ['Semua Status', 'OK', 'WARNING', 'ERROR'];
const KATEGORI_OPTIONS = ['Semua Kategori', 'WAJIB', 'NICE'];

export default function DataHealthTab() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus]   = useState('Semua Status');
  const [filterKategori, setFilterKategori] = useState('Semua Kategori');
  const [selected, setSelected] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDataHealth();
      if (res.data?.success) { setData(res.data.data); setLastFetch(new Date()); }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const rows = buildRows(data);

  const filtered = rows.filter((r) => {
    const matchSearch   = !search || r.data.toLowerCase().includes(search.toLowerCase()) || r.keterangan.toLowerCase().includes(search.toLowerCase());
    const matchStatus   = filterStatus   === 'Semua Status'   || r.status   === filterStatus;
    const matchKategori = filterKategori === 'Semua Kategori' || r.kategori === filterKategori;
    return matchSearch && matchStatus && matchKategori;
  });

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.includes(r.id));

  function toggleAll() {
    if (allChecked) setSelected([]);
    else setSelected(filtered.map((r) => r.id));
  }

  function toggleOne(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const countOk    = rows.filter((r) => r.status === 'OK').length;
  const countWarn  = rows.filter((r) => r.status === 'WARNING').length;
  const countErr   = rows.filter((r) => r.status === 'ERROR').length;

  return (
    <div>
      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Data',    value: rows.length,  color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
          { label: 'Status OK',     value: countOk,      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Perlu Perhatian', value: countWarn,  color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
          { label: 'Kritis',        value: countErr,     color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100' },
        ].map((c) => (
          <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl px-4 py-3`}>
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <p className="text-sm text-gray-500 shrink-0">Cari data:</p>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Cari nama data atau keterangan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Kategori filter */}
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {KATEGORI_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>

          {/* Refresh */}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors ml-auto"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ── Table header info ──────────────────────────────────────────────── */}
        {selected.length > 0 && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-3 text-sm">
            <span className="text-blue-700 font-medium">{selected.length} item dipilih</span>
            <button onClick={() => setSelected([])} className="text-blue-500 hover:text-blue-700 underline">Batalkan</button>
          </div>
        )}

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-10 px-4 py-3 text-left">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">No</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Kategori</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Detail</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && !data ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Memuat data...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Tidak ada data yang cocok dengan filter.
                  </td>
                </tr>
              ) : filtered.map((row) => (
                <tr key={row.id}
                  className={`transition-colors hover:bg-blue-50/40 ${selected.includes(row.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleOne(row.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{String(row.id).padStart(2, '0')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{row.icon}</span>
                      <span className="font-semibold text-gray-800">{row.data}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryChip type={row.kategori} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-gray-900 text-base tabular-nums">
                      {data ? row.total.toLocaleString('id') : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={row.status} label={row.statusLabel} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{data ? row.detail : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">{row.keterangan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>Menampilkan {filtered.length} dari {rows.length} data</span>
          {lastFetch && (
            <span>
              Terakhir diperbarui: {lastFetch.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
