import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { getTenantOrders, handover } from '../../api/tenantOrders';
import { formatRupiah, formatDate } from '../../utils/format';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useToast } from '../../hooks/useToast';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ToastContainer from '../../components/ui/Toast';

// Lazy-load QR scanner so a camera/library error never crashes this page
const QrScannerModal = lazy(() => import('../../components/ui/QrScannerModal'));

// Group flat rows by transaction_id
function groupOrders(rows = []) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.transaction_id)) {
      map.set(row.transaction_id, {
        transaction_id: row.transaction_id,
        customer_name:  row.customer_name,
        paid_at:        row.paid_at,
        items:          [],
      });
    }
    map.get(row.transaction_id).items.push(row);
  }
  return Array.from(map.values());
}

// Case-insensitive partial match on transaction_id
function matchesSearch(group, query) {
  if (!query) return true;
  return group.transaction_id.toLowerCase().includes(query.toLowerCase());
}

export default function TenantOrdersPage() {
  const { subscribe }                   = useWebSocket();
  const { toasts, addToast, removeToast } = useToast();
  const { t }                           = useLang();

  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [processing, setProcessing] = useState({});
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const debounceRef = useRef(null);

  const fetchOrders = useCallback(() => {
    setFetchError(null);
    getTenantOrders()
      .then((r) => setOrders(r.data.data ?? []))
      .catch((err) => {
        const msg = err.response?.data?.message ?? err.message ?? 'Gagal memuat pesanan';
        setFetchError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    return subscribe('ORDER_PAID', (payload) => {
      addToast(t('tenantOrders.newOrder', { id: payload.transactionId }), 'info');
      fetchOrders();
    });
  }, [subscribe, fetchOrders, addToast, t]);

  // Debounce typed input 300 ms; QR results bypass debounce (applied immediately)
  function handleSearchChange(value) {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value), 300);
  }

  function handleQrResult(txnId) {
    setScannerOpen(false);
    setSearchInput(txnId);
    setSearchQuery(txnId);
  }

  function handleClearSearch() {
    setSearchInput('');
    setSearchQuery('');
  }

  async function handleHandover(transactionId) {
    setProcessing((p) => ({ ...p, [transactionId]: true }));
    try {
      await handover(transactionId);
      addToast(t('tenantOrders.handoverOk'), 'success');
      fetchOrders();
    } catch (err) {
      addToast(err.response?.data?.message ?? t('tenantOrders.handoverErr'), 'error');
    } finally {
      setProcessing((p) => ({ ...p, [transactionId]: false }));
    }
  }

  const grouped = useMemo(() => groupOrders(orders), [orders]);

  const ready = useMemo(
    () => grouped.filter(
      (g) => g.items.some((i) => i.pickup_status !== 'DONE') && matchesSearch(g, searchQuery)
    ),
    [grouped, searchQuery],
  );

  const done = useMemo(
    () => grouped.filter(
      (g) => g.items.every((i) => i.pickup_status === 'DONE') && matchesSearch(g, searchQuery)
    ),
    [grouped, searchQuery],
  );

  const isFiltering = searchQuery.length > 0;
  const noResults   = isFiltering && ready.length === 0 && done.length === 0;

  if (loading) return <Spinner />;

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* QR scanner — lazy loaded, isolated from main render tree */}
      {scannerOpen && (
        <Suspense fallback={null}>
          <QrScannerModal
            onResult={handleQrResult}
            onClose={() => setScannerOpen(false)}
          />
        </Suspense>
      )}

      <div className="max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">{t('tenantOrders.title')}</h1>
          <button onClick={fetchOrders} className="text-sm text-blue-600 hover:underline">
            {t('tenantOrders.refresh')}
          </button>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Masukkan atau scan nomor transaksi..."
              className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-300 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         bg-white placeholder-gray-400"
            />
            {searchInput && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* QR Scan button */}
          <button
            onClick={() => setScannerOpen(true)}
            title="Scan QR Code"
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-300
                       bg-white hover:bg-gray-50 hover:border-blue-400 text-gray-600 hover:text-blue-600
                       transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
              <rect x="7" y="7" width="4" height="4" rx="0.5" />
              <rect x="13" y="7" width="4" height="4" rx="0.5" />
              <rect x="7" y="13" width="4" height="4" rx="0.5" />
              <circle cx="15" cy="15" r="1" fill="currentColor" />
            </svg>
          </button>
        </div>

        {/* API error */}
        {fetchError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
            <span>{fetchError}</span>
            <button onClick={fetchOrders} className="ml-3 font-medium underline shrink-0">Coba lagi</button>
          </div>
        )}

        {/* No results for current search */}
        {!fetchError && noResults && (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-sm font-medium text-gray-500">Transaksi tidak ditemukan</p>
            <p className="text-xs text-gray-400 mt-1">"{searchQuery}"</p>
            <button onClick={handleClearSearch} className="mt-3 text-xs text-blue-600 hover:underline">
              Hapus pencarian
            </button>
          </div>
        )}

        {/* Empty state — no PAID orders at all */}
        {!fetchError && !isFiltering && ready.length === 0 && done.length === 0 && (
          <EmptyState
            icon="🕐"
            title={t('tenantOrders.empty.title')}
            description={t('tenantOrders.empty.desc')}
          />
        )}

        {/* ── Waiting for handover ──────────────────────────────────────────── */}
        {ready.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-2">
              {t('tenantOrders.waiting', { count: ready.length })}
            </h2>
            <div className="space-y-3">
              {ready.map((group) => (
                <div key={group.transaction_id} className="bg-white rounded-xl border border-amber-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-mono font-bold text-gray-900 text-sm">{group.transaction_id}</p>
                      <p className="text-xs text-gray-500">{group.customer_name} · {formatDate(group.paid_at)}</p>
                    </div>
                    <Badge status="PAID" />
                  </div>
                  <div className="space-y-1 mb-3 text-sm">
                    {group.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-gray-700">
                        <span>{item.product_name} × {item.quantity}</span>
                        <span>{formatRupiah(item.unit_price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="full"
                    variant="success"
                    loading={processing[group.transaction_id]}
                    onClick={() => handleHandover(group.transaction_id)}
                  >
                    {t('tenantOrders.handover')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Done (collapsible, auto-opens when filtering) ─────────────────── */}
        {done.length > 0 && (
          <details className="bg-white rounded-xl border overflow-hidden" {...(isFiltering ? { open: true } : {})}>
            <summary className="px-4 py-3 text-sm font-semibold text-gray-500 cursor-pointer hover:bg-gray-50 select-none">
              {t('tenantOrders.done', { count: done.length })}
            </summary>
            <div className="divide-y">
              {done.map((group) => (
                <div key={group.transaction_id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-semibold text-gray-700">{group.transaction_id}</p>
                    <p className="text-xs text-gray-400">{group.customer_name}</p>
                  </div>
                  <Badge status="DONE" />
                </div>
              ))}
            </div>
          </details>
        )}

      </div>
    </>
  );
}
