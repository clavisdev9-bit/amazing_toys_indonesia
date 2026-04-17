import React, { useState } from 'react';
import { getLaporanProduk, getLaporanHarian } from '../../api/tenantOrders';
import { useLang } from '../../context/LangContext';
import Spinner from '../../components/ui/Spinner';

// ── Date helpers ──────────────────────────────────────────────────────────────

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

const idr = new Intl.NumberFormat('id-ID');

function formatIDR(n) { return idr.format(n); }

function formatReportDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function EmptyRow({ colSpan, label }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-gray-400">
        {label}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LaporanHarianPage() {
  const { t } = useLang();
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo,   setDateTo]   = useState(localToday());
  const [dateError, setDateError] = useState('');

  const [produkData,  setProdukData]  = useState(null);
  const [harianData,  setHarianData]  = useState(null);
  const [tenantName,  setTenantName]  = useState('');
  const [loadProduk,  setLoadProduk]  = useState(false);
  const [loadHarian,  setLoadHarian]  = useState(false);

  function handleFetch(e) {
    e.preventDefault();
    if (dateFrom > dateTo) {
      setDateError(t('laporan.dateError'));
      return;
    }
    setDateError('');

    const params = { date_from: dateFrom, date_to: dateTo };

    setLoadProduk(true);
    getLaporanProduk(params)
      .then((r) => {
        setTenantName(r.data.data.tenantName);
        setProdukData(r.data.data.items);
      })
      .finally(() => setLoadProduk(false));

    setLoadHarian(true);
    getLaporanHarian(params)
      .then((r) => setHarianData(r.data.data))
      .finally(() => setLoadHarian(false));
  }

  const totalQty     = produkData?.reduce((s, r) => s + r.qtySold, 0) ?? 0;
  const totalRevProd = produkData?.reduce((s, r) => s + r.total,   0) ?? 0;

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Header + Filter ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <h1 className="text-xl font-bold text-gray-900 sm:mr-auto">{t('laporan.title')}</h1>

        <form onSubmit={handleFetch} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">{t('laporan.from')}</label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => { setDateFrom(e.target.value); setDateError(''); }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">{t('laporan.to')}</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={localToday()}
              onChange={(e) => { setDateTo(e.target.value); setDateError(''); }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t('laporan.show')}
          </button>
        </form>
      </div>

      {dateError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {dateError}
        </p>
      )}

      {/* ── Section A: Detail Penjualan per Produk ─────────────────────────── */}
      <SectionCard title={t('laporan.sectionA')}>
        {tenantName && (
          <p className="px-4 pt-3 text-xs text-gray-500">{t('laporan.tenant', { name: tenantName })}</p>
        )}
        {loadProduk ? (
          <div className="py-8"><Spinner /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2 text-left w-8">{t('laporan.col.no')}</th>
                <th className="px-4 py-2 text-left">{t('laporan.col.product')}</th>
                <th className="px-4 py-2 text-left">{t('laporan.col.category')}</th>
                <th className="px-4 py-2 text-right">{t('laporan.col.qtySold')}</th>
                <th className="px-4 py-2 text-right">{t('laporan.col.price')}</th>
                <th className="px-4 py-2 text-right">{t('laporan.col.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!produkData || produkData.length === 0
                ? <EmptyRow colSpan={6} label={t('laporan.noData')} />
                : produkData.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 text-gray-800">{row.productName}</td>
                    <td className="px-4 py-2.5 text-gray-600">{row.category}</td>
                    <td className="px-4 py-2.5 text-right text-gray-800">{row.qtySold}</td>
                    <td className="px-4 py-2.5 text-right text-gray-800">{formatIDR(row.price)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-800">{formatIDR(row.total)}</td>
                  </tr>
                ))
              }
              {produkData?.length > 0 && (
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                  <td colSpan={3} className="px-4 py-2.5 text-gray-700">{t('laporan.col.total').toUpperCase()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-800">{totalQty}</td>
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 text-right text-gray-800">{formatIDR(totalRevProd)}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* ── Section B: Penjualan Harian ─────────────────────────────────────── */}
      <SectionCard title={t('laporan.sectionB')}>
        {loadHarian ? (
          <div className="py-8"><Spinner /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2 text-left">{t('laporan.col.date')}</th>
                <th className="px-4 py-2 text-right">{t('laporan.col.txnCount')}</th>
                <th className="px-4 py-2 text-right">{t('laporan.col.revenue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!harianData || harianData.length === 0
                ? <EmptyRow colSpan={3} label={t('laporan.noData')} />
                : harianData.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-800">{formatReportDate(row.date)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-800">{row.totalTransaksi}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-800">{formatIDR(row.revenue)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        )}
      </SectionCard>

    </div>
  );
}
