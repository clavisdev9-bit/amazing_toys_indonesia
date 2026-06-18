import { useState, useEffect, useRef } from 'react';
import { getAdminProducts, getAdminTenants } from '../../api/admin';
import { formatRupiah } from '../../utils/format';
import { exportToExcel } from '../../utils/exportExcel';
import { usePublicConfig } from '../../hooks/useAppLogo';
import Spinner from '../../components/ui/Spinner';

function printDate() {
  return new Date().toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function MasterDataPrintPage() {
  const config    = usePublicConfig();
  const eventName = config?.event_name || 'Amazing Toys Fair 2026';

  const [tenants,  setTenants]  = useState([]);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  // Filter state (no-print)
  const [filterTenant, setFilterTenant] = useState('ALL');
  const [filterActive, setFilterActive] = useState('active');   // active | all
  const [groupByBooth, setGroupByBooth] = useState(true);

  const printedAt = useRef(printDate());

  useEffect(() => {
    Promise.all([
      getAdminTenants({ include_inactive: 'true' }),
      getAdminProducts({ limit: 2000, includeInactive: true }),
    ]).then(([tRes, pRes]) => {
      setTenants(tRes.data.data ?? []);
      setProducts(pRes.data.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────

  const filtered = products.filter((p) => {
    if (filterTenant !== 'ALL' && p.tenant_id !== filterTenant) return false;
    if (filterActive === 'active' && !p.is_active) return false;
    return true;
  });

  const tenantMap = Object.fromEntries(tenants.map((t) => [t.tenant_id, t]));

  // Group by booth or flat list
  const groups = (() => {
    if (!groupByBooth) return [{ tenant: null, rows: filtered }];
    const map = {};
    filtered.forEach((p) => {
      if (!map[p.tenant_id]) map[p.tenant_id] = [];
      map[p.tenant_id].push(p);
    });
    return Object.entries(map).map(([tid, rows]) => ({
      tenant: tenantMap[tid],
      rows,
    }));
  })();

  const grandTotal = filtered.reduce((s, p) => s + Number(p.price) * p.stock_quantity, 0);

  function handleExportExcel() {
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `MasterData_Produk_${dateStr}`;

    if (groupByBooth && groups.length > 1) {
      // Satu sheet per booth + satu sheet summary
      const sheets = groups.map(({ tenant, rows }) => ({
        name: tenant ? `${tenant.tenant_id}` : 'Semua',
        rows: rows.map((p, i) => ({
          'No': i + 1,
          'Nama Produk': p.product_name,
          'Kategori': p.category || '',
          'Barcode': p.barcode || '',
          'Harga': Number(p.price),
          'Qty': p.stock_quantity,
          'Nilai Stok': Number(p.price) * p.stock_quantity,
          'Status': p.is_active ? 'Aktif' : 'Nonaktif',
          'Pre-Order': p.is_preorder ? 'Ya' : 'Tidak',
          'Booth': tenant?.tenant_name || '',
        })),
      }));
      // Summary sheet
      sheets.push({
        name: 'Summary',
        rows: groups.map(({ tenant, rows: rs }) => ({
          'Booth': tenant?.tenant_name || 'Semua',
          'Booth ID': tenant?.tenant_id || '',
          'Jumlah Produk': rs.length,
          'Total Qty': rs.reduce((s, p) => s + p.stock_quantity, 0),
          'Total Nilai Stok': rs.reduce((s, p) => s + Number(p.price) * p.stock_quantity, 0),
        })),
      });
      exportToExcel(filename, sheets);
    } else {
      // Satu sheet flat
      exportToExcel(filename, [{
        name: 'Produk',
        rows: filtered.map((p, i) => ({
          'No': i + 1,
          'Nama Produk': p.product_name,
          'Booth': tenantMap[p.tenant_id]?.tenant_name || p.tenant_id || '',
          'Kategori': p.category || '',
          'Barcode': p.barcode || '',
          'Harga': Number(p.price),
          'Qty': p.stock_quantity,
          'Nilai Stok': Number(p.price) * p.stock_quantity,
          'Status': p.is_active ? 'Aktif' : 'Nonaktif',
          'Pre-Order': p.is_preorder ? 'Ya' : 'Tidak',
        })),
      }]);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return <div className="p-8"><Spinner /></div>;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          body { font-size: 11px; color: #000; }
          @page { size: A4; margin: 12mm 10mm; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 4px 6px; }
          thead { background: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
          .booth-header { background: #e0f2fe !important; -webkit-print-color-adjust: exact; }
        }
        @media screen {
          body { background: #e5e7eb; }
          .paper { background: white; max-width: 900px; margin: 0 auto;
                   box-shadow: 0 2px 12px rgba(0,0,0,.15); }
        }
      `}</style>

      {/* ── Toolbar (screen only) ── */}
      <div className="no-print sticky top-0 z-10 bg-white border-b shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => window.close()}
          className="text-xs text-gray-500 hover:text-gray-800 border rounded px-2 py-1">
          ← Tutup
        </button>
        <span className="text-sm font-semibold text-gray-700 flex-1">Cetak Master Data Produk</span>

        {/* Filter tenant */}
        <select
          value={filterTenant}
          onChange={(e) => setFilterTenant(e.target.value)}
          className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="ALL">Semua Booth</option>
          {tenants.map((t) => (
            <option key={t.tenant_id} value={t.tenant_id}>
              {t.tenant_id} – {t.tenant_name}
            </option>
          ))}
        </select>

        {/* Filter status */}
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="active">Aktif saja</option>
          <option value="all">Semua (termasuk nonaktif)</option>
        </select>

        {/* Group toggle */}
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={groupByBooth}
            onChange={(e) => setGroupByBooth(e.target.checked)}
            className="w-3.5 h-3.5 accent-blue-600"
          />
          Kelompokkan per booth
        </label>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">
          📊 Export Excel
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
          🖨️ Cetak / Simpan PDF
        </button>
      </div>

      {/* ── Print paper ── */}
      <div className="paper p-8">

        {/* Document header */}
        <div className="text-center mb-6 border-b pb-4">
          <p className="text-xl font-bold uppercase tracking-wide">{eventName}</p>
          <p className="text-base font-semibold mt-0.5">DAFTAR MASTER DATA PRODUK</p>
          <p className="text-xs text-gray-500 mt-1">
            Dicetak: {printedAt.current}
            {filterTenant !== 'ALL' && ` · Booth: ${tenantMap[filterTenant]?.tenant_name ?? filterTenant}`}
            {' '}· {filtered.length} produk
          </p>
        </div>

        {/* ── Groups ── */}
        {groups.map(({ tenant, rows }, gi) => (
          <div key={tenant?.tenant_id ?? 'all'} className={gi > 0 ? 'mt-8' : ''}>

            {/* Booth header */}
            {tenant && (
              <div className="booth-header bg-sky-50 border border-sky-200 rounded-t px-3 py-2 flex items-center justify-between">
                <div>
                  <span className="font-bold text-sky-800 text-sm">{tenant.tenant_name}</span>
                  <span className="ml-2 font-mono text-xs text-sky-600">{tenant.tenant_id}</span>
                  {tenant.booth_location && (
                    <span className="ml-2 text-xs text-sky-600">· {tenant.booth_location}</span>
                  )}
                </div>
                <span className="text-xs text-sky-700 font-medium">{rows.length} produk</span>
              </div>
            )}

            {/* Table */}
            <div className={tenant ? 'border border-t-0 rounded-b overflow-hidden' : 'border rounded overflow-hidden'}>
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8">#</th>
                    <th className="px-2 py-1.5 text-left">Nama Produk</th>
                    <th className="px-2 py-1.5 text-left w-28">Kategori</th>
                    <th className="px-2 py-1.5 text-left w-32">Barcode</th>
                    <th className="px-2 py-1.5 text-right w-28">Harga</th>
                    <th className="px-2 py-1.5 text-right w-16">Qty</th>
                    <th className="px-2 py-1.5 text-right w-32">Nilai Stok</th>
                    <th className="px-2 py-1.5 text-center w-16">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, i) => (
                    <tr key={p.product_id}
                      className={`border-t ${!p.is_active ? 'opacity-50' : i % 2 === 1 ? 'bg-gray-50' : ''}`}>
                      <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-2 py-1.5 font-medium text-gray-900">
                        {p.product_name}
                        {p.is_preorder && (
                          <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1 rounded">PO</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600">{p.category}</td>
                      <td className="px-2 py-1.5 font-mono text-gray-500">{p.barcode}</td>
                      <td className="px-2 py-1.5 text-right font-medium">{formatRupiah(p.price)}</td>
                      <td className={`px-2 py-1.5 text-right font-bold
                        ${p.stock_quantity === 0 ? 'text-red-600' : p.stock_quantity <= 5 ? 'text-amber-600' : 'text-gray-800'}`}>
                        {p.stock_quantity}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-600">
                        {formatRupiah(Number(p.price) * p.stock_quantity)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold
                          ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {p.is_active ? 'Aktif' : 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Subtotal per group */}
                <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-2 py-1.5 text-xs font-semibold text-gray-600 text-right">
                      Subtotal {tenant ? tenant.tenant_name : 'Semua'}:
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-gray-800">
                      {rows.reduce((s, p) => s + p.stock_quantity, 0)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-blue-700">
                      {formatRupiah(rows.reduce((s, p) => s + Number(p.price) * p.stock_quantity, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}

        {/* Grand total */}
        {groupByBooth && groups.length > 1 && (
          <div className="mt-4 border-t-2 border-gray-700 pt-3 flex justify-end gap-8 text-sm">
            <span className="font-bold text-gray-700">Grand Total ({filtered.length} produk):</span>
            <span className="font-bold text-blue-700 text-base">{formatRupiah(grandTotal)}</span>
          </div>
        )}

        {/* Print footer */}
        <div className="mt-8 pt-4 border-t text-xs text-gray-400 flex justify-between">
          <span>{eventName} — Sistem Operasional Stand</span>
          <span>Halaman ini dicetak otomatis oleh sistem</span>
        </div>
      </div>
    </>
  );
}
