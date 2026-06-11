import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLang } from '../../context/LangContext';
import { lookupPayment, processPayment } from '../../api/payments';
import { getProducts, getCategories } from '../../api/products';
import { addItemToTransaction, applyVoucherToOrder } from '../../api/cashier';
import { formatRupiah, formatDate } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { canAddToCart, getStockStatus, getStockBadgeStyle } from '../../utils/stockUtils';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import ToastContainer from '../../components/ui/Toast';
import PrintReceiptButton from '../../components/cashier/PrintReceiptButton';
import PrintConfirmationModal from '../../components/cashier/PrintConfirmationModal';
import VoucherInput from '../../components/cart/VoucherInput';
import { sendEReceipt } from '../../services/sendEReceipt';

const METHODS = ['CASH', 'QRIS', 'EDC', 'TRANSFER'];

function normalizeProduct(p) {
  return {
    id: p.product_id,
    name: p.product_name,
    price: p.price,
    category: p.category,
    stock: p.stock_quantity,
    image_url: p.image_url || null,
    tenant_name: p.tenant_name,
  };
}

function AddProductCard({ product, onAdd, adding }) {
  const { t } = useLang();
  const { level } = getStockStatus(product.stock);
  const { bg, text } = getStockBadgeStyle(level);
  const addable = canAddToCart(product.stock);
  const isAdding = adding === product.id;
  const stockLabel = { out: t('badge.OUT_OF_STOCK'), low: t('payment.stockLow'), available: t('badge.AVAILABLE') }[level] ?? t('badge.AVAILABLE');
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden flex flex-col transition-all ${
        addable ? 'border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-pointer' : 'border-gray-100 opacity-60'
      }`}
      onClick={() => addable && !isAdding && onAdd(product)}
    >
      <div className="aspect-square bg-gray-50 flex items-center justify-center" style={{ minHeight: 72 }}>
        {product.image_url && !imgError
          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" onError={() => setImgError(true)} />
          : <span className="text-3xl">🧸</span>
        }
      </div>
      <div className="p-2 flex flex-col flex-1">
        <p className="text-[11px] font-semibold text-gray-800 truncate mb-0.5">{product.name}</p>
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-xs font-bold text-blue-700">{formatRupiah(product.price)}</span>
          <span className="text-[9px] font-medium px-1 py-0.5 rounded shrink-0" style={{ background: bg, color: text }}>
            {stockLabel}
          </span>
        </div>
        <button
          disabled={!addable || isAdding}
          className={`w-full py-1 rounded-lg text-[11px] font-semibold transition-colors mt-auto ${
            isAdding
              ? 'bg-green-500 text-white'
              : addable
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isAdding ? t('payment.btnAdded') : addable ? t('payment.btnAdd') : t('badge.OUT_OF_STOCK')}
        </button>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  const { transactionId } = useParams();
  const navigate    = useNavigate();
  const location    = useLocation();
  const { user }    = useAuth();
  const { t }       = useLang();
  const { toasts, addToast, removeToast } = useToast();
  const cashierName = user?.name ?? user?.username ?? 'Kasir';

  // Transaction state
  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Voucher state
  const [voucherApplying, setVoucherApplying] = useState(false);
  const [voucherKey, setVoucherKey]           = useState(0); // force-remount VoucherInput on failure
  const autoVoucherDone = useRef(false);
  const preVoucher = location.state?.preVoucher ?? null; // voucher code passed from dashboard

  // Product browser state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['Semua']);
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [search, setSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [addingProduct, setAddingProduct] = useState(null);

  // Load transaction
  useEffect(() => {
    const controller = new AbortController();
    lookupPayment(transactionId, { signal: controller.signal })
      .then((r) => setTxn(r.data.data))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED') return;
        const status = err.response?.status;
        if (status === 409) {
          navigate(`/pesanan/${transactionId}/receipt`, { replace: true });
        } else if (status === 422) {
          setError(t('payment.cancelled'));
        } else if (status === 410) {
          setError(t('cashier.err410'));
        } else {
          setError(t('cashier.err404'));
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [transactionId]);

  // Load products & categories for the browser
  useEffect(() => {
    Promise.all([getProducts({ limit: 500 }), getCategories()])
      .then(([prodRes, catRes]) => {
        const rawProds = prodRes.data.data?.items ?? [];
        const rawCats = catRes.data.data ?? [];
        setProducts(rawProds.map(normalizeProduct));
        setCategories(['Semua', ...rawCats.filter(c => c !== 'All')]);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  // Auto-apply voucher passed from CashierDashboardPage navigation state
  useEffect(() => {
    if (!autoVoucherDone.current && txn && txn.status === 'PENDING' && !txn.voucher_code && preVoucher) {
      autoVoucherDone.current = true;
      handleApplyVoucher(preVoucher);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txn?.transaction_id]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory !== 'Semua') list = list.filter(p => p.category === activeCategory);
    if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase().trim()));
    return list;
  }, [products, activeCategory, search]);

  async function refreshTxn() {
    try {
      const r = await lookupPayment(transactionId);
      setTxn(r.data.data);
    } catch (_) {}
  }

  async function handleAddProduct(product) {
    setAddingProduct(product.id);
    try {
      await addItemToTransaction(transactionId, product.id, 1);
      await refreshTxn();
      addToast(`${product.name} ditambahkan`, 'success');
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal menambahkan produk', 'error');
    } finally {
      setAddingProduct(null);
    }
  }

  async function handleApplyVoucher(voucherOrCode) {
    const code = typeof voucherOrCode === 'string' ? voucherOrCode : voucherOrCode.code;
    setVoucherApplying(true);
    try {
      const result = await applyVoucherToOrder(transactionId, code);
      await refreshTxn();
      const saved = result.data?.data?.discountAmount;
      addToast(
        `Voucher ${code} diterapkan${saved ? ` — hemat ${formatRupiah(saved)}` : ''}`,
        'success'
      );
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal menerapkan voucher', 'error');
      setVoucherKey(k => k + 1); // force VoucherInput remount → reset stale "applied" state
    } finally {
      setVoucherApplying(false);
    }
  }

  async function handleProcess(e) {
    e.preventDefault();
    setError('');
    setProcessing(true);
    try {
      const body = { transaction_id: transactionId, payment_method: method };
      if (method === 'CASH') body.cash_received = parseFloat(cashReceived);
      else body.payment_ref = paymentRef || undefined;
      const res = await processPayment(body);
      setSuccess(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Pembayaran gagal.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirmPrint(sendEmail) {
    setIsModalOpen(false);
    if (sendEmail && customer?.email) {
      const result = await sendEReceipt(txn, success, customer);
      if (result.success) {
        addToast(`E-receipt sent to ${customer.email}`, 'success');
      } else {
        addToast('Failed to send e-receipt — resend manually', 'warning');
      }
    }
    addToast('Receipt printed', 'success');
  }

  const customer = txn
    ? { name: txn.customer_name, email: txn.customer_email ?? '', phone: txn.customer_phone }
    : null;

  const isPending = txn?.status === 'PENDING';

  if (loading) return <Spinner />;

  // ── Success screen (unchanged) ────────────────────────────────────────────
  if (success) {
    return (
      <>
        <div className="max-w-lg bg-white rounded-xl border p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{t('payment.success')}</h2>
          <p className="text-sm text-gray-500 mb-4">{formatDate(success.paidAt)}</p>
          <div className="bg-gray-50 rounded-lg p-4 text-left mb-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('confirmed.txnId')}</span>
              <span className="font-mono font-bold">{success.transactionId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('payment.methodLabel')}</span>
              <span className="font-semibold">{success.paymentMethod}</span>
            </div>
            {success.cashChange != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">{t('payment.change')}</span>
                <span className="font-bold text-green-600">{formatRupiah(success.cashChange)}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 mb-4">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/cashier')}>
              {t('payment.newTxn')}
            </Button>
            <Button className="flex-1" onClick={() => navigate('/cashier/rekap')}>
              {t('payment.viewRecap')}
            </Button>
          </div>
          <PrintReceiptButton txn={txn} onOpenModal={() => setIsModalOpen(true)} />
        </div>

        <PrintConfirmationModal
          isOpen={isModalOpen}
          txn={txn}
          success={success}
          cashierName={cashierName}
          customer={customer}
          cashReceived={method === 'CASH' && cashReceived ? parseFloat(cashReceived) : null}
          onClose={() => setIsModalOpen(false)}
          onConfirmPrint={handleConfirmPrint}
        />

        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
    );
  }

  // ── Main layout: 2-column ─────────────────────────────────────────────────
  return (
    <>
      <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 130px)' }}>

        {/* ── Kiri: transaksi + form pembayaran ──────────────────────── */}
        <div className="w-[460px] shrink-0 flex flex-col gap-4">
          <button
            onClick={() => navigate('/cashier')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 self-start"
          >
            {t('back')}
          </button>

          {error && !txn && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {txn && (
            <>
              {/* Transaction detail */}
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono font-bold text-gray-900">{txn.transaction_id}</p>
                    <p className="text-sm text-gray-500">{txn.customer_name} · {txn.customer_phone}</p>
                  </div>
                  <Badge status={txn.status} />
                </div>
                <div className="divide-y text-sm mt-3">
                  {(txn.items ?? []).filter(item => item.approval_status !== 'REJECTED').map((item, i) => (
                    <div key={i} className="py-1.5 flex justify-between">
                      <span className="text-gray-700">{item.product_name} × {item.approved_quantity ?? item.quantity}</span>
                      <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
                {(() => {
                  const subtotal     = parseFloat(txn.subtotal_amount ?? 0);
                  const taxAmt       = parseFloat(txn.tax_amount ?? 0);
                  const taxRate      = parseFloat(txn.tax_rate ?? 12);
                  const discountAmt  = parseFloat(txn.discount_amount ?? 0);
                  const hasTax       = taxAmt > 0;
                  const hasDiscount  = discountAmt > 0;
                  return (
                    <div className="border-t pt-2 mt-2 space-y-1 text-sm">
                      {(hasTax || hasDiscount) && (
                        <div className="flex justify-between text-gray-500">
                          <span>{t('cart.subtotal')}</span>
                          <span>{formatRupiah(subtotal)}</span>
                        </div>
                      )}
                      {hasDiscount && (
                        <div className="flex justify-between text-green-600">
                          <span>{t('cart.discount')} ({txn.voucher_code})</span>
                          <span>-{formatRupiah(discountAmt)}</span>
                        </div>
                      )}
                      {hasTax && (
                        <div className="flex justify-between text-gray-500">
                          <span>{t('cart.taxLine', { rate: taxRate })}</span>
                          <span>{formatRupiah(taxAmt)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold">
                        <span>{t('checkout.total')}</span>
                        <span className="text-blue-700 text-lg">{formatRupiah(txn.total_amount)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Voucher — hanya saat PENDING dan belum ada voucher */}
              {isPending && !txn.voucher_code && (
                <div className="bg-white rounded-xl border p-4">
                  <h2 className="font-semibold text-gray-700 mb-3 text-sm">🏷️ Voucher</h2>
                  <VoucherInput
                    key={voucherKey}
                    cartTotal={parseFloat(txn.subtotal_amount ?? 0)}
                    tenantIds={(txn.items ?? []).map(i => i.tenant_id).filter(Boolean)}
                    items={(txn.items ?? []).map(i => ({
                      price: parseFloat(i.unit_price ?? 0),
                      quantity: i.quantity,
                      tenant_id: i.tenant_id,
                    }))}
                    onVoucherApplied={handleApplyVoucher}
                    onVoucherRemoved={() => {}}
                  />
                  {voucherApplying && (
                    <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                      <Spinner className="w-3 h-3" /> {t('payment.applying')}
                    </p>
                  )}
                </div>
              )}

              {/* Payment form */}
              <form onSubmit={handleProcess} className="bg-white rounded-xl border p-4 space-y-4">
                <h2 className="font-semibold text-gray-700">{t('payment.method')}</h2>
                <div className="grid grid-cols-4 gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setMethod(m); setCashReceived(''); setPaymentRef(''); }}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors
                        ${method === m ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {method === 'CASH' && (
                  <div className="space-y-2">
                    <Input
                      label={t('payment.cashReceived')}
                      type="number"
                      min={txn.total_amount}
                      step="1000"
                      placeholder={String(txn.total_amount)}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      required
                    />
                    {cashReceived && parseFloat(cashReceived) >= txn.total_amount && (
                      <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-2">
                        {t('payment.change')}: <strong>{formatRupiah(parseFloat(cashReceived) - txn.total_amount)}</strong>
                      </div>
                    )}
                  </div>
                )}

                {method !== 'CASH' && (
                  <Input
                    label={t('payment.paymentRef')}
                    placeholder="Opsional"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  size="full"
                  loading={processing}
                  disabled={method === 'CASH' && (!cashReceived || parseFloat(cashReceived) < txn.total_amount)}
                >
                  {t('payment.processBtn')}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* ── Kanan: product browser (hanya saat transaksi PENDING) ──── */}
        {isPending && (
          <div className="flex-1 flex flex-col min-w-0">

            {/* Header label */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {t('payment.addProduct')}
            </p>

            {/* Search */}
            <div className="relative mb-2">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('search.placeholder')}
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-lg leading-none">
                  ×
                </button>
              )}
            </div>

            {/* Category chips — kotak hijau */}
            <div
              className="flex gap-2 overflow-x-auto pb-2 mb-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2"
              style={{ scrollbarWidth: 'none' }}
            >
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    activeCategory === cat
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product grid — kotak merah */}
            <div className="flex-1 border-2 border-red-200 rounded-xl overflow-hidden">
              {loadingProducts ? (
                <div className="flex items-center justify-center h-full py-12">
                  <Spinner />
                </div>
              ) : (
                <div className="h-full overflow-y-auto p-3">
                  {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400 gap-2">
                      <span className="text-3xl">🔍</span>
                      <p className="text-sm">{t('product.notFound')}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
                      {filteredProducts.map(p => (
                        <AddProductCard
                          key={p.id}
                          product={p}
                          onAdd={handleAddProduct}
                          adding={addingProduct}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <PrintConfirmationModal
        isOpen={isModalOpen}
        txn={txn}
        success={success}
        cashierName={cashierName}
        customer={customer}
        cashReceived={method === 'CASH' && cashReceived ? parseFloat(cashReceived) : null}
        onClose={() => setIsModalOpen(false)}
        onConfirmPrint={handleConfirmPrint}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
