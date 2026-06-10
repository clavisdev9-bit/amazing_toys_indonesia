import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRupiah, formatDate } from '../../utils/format';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useLang } from '../../context/LangContext';
import ApprovalQueueTab from '../../components/helper/ApprovalQueueTab';
import {
  getBoothProducts,
  getBoothOrders,
  createHelperOrder,
  cancelHelperOrder,
  handoverOrder,
} from '../../api/helper';

// STATUS_LABEL is built dynamically using t() inside each component.

// ─────────────────────────────────────────────────────────────────────────────
// TAB: BUAT ORDER
// ─────────────────────────────────────────────────────────────────────────────
function OrderTab() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [cart, setCart]         = useState({});   // { productId: qty }
  const [phone, setPhone]       = useState('');
  const [search, setSearch]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    getBoothProducts()
      .then(r => setProducts(r.data.data || []))
      .catch(() => setError(t('helper.loadError')))
      .finally(() => setLoading(false));
  }, []);

  function setQty(productId, delta) {
    setCart(prev => {
      const current = prev[productId] || 0;
      const next    = Math.max(0, current + delta);
      if (next === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: next };
    });
  }

  const filtered = products.filter(p =>
    !search || p.product_name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)
  );

  const cartItems = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([pid, qty]) => {
      const p = products.find(x => x.product_id === pid);
      return { product_id: pid, qty, product_name: p?.product_name, price: p?.price };
    });

  const subtotal = cartItems.reduce((s, i) => s + (i.price * i.qty), 0);
  const taxAmt   = Math.round(subtotal * 0.12);   // approximate; backend recalculates
  const total    = subtotal + taxAmt;

  async function handleApprove() {
    if (cartItems.length === 0) { setError(t('helper.minOneProduct')); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await createHelperOrder({
        items: cartItems.map(i => ({ product_id: i.product_id, qty: i.qty })),
        customer_phone: phone || null,
      });
      setCart({});
      setPhone('');
      // CR-036: navigate ke halaman sukses dengan data order (Option B)
      navigate('/helper/order-success', { state: res.data.data });
    } catch (err) {
      setError(err.response?.data?.message || t('helper.createOrderError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Product list */}
      <div className="lg:col-span-2 space-y-3">
        <Input
          placeholder={t('helper.searchBarcode')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {filtered.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">{t('helper.noProducts')}</p>
        )}
        <div className="space-y-2">
          {filtered.map(p => {
            const qty = cart[p.product_id] || 0;
            const restricted = p.is_display_only || p.is_on_hold || p.stock_quantity === 0;
            return (
              <div
                key={p.product_id}
                className={`bg-white rounded-lg border p-3 flex items-center gap-3 ${restricted ? 'opacity-60' : ''}`}
              >
                {p.image_url && (
                  <img src={p.image_url} alt="" className="w-12 h-12 object-cover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{p.product_name}</p>
                  <p className="text-xs text-gray-500">{formatRupiah(p.price)}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {p.is_display_only && <span className="text-xs text-red-600 bg-red-50 px-1.5 rounded">{t('helper.displayOnly')}</span>}
                    {p.is_on_hold && <span className="text-xs text-orange-600 bg-orange-50 px-1.5 rounded">{t('helper.onHold')}</span>}
                    {p.stock_quantity === 0 && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 rounded">{t('badge.OUT_OF_STOCK')}</span>}
                    {p.max_per_customer && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 rounded">{t('helper.maxPerPerson', { n: p.max_per_customer })}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setQty(p.product_id, -1)}
                    disabled={qty === 0 || restricted}
                    className="w-7 h-7 rounded-full border flex items-center justify-center text-gray-600 disabled:opacity-40"
                  >−</button>
                  <span className="w-6 text-center text-sm font-mono">{qty}</span>
                  <button
                    onClick={() => setQty(p.product_id, 1)}
                    disabled={restricted || qty >= p.stock_quantity || (p.max_per_customer && qty >= p.max_per_customer)}
                    className="w-7 h-7 rounded-full border flex items-center justify-center text-gray-600 disabled:opacity-40"
                  >+</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart summary */}
      <div className="space-y-3">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-700 mb-3">{t('helper.orderSummary')}</h3>

          {cartItems.length === 0 ? (
            <p className="text-gray-400 text-sm">{t('helper.noItemSelected')}</p>
          ) : (
            <div className="space-y-1.5 text-sm mb-3">
              {cartItems.map(i => (
                <div key={i.product_id} className="flex justify-between">
                  <span className="text-gray-600">{i.product_name} ×{i.qty}</span>
                  <span>{formatRupiah(i.price * i.qty)}</span>
                </div>
              ))}
              <div className="border-t pt-1.5 flex justify-between text-gray-500">
                <span>PPN ~12%</span>
                <span>≈ {formatRupiah(taxAmt)}</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{formatRupiah(total)}</span>
              </div>
            </div>
          )}

          <Input
            placeholder={t('helper.customerPhone')}
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="mb-3"
          />

          {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

          <Button
            onClick={handleApprove}
            loading={submitting}
            disabled={cartItems.length === 0}
            className="w-full"
          >
            {t('helper.approveGenerateQR')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: RIWAYAT
// ─────────────────────────────────────────────────────────────────────────────
function HistoryTab() {
  const { t } = useLang();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    setLoading(true);
    getBoothOrders({ date: today })
      .then(r => setOrders(r.data.data || []))
      .catch(() => setError(t('helper.loadError')))
      .finally(() => setLoading(false));
  }, [today]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (error)   return <p className="text-red-600 text-sm">{error}</p>;
  if (orders.length === 0) return <p className="text-gray-400 text-sm text-center py-8">{t('cashier.noTransactions')}</p>;

  return (
    <div className="space-y-2">
      <div className="flex justify-end mb-2">
        <button onClick={load} className="text-xs text-blue-600 hover:underline">{t('helper.refresh')}</button>
      </div>
      {orders.map(o => (
        <div key={o.transaction_id} className="bg-white rounded-lg border p-3 flex items-center justify-between gap-2">
          <div>
            <p className="font-mono text-sm font-medium">{o.transaction_id}</p>
            <p className="text-xs text-gray-500">
              {formatDate(o.created_at)} ·{' '}
              {o.customer_name || o.customer_reg_phone || o.customer_phone || 'Walk-in'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-sm">{formatRupiah(o.total_amount)}</p>
            <Badge status={o.status} label={t(`badge.${o.status}`)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: HANDOVER
// ─────────────────────────────────────────────────────────────────────────────
function HandoverTab() {
  const { t } = useLang();
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getBoothOrders({ status: 'PAID' })
      .then(r => setOrders(r.data.data || []))
      .catch(() => setError(t('helper.loadError')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doHandover(txnId) {
    setConfirming(txnId);
    try {
      await handoverOrder(txnId);
      load();
    } catch (err) {
      alert(err.response?.data?.message || t('helper.handoverError'));
    } finally {
      setConfirming(null);
    }
  }

  if (loading) return <Spinner />;
  if (error)   return <p className="text-red-600 text-sm">{error}</p>;

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">{t('helper.noPaidOrders')}</p>
        <button onClick={load} className="text-xs text-blue-600 mt-2 hover:underline">{t('helper.refresh')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-1">
        <p className="text-sm text-gray-600">{t('helper.ordersWaitingHandover', { n: orders.length })}</p>
        <button onClick={load} className="text-xs text-blue-600 hover:underline">{t('helper.refresh')}</button>
      </div>
      {orders.map(o => (
        <div key={o.transaction_id} className="bg-white rounded-xl border p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-mono font-bold text-sm">{o.transaction_id}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {o.customer_name || o.customer_reg_phone || o.customer_phone || 'Walk-in'} ·{' '}
                {formatDate(o.created_at)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatRupiah(o.total_amount)}</p>
              <Badge status="PAID" label={t('badge.PAID')} />
            </div>
          </div>
          <Button
            onClick={() => doHandover(o.transaction_id)}
            loading={confirming === o.transaction_id}
            className="w-full"
            variant="success"
          >
            {t('helper.confirmHandover')}
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function HelperPage() {
  const { subscribe }   = useWebSocket();
  const { t }           = useLang();

  const [tab, setTab]               = useState('order');
  const [approvalCount, setApprovalCount] = useState(0);
  const [newApprovalToast, setNewApprovalToast] = useState(false);

  // CR-040: listen for PENDING_APPROVAL_CREATED to show badge + notification
  useEffect(() => {
    return subscribe('PENDING_APPROVAL_CREATED', () => {
      setApprovalCount((c) => c + 1);
      setNewApprovalToast(true);
      setTimeout(() => setNewApprovalToast(false), 5000);
    });
  }, [subscribe]);

  const TABS = [
    { id: 'order',    label: t('helper.tabOrder') },
    { id: 'approval', label: t('helper.tabApproval'), badge: approvalCount },
    { id: 'history',  label: t('helper.tabHistory') },
    { id: 'handover', label: t('helper.tabHandover') },
  ];

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4">{t('helper.pageTitle')}</h1>

      {/* CR-040: new order toast */}
      {newApprovalToast && (
        <div
          className="mb-3 flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-3 text-sm font-medium cursor-pointer shadow-lg"
          onClick={() => { setTab('approval'); setNewApprovalToast(false); }}
        >
          <span className="text-lg">🔔</span>
          <span>{t('helper.newOrderToast')}</span>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex border-b mb-4 overflow-x-auto">
        {TABS.map(tab_ => (
          <button
            key={tab_.id}
            onClick={() => { setTab(tab_.id); if (tab_.id === 'approval') setApprovalCount(0); }}
            className={`relative px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === tab_.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab_.label}
            {tab_.badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center min-w-[18px] px-1">
                {tab_.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'order'    && <OrderTab />}
      {tab === 'approval' && (
        <ApprovalQueueTab onCountChange={setApprovalCount} />
      )}
      {tab === 'history'  && <HistoryTab />}
      {tab === 'handover' && <HandoverTab />}
    </div>
  );
}
