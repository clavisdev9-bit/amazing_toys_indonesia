'use strict';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { groupCheckout, addItemToTransaction } from '../../api/cashier';
import { getProducts, getCategories } from '../../api/products';
import { formatRupiah } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { canAddToCart, getStockStatus, getStockBadgeStyle } from '../../utils/stockUtils';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import ToastContainer from '../../components/ui/Toast';
import PrintGroupReceiptButton from '../../components/cashier/PrintGroupReceiptButton';

const PAYMENT_METHODS = [
  { id: 'CASH',     icon: '💵', label: 'Cash',        desc: 'Uang tunai' },
  { id: 'QRIS',     icon: '📱', label: 'QRIS',        desc: 'Scan QR bayar' },
  { id: 'EDC',      icon: '💳', label: 'EDC',         desc: 'Gesek / tap' },
  { id: 'TRANSFER', icon: '🏦', label: 'Transfer',    desc: 'Transfer bank' },
];

function normalizeProduct(p) {
  return {
    id: p.product_id, name: p.product_name, price: p.price,
    category: p.category, stock: p.stock_quantity,
    image_url: p.image_url || null, tenant_name: p.tenant_name,
  };
}

function AddProductCard({ product, onAdd, adding }) {
  const { level }    = getStockStatus(product.stock);
  const { bg, text } = getStockBadgeStyle(level);
  const addable  = canAddToCart(product.stock);
  const isAdding = adding === product.id;
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={() => addable && !isAdding && onAdd(product)}
      className={`bg-white border rounded-xl overflow-hidden flex flex-col transition-all ${addable ? 'border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-pointer' : 'border-gray-100 opacity-60'}`}
    >
      <div className="aspect-square bg-gray-50 flex items-center justify-center" style={{ minHeight: 72 }}>
        {product.image_url && !imgError
          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" onError={() => setImgError(true)} />
          : <span className="text-3xl">🧸</span>}
      </div>
      <div className="p-2 flex flex-col flex-1">
        <p className="text-[11px] font-semibold text-gray-800 truncate mb-0.5">{product.name}</p>
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-xs font-bold text-blue-700">{formatRupiah(product.price)}</span>
          <span className="text-[9px] font-medium px-1 py-0.5 rounded shrink-0" style={{ background: bg, color: text }}>
            {level === 'out' ? 'Habis' : level === 'low' ? 'Terbatas' : 'Tersedia'}
          </span>
        </div>
        <button
          disabled={!addable || isAdding}
          className={`w-full py-1 rounded-lg text-[11px] font-semibold transition-colors mt-auto ${isAdding ? 'bg-green-500 text-white' : addable ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
        >
          {isAdding ? 'Ditambahkan' : addable ? '+ Tambah' : 'Habis'}
        </button>
      </div>
    </div>
  );
}

export default function GroupPaymentPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  const { selectedTrx = [], allTrx = [], customer = {} } = location.state ?? {};

  // Redirect if arrived without proper state
  useEffect(() => {
    if (!selectedTrx.length) navigate('/cashier', { replace: true });
  }, [selectedTrx.length, navigate]);

  const [method, setMethod]         = useState('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(null);

  // Product browser
  const [products, setProducts]           = useState([]);
  const [categories, setCategories]       = useState(['Semua']);
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [search, setSearch]               = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [addingProduct, setAddingProduct] = useState(null);

  // Extra items added by cashier (per-TRX mapping not needed: just track total delta)
  const [extraAmount, setExtraAmount] = useState(0);

  useEffect(() => {
    Promise.all([getProducts({ limit: 500 }), getCategories()])
      .then(([pr, cr]) => {
        setProducts((pr.data.data?.items ?? []).map(normalizeProduct));
        setCategories(['Semua', ...(cr.data.data ?? []).filter(c => c !== 'All')]);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory !== 'Semua') list = list.filter(p => p.category === activeCategory);
    if (search.trim()) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase().trim()));
    return list;
  }, [products, activeCategory, search]);

  const baseTotal = selectedTrx.reduce((s, t) => s + parseFloat(t.total_amount), 0);
  const grandTotal = baseTotal + extraAmount;

  const cashChange = method === 'CASH' && parseFloat(cashReceived) > 0
    ? parseFloat(cashReceived) - grandTotal
    : null;

  // Group by "TenantName – BoothLocation" for breakdown display
  const boothBreakdown = useMemo(() => {
    const map = {};
    selectedTrx.forEach(t => {
      (t.items ?? []).forEach(item => {
        const tenantPart = item.tenant_name ? `${item.tenant_name} – ` : '';
        const boothPart  = item.booth_location || t.booth_location || 'Booth';
        const booth = tenantPart + boothPart;
        if (!map[booth]) map[booth] = [];
        map[booth].push(item);
      });
    });
    return map;
  }, [selectedTrx]);

  async function handleAddProduct(product) {
    // Add to the first (or only) TRX in selection
    if (!selectedTrx[0]) return;
    setAddingProduct(product.id);
    try {
      await addItemToTransaction(selectedTrx[0].transaction_id, product.id, 1);
      setExtraAmount(prev => prev + product.price);
      addToast(`${product.name} ditambahkan`, 'success');
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal menambahkan produk', 'error');
    } finally {
      setAddingProduct(null);
    }
  }

  async function handlePay(e) {
    e.preventDefault();
    setError('');

    if (method === 'CASH') {
      const received = parseFloat(cashReceived);
      if (!received || received < grandTotal) {
        setError('Uang diterima kurang dari total tagihan.'); return;
      }
    }
    if ((method === 'EDC' || method === 'TRANSFER') && !paymentRef.trim()) {
      setError('Masukkan nomor referensi pembayaran.'); return;
    }

    setProcessing(true);
    try {
      const res = await groupCheckout({
        transaction_ids: selectedTrx.map(t => t.transaction_id),
        payment_method:  method,
        cash_received:   method === 'CASH' ? parseFloat(cashReceived) : undefined,
        payment_ref:     paymentRef || undefined,
      });
      setSuccess(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Pembayaran gagal. Coba lagi.');
    } finally {
      setProcessing(false);
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    const booths = [...new Set(selectedTrx.map(t => t.booth_location).filter(Boolean))];
    return (
      <>
        <div className="max-w-lg bg-white rounded-xl border p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Pembayaran Berhasil!</h2>
          <p className="text-sm text-gray-500 mb-5">{new Date(success.paidAt).toLocaleString('id-ID')}</p>

          {/* Invoice card */}
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5 mb-5 text-center">
            <p className="text-xs font-bold text-green-800 uppercase tracking-wide">Invoice / Group</p>
            <p className="text-2xl font-black text-green-700 font-mono my-2">{success.groupCode}</p>
            <p className="text-xs text-green-600 mb-3">{customer.name} · {customer.phone}</p>
            <div className="bg-white p-3 rounded-xl border border-green-200 inline-block mb-3">
              <QRCodeSVG value={success.groupCode} size={120} level="M" includeMargin={false} />
            </div>
            <p className="text-xs text-green-600">
              {selectedTrx.length} Booth · {method} · Total {formatRupiah(success.totalAmount)}
            </p>
          </div>

          {/* Breakdown */}
          <div className="bg-gray-50 rounded-xl p-4 text-left mb-5 space-y-3 text-sm">
            {Object.entries(boothBreakdown).map(([booth, items]) => (
              <div key={booth}>
                <p className="text-xs font-bold text-blue-600 mb-1">{booth}</p>
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-gray-700">
                    <span>{item.product_name} ×{item.quantity}</span>
                    <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span>TOTAL</span>
              <span className="text-blue-700">{formatRupiah(success.totalAmount)}</span>
            </div>
            {success.cashChange > 0 && (
              <div className="flex justify-between text-green-600 font-semibold">
                <span>Kembalian</span>
                <span>{formatRupiah(success.cashChange)}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <PrintGroupReceiptButton
              groupCode={success.groupCode}
              customer={customer}
              boothBreakdown={boothBreakdown}
              totalAmount={success.totalAmount}
              cashReceived={method === 'CASH' ? parseFloat(cashReceived) : null}
              cashChange={success.cashChange ?? null}
              paymentMethod={method}
              paymentRef={paymentRef || undefined}
              cashierName={user?.name ?? user?.username ?? 'Kasir'}
              paidAt={success.paidAt}
              transactionIds={selectedTrx.map(t => t.transaction_id)}
            />
            <Button variant="secondary" size="sm">📱 WhatsApp</Button>
            <Button variant="secondary" size="sm">📧 Email</Button>
          </div>

          {booths.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 mb-4 text-left">
              ⚡ Notifikasi dikirim ke {booths.join(', ')} — siapkan barang untuk customer
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/cashier')}>
              Transaksi Baru
            </Button>
            <Button className="flex-1" onClick={() => navigate('/cashier/rekap')}>
              Lihat Rekap
            </Button>
          </div>
        </div>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 130px)' }}>

        {/* LEFT */}
        <div className="w-[460px] shrink-0 flex flex-col gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 self-start"
          >
            ← Kembali
          </button>

          {/* Group chip */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🔗</span>
            <div>
              <p className="font-bold text-violet-800 text-sm">
                Group — {selectedTrx.length} Transaksi
              </p>
              <p className="text-xs text-violet-600 mt-0.5">{customer.name} · {customer.phone}</p>
            </div>
          </div>

          {/* Item breakdown per booth */}
          <div className="bg-white rounded-xl border">
            <div className="px-4 py-2.5 bg-gray-50 border-b text-xs font-bold text-gray-500 uppercase tracking-wide rounded-t-xl">
              Rincian Item
            </div>
            <div className="p-4 space-y-3 text-sm">
              {Object.entries(boothBreakdown).map(([booth, items]) => (
                <div key={booth}>
                  <p className="text-xs font-bold text-blue-600 mb-1.5">{booth}</p>
                  {items.map((item, i) => (
                    <div key={i} className="flex justify-between text-gray-700 py-0.5">
                      <span>{item.product_name} ×{item.quantity}</span>
                      <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                  {Object.keys(boothBreakdown).indexOf(booth) < Object.keys(boothBreakdown).length - 1 && (
                    <hr className="mt-2" />
                  )}
                </div>
              ))}
              {extraAmount > 0 && (
                <div className="flex justify-between text-gray-500 text-xs">
                  <span>Produk tambahan kasir</span>
                  <span>{formatRupiah(extraAmount)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>TOTAL</span>
                <span className="text-blue-700 text-lg">{formatRupiah(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment form */}
          <form onSubmit={handlePay} className="bg-white rounded-xl border p-4 space-y-4">
            <h2 className="font-semibold text-gray-700">Metode Pembayaran</h2>

            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map(({ id, icon, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setMethod(id); setPaymentRef(''); setCashReceived(''); setError(''); }}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${method === id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >
                  <span className="text-xl">{icon}</span>
                  <span className="text-xs font-bold">{label}</span>
                </button>
              ))}
            </div>

            {/* CASH */}
            {method === 'CASH' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Total Tagihan</label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 font-black text-xl text-blue-800">
                    {formatRupiah(grandTotal)}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Uang Diterima</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    value={cashReceived}
                    onChange={e => { setCashReceived(e.target.value); setError(''); }}
                  />
                </div>
                {parseFloat(cashReceived) > 0 && (
                  <div className={`rounded-lg px-3 py-2.5 flex justify-between items-center ${cashChange >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <span className={`text-sm font-semibold ${cashChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {cashChange >= 0 ? 'Kembalian' : 'Uang kurang'}
                    </span>
                    <span className={`text-lg font-black ${cashChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatRupiah(Math.abs(cashChange ?? 0))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* QRIS */}
            {method === 'QRIS' && (
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="bg-white p-3 rounded-xl border-2 border-gray-200 shadow-sm">
                  <QRCodeSVG value={selectedTrx[0]?.transaction_id ?? 'GROUP'} size={160} level="M" includeMargin={false} />
                </div>
                <p className="text-xs text-center text-gray-500 max-w-[260px]">
                  Tampilkan QR ini ke customer — scan via GoPay, OVO, BSI Mobile, atau app bank lain
                </p>
              </div>
            )}

            {/* EDC / TRANSFER ref */}
            {(method === 'EDC' || method === 'TRANSFER') && (
              <Input
                label="No. Referensi / Approval"
                placeholder="Masukkan nomor referensi"
                value={paymentRef}
                onChange={e => { setPaymentRef(e.target.value); setError(''); }}
              />
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" size="full" loading={processing}>
              Konfirmasi Bayar — {formatRupiah(grandTotal)}
            </Button>
          </form>
        </div>

        {/* RIGHT — product browser */}
        <div className="flex-1 flex flex-col min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tambah Produk</p>

          <div className="relative mb-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2" style={{ scrollbarWidth: 'none' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${activeCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex-1 border-2 border-red-200 rounded-xl overflow-hidden">
            {loadingProducts ? (
              <div className="flex items-center justify-center h-full py-12"><Spinner /></div>
            ) : (
              <div className="h-full overflow-y-auto p-3">
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400 gap-2">
                    <span className="text-3xl">🔍</span>
                    <p className="text-sm">Produk tidak ditemukan</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
                    {filteredProducts.map(p => (
                      <AddProductCard key={p.id} product={p} onAdd={handleAddProduct} adding={addingProduct} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
