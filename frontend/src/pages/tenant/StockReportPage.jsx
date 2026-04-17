import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getLaporanStok } from '../../api/tenantOrders';
import { formatRupiah } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';

const POLL_MS = 10_000;

function formatTime(date) {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function PhotoCell({ url, name }) {
  const fallbackRef = useRef(null);
  if (!url) return <span className="text-gray-400">—</span>;
  return (
    <>
      <img
        src={url}
        alt={name}
        className="w-10 h-10 object-cover rounded"
        onError={(e) => { e.currentTarget.style.display = 'none'; if (fallbackRef.current) fallbackRef.current.style.display = 'inline'; }}
      />
      <span ref={fallbackRef} className="text-gray-400" style={{ display: 'none' }}>—</span>
    </>
  );
}

export default function StockReportPage() {
  const { t } = useLang();

  const [items, setItems]             = useState([]);
  const [tenantName, setTenantName]   = useState('');
  const [loading, setLoading]         = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch]           = useState('');
  const [includeInactive, setInclude] = useState(false);
  const intervalRef                   = useRef(null);

  const fetchStock = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getLaporanStok({
        search:           search || undefined,
        include_inactive: includeInactive || undefined,
      });
      const { tenantName: tn, items: rows } = res.data.data;
      setTenantName(tn);
      setItems(rows);
      setLastUpdated(new Date());
    } catch {
      // keep stale data on poll failure
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, includeInactive]);

  useEffect(() => {
    fetchStock(false);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchStock(true), POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchStock]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">{t('stock.title')}</h1>
          {tenantName && <p className="text-sm text-gray-500">{tenantName}</p>}
        </div>
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            {t('stock.updatedAt')} {formatTime(lastUpdated)}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder={t('stock.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setInclude(e.target.checked)}
            className="accent-blue-600"
          />
          {t('stock.showInactive')}
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">{t('stock.col.name')}</th>
                  <th className="px-4 py-3">{t('stock.col.category')}</th>
                  <th className="px-4 py-3">{t('stock.col.price')}</th>
                  <th className="px-4 py-3">{t('stock.col.status')}</th>
                  <th className="px-4 py-3 text-right">{t('stock.col.stock')}</th>
                  <th className="px-4 py-3">{t('stock.col.photo')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                      {t('stock.empty')}
                    </td>
                  </tr>
                ) : items.map((item) => (
                  <tr
                    key={item.productId}
                    className={`hover:bg-gray-50 transition-colors ${!item.isActive ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{item.productName}</span>
                      <br />
                      <span className="text-xs text-gray-400">{item.productId}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.category}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatRupiah(item.price)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={item.stockStatus} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      <span className={
                        item.stockQuantity === 0 ? 'text-red-600' :
                        item.stockQuantity <= 3  ? 'text-orange-500' :
                        'text-green-600'
                      }>
                        {item.stockQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PhotoCell url={item.imageUrl} name={item.productName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
