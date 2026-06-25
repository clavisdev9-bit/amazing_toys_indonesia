import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useLang } from '../../context/LangContext';
import { lookupPayment, processPayment } from '../../api/payments';
import { getProducts, getCategories } from '../../api/products';
import { addItemToTransaction, applyVoucherToOrder, cancelCashierOrder, createDeleteRequest, getPendingDeleteRequests } from '../../api/cashier';
import { formatRupiah, formatDate } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useWebSocket } from '../../hooks/useWebSocket';
import { canAddToCart, getStockStatus, getStockBadgeStyle } from '../../utils/stockUtils';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import ToastContainer from '../../components/ui/Toast';
import PrintReceiptButton from '../../components/cashier/PrintReceiptButton';
import PrintConfirmationModal from '../../components/cashier/PrintConfirmationModal';
import VoucherInput from '../../components/cart/VoucherInput';
import { sendEReceipt } from '../../services/sendEReceipt';

const PAYMENT_METHODS = [
  { id: 'QRIS', icon: '📱', label: 'QR / QRIS',    desc: 'Scan QR untuk bayar' },
  { id: 'EDC',  icon: '💳', label: 'Kartu (EDC)',  desc: 'Gesek / tap / chip' },
];

function normalizeProduct(p) {
  return {
    id: p.product_id,
    name: p.product_name,
    price: parseFloat(p.price) || 0,
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
  const { subscribe } = useWebSocket();
  const cashierName = user?.name ?? user?.username ?? 'Kasir';

  // Transaction state
  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('QRIS');
  const [paymentRef, setPaymentRef] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [cancelModal, setCancelModal]   = useState(false);
  const [cancelling, setCancelling]     = useState(false);

  // Voucher state
  const [voucherApplying, setVoucherApplying] = useState(false);
  const [voucherKey, setVoucherKey]           = useState(0); // force-remount VoucherInput on failure
  const autoVoucherDone = useRef(false);
  const preVoucher = location.state?.preVoucher ?? null; // voucher code passed from dashboard

  // Delete request state
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());
  const [deletingIds, setDeletingIds] = useState(new Set());

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

  // Restore pending delete state from server on mount
  useEffect(() => {
    getPendingDeleteRequests()
      .then(r => {
        const ids = new Set(
          (r.data.data ?? [])
            .filter(req => req.transaction_id === transactionId)
            .map(req => req.product_id)
        );
        setPendingDeleteIds(ids);
      })
      .catch(() => {});
  }, [transactionId]);

  // WebSocket: listen for delete request resolutions
  useEffect(() => {
    return subscribe('delete_request:resolved', (msg) => {
      const { action, product_id } = msg.data ?? msg;
      setPendingDeleteIds(prev => {
        const next = new Set(prev);
        next.delete(product_id);
        return next;
      });
      if (action === 'approve') {
        refreshTxn();
        addToast('Item berhasil dihapus oleh leader.', 'success');
      } else {
        addToast('Permintaan hapus ditolak oleh leader.', 'error');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);

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

  async function handleDeleteRequest(item) {
    if (pendingDeleteIds.has(item.product_id) || deletingIds.has(item.product_id)) return;
    setDeletingIds(prev => new Set(prev).add(item.product_id));
    try {
      await createDeleteRequest({
        transaction_id: transactionId,
        product_id: item.product_id,
        product_name: item.product_name,
        qty: item.approved_quantity ?? item.quantity,
        subtotal: parseFloat(item.subtotal),
      });
      setPendingDeleteIds(prev => new Set(prev).add(item.product_id));
      addToast(`Permintaan hapus "${item.product_name}" dikirim ke leader.`, 'info');
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal mengirim permintaan hapus.', 'error');
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(item.product_id); return next; });
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

  function handleProcess(e) {
    e.preventDefault();
    setError('');
    setConfirmModal(true);
  }

  async function handleConfirmProcess() {
    setConfirmModal(false);
    setProcessing(true);
    try {
      const body = {
        transaction_id: transactionId,
        payment_method: method,
        payment_ref: paymentRef || undefined,
      };
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

  async function handleCancelOrder() {
    setCancelling(true);
    try {
      await cancelCashierOrder(transactionId);
      navigate('/cashier/pos', { replace: true });
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal membatalkan transaksi. Coba lagi.', 'error');
      setCancelModal(false);
    } finally {
      setCancelling(false);
    }
  }

  const customer = txn
    ? { name: txn.customer_name, email: txn.customer_email ?? '', phone: txn.customer_phone }
    : null;

  const isPending  = txn?.status === 'PENDING';
  const isEditable = ['PENDING', 'RESERVED', 'WAITING_PAYMENT'].includes(txn?.status);

  if (loading) return <Spinner />;

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    const isPreorderSuccess = success.orderType === 'PREORDER';
    return (
      <>
        <div className="max-w-lg bg-white rounded-xl border p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{t('payment.success')}</h2>
          <p className="text-sm text-gray-500 mb-4">{formatDate(success.paidAt)}</p>
          {isPreorderSuccess && (
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-left text-sm">
              <p className="font-bold text-orange-700 mb-0.5">📦 Pre-Order Dikonfirmasi</p>
              <p className="text-orange-600 text-xs">Pembayaran diterima. Customer <strong>tidak perlu ke pickup area</strong> — barang akan dikirim setelah tiba di Indonesia.</p>
            </div>
          )}
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
          cashReceived={null}
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
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/cashier/pos')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"
            >
              {t('back')}
            </button>
            {txn && isEditable && (
              <button
                onClick={() => setCancelModal(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1 rounded-lg transition-colors"
              >
                ✕ Batalkan Transaksi
              </button>
            )}
          </div>

          {error && !txn && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {txn && (
            <>
              {/* CR-05X: PRE-ORDER banner */}
              {txn.order_type === 'PREORDER' && (
                <div className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm">
                  <p className="font-bold text-orange-700 mb-1">⚠ PRE-ORDER TRANSACTION</p>
                  <p className="text-orange-600 text-xs mb-1">Barang tidak diambil di booth — akan dikirim ke alamat customer setelah siap.</p>
                  {txn.shipping_name && (
                    <p className="text-xs text-orange-700 font-medium">
                      Dikirim ke: <strong>{txn.shipping_name}</strong>
                      {txn.shipping_city ? `, ${txn.shipping_city}` : ''}
                      {txn.shipping_province ? `, ${txn.shipping_province}` : ''}
                    </p>
                  )}
                  {txn.shipping_address && (
                    <p className="text-xs text-orange-600 mt-0.5">{txn.shipping_address}</p>
                  )}
                </div>
              )}

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
                  {(txn.items ?? []).filter(item => item.approval_status !== 'REJECTED').map((item, i) => {
                    const isPendingDelete = pendingDeleteIds.has(item.product_id);
                    const isDeletePending = deletingIds.has(item.product_id);
                    return (
                      <div key={i} className={`py-1.5 flex items-center gap-2 transition-opacity ${isPendingDelete ? 'opacity-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-700">{item.product_name} × {item.approved_quantity ?? item.quantity}</span>
                          {isPendingDelete && (
                            <span className="ml-1.5 text-[10px] text-amber-600 font-medium">⏳ Menunggu Leader</span>
                          )}
                        </div>
                        <span className="font-medium shrink-0">{formatRupiah(item.subtotal)}</span>
                        {isEditable && (
                          isPendingDelete ? (
                            <span className="text-amber-500 text-xs shrink-0" title="Menunggu persetujuan leader">⏳</span>
                          ) : isDeletePending ? (
                            <Spinner className="w-3 h-3 shrink-0" />
                          ) : (
                            <button
                              onClick={() => handleDeleteRequest(item)}
                              className="text-red-400 hover:text-red-600 text-xs shrink-0 p-0.5"
                              title="Ajukan hapus item (perlu persetujuan leader)"
                            >🗑️</button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const subtotal    = parseFloat(txn.subtotal_amount ?? 0);
                  const discountAmt = parseFloat(txn.discount_amount ?? 0);
                  const hasDiscount = discountAmt > 0;
                  return (
                    <div className="border-t pt-2 mt-2 space-y-1 text-sm">
                      {hasDiscount && (
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
                      <div className="flex justify-between font-bold">
                        <span>{t('checkout.total')}</span>
                        <span className="text-blue-700 text-lg">{formatRupiah(txn.total_amount)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Voucher — saat transaksi masih editable dan belum ada voucher */}
              {isEditable && !txn.voucher_code && (
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

                {/* Method selector — 2 cards */}
                <div className="grid grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map(({ id, icon, label, desc }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { setMethod(id); setPaymentRef(''); }}
                      className={`flex flex-col items-center gap-1 py-4 rounded-xl border-2 transition-all
                        ${method === id
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      <span className="text-2xl">{icon}</span>
                      <span className="text-sm font-bold">{label}</span>
                      <span className="text-xs opacity-70">{desc}</span>
                    </button>
                  ))}
                </div>

                {/* QR method: tampilkan QR code transaksi */}
                {method === 'QRIS' && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="bg-white p-3 rounded-xl border-2 border-gray-200 shadow-sm">
                      <QRCodeSVG value={txn.transaction_id} size={160} level="M" includeMargin={false} />
                    </div>
                    <p className="text-xs text-center text-gray-500 max-w-[260px]">
                      Tampilkan QR ini ke customer — scan via GoPay, OVO, BSI Mobile, atau app bank lain
                    </p>
                    <p className="text-[11px] font-mono text-gray-400">{txn.transaction_id}</p>
                  </div>
                )}

                {/* EDC method: instruksi */}
                {method === 'EDC' && (
                  <div className="flex flex-col items-center gap-2 py-3 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-4xl">💳</span>
                    <p className="text-sm font-semibold text-gray-700">Proses di mesin EDC</p>
                    <p className="text-xs text-gray-500 text-center max-w-[260px]">
                      Gesek / tap / masukkan kartu customer di mesin EDC, lalu masukkan nomor referensi di bawah
                    </p>
                  </div>
                )}

                {/* Nomor referensi — kedua metode */}
                <Input
                  label={t('payment.paymentRef')}
                  placeholder="Opsional — no. referensi / approval"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <Button type="submit" size="full" loading={processing}>
                  {t('payment.processBtn')}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Konfirmasi batalkan transaksi */}
      <Modal
        open={cancelModal}
        onClose={() => !cancelling && setCancelModal(false)}
        title="Batalkan Transaksi"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Apakah Anda yakin ingin membatalkan transaksi ini?
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">ID Transaksi</span>
              <span className="font-mono font-bold text-gray-900">{txn?.transaction_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-red-700">{formatRupiah(txn?.total_amount)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">Stok produk akan dikembalikan. Tindakan ini tidak dapat diurungkan.</p>
          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={cancelling}
              onClick={() => setCancelModal(false)}
            >
              Kembali
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              loading={cancelling}
              onClick={handleCancelOrder}
            >
              Ya, Batalkan
            </Button>
          </div>
        </div>
      </Modal>

      {/* CR-054: Konfirmasi sebelum proses pembayaran */}
      <Modal
        open={confirmModal}
        onClose={() => setConfirmModal(false)}
        title="Konfirmasi Pembayaran"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Apakah Anda yakin ingin memproses pembayaran ini?</p>
          <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">ID Transaksi</span>
              <span className="font-mono font-bold text-gray-900">{txn?.transaction_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-blue-700 text-base">{formatRupiah(txn?.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Metode</span>
              <span className="font-semibold text-gray-800">
                {method === 'QRIS' ? '📱 QR / QRIS' : '💳 Kartu (EDC)'}
              </span>
            </div>
            {txn?.order_type === 'PREORDER' && (
              <div className="flex justify-between items-center pt-1 border-t border-orange-200">
                <span className="text-orange-600 font-semibold text-xs">🔖 PRE-ORDER</span>
                <span className="text-orange-600 text-xs">Barang dikirim, bukan pickup</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmModal(false)}>
              Batal
            </Button>
            <Button variant="primary" className="flex-1" loading={processing} onClick={handleConfirmProcess}>
              Ya, Proses
            </Button>
          </div>
        </div>
      </Modal>

      <PrintConfirmationModal
        isOpen={isModalOpen}
        txn={txn}
        success={success}
        cashierName={cashierName}
        customer={customer}
        cashReceived={null}
        onClose={() => setIsModalOpen(false)}
        onConfirmPrint={handleConfirmPrint}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
