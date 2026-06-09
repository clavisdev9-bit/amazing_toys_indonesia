import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, getCategories, getProductByBarcode } from '../../api/products';
import { createCashierOrder } from '../../api/cashier';
import { formatRupiah } from '../../utils/format';
import { canAddToCart, getStockStatus, getStockBadgeStyle } from '../../utils/stockUtils';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import VoucherInput from '../../components/cart/VoucherInput';

function normalizeProduct(p) {
  return {
    id: p.product_id,
    name: p.product_name,
    price: p.price,
    category: p.category,
    stock: p.stock_quantity,
    image_url: p.image_url || null,
    tenant_id: p.tenant_id || null,
    tenant_name: p.tenant_name,
    barcode: p.barcode || null,
  };
}

function ProductCard({ product, onAdd }) {
  const { level } = getStockStatus(product.stock);
  const { bg, text } = getStockBadgeStyle(level);
  const addable = canAddToCart(product.stock);
  const stockLabel = { out: 'Habis', low: 'Terbatas', available: 'Tersedia' }[level] ?? 'Tersedia';
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden flex flex-col transition-all ${
        addable ? 'border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-pointer' : 'border-gray-100 opacity-60'
      }`}
      onClick={() => addable && onAdd(product)}
    >
      <div className="aspect-square bg-gray-50 flex items-center justify-center" style={{ minHeight: 64 }}>
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
          disabled={!addable}
          className={`w-full py-1 rounded-lg text-[11px] font-semibold transition-colors mt-auto ${
            addable ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {addable ? '+ Tambah' : 'Habis'}
        </button>
      </div>
    </div>
  );
}

export default function CashierPOSPage() {
  const navigate = useNavigate();
  const barcodeInputRef = useRef(null);

  // Customer
  const [customerPhone, setCustomerPhone] = useState('');

  // Barcode scanner
  const [barcodeInput, setBarcodeInput]     = useState('');
  const [barcodeError, setBarcodeError]     = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  // Product browser
  const [products, setProducts]             = useState([]);
  const [categories, setCategories]         = useState(['Semua']);
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [search, setSearch]                 = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Cart
  const [cart, setCart]           = useState([]);
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    Promise.all([getProducts({ limit: 500 }), getCategories()])
      .then(([prodRes, catRes]) => {
        const rawProds = prodRes.data.data?.items ?? [];
        const rawCats  = catRes.data.data ?? [];
        setProducts(rawProds.map(normalizeProduct));
        setCategories(['Semua', ...rawCats.filter(c => c !== 'All')]);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory !== 'Semua') list = list.filter(p => p.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.tenant_name || '').toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, search]);

  // ── Barcode scan ──────────────────────────────────────────────────────────
  async function handleBarcodeScan(e) {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    setBarcodeError('');
    setBarcodeLoading(true);
    try {
      const res = await getProductByBarcode(code);
      const raw = res.data.data;
      if (!raw) throw new Error('Produk tidak ditemukan.');
      const product = normalizeProduct(raw);
      if (!canAddToCart(product.stock)) {
        setBarcodeError(`"${product.name}" stok habis.`);
        return;
      }
      addToCart(product);
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
    } catch (err) {
      setBarcodeError(err.response?.data?.message || err.message || 'Produk tidak ditemukan.');
    } finally {
      setBarcodeLoading(false);
    }
  }

  // ── Cart operations ───────────────────────────────────────────────────────
  function addToCart(product) {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1, stock: product.stock, tenant_id: product.tenant_id }];
    });
    setAppliedVoucher(null); // reset voucher when cart changes
  }

  function setQty(id, qty) {
    setAppliedVoucher(null);
    if (qty < 1) {
      setCart(prev => prev.filter(i => i.id !== id));
    } else {
      setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
    }
  }

  function removeItem(id) {
    setAppliedVoucher(null);
    setCart(prev => prev.filter(i => i.id !== id));
  }

  const subtotal    = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalQty    = cart.reduce((s, i) => s + i.qty, 0);
  const discount    = appliedVoucher?.discount_amount || 0;
  const cartTenantIds = [...new Set(cart.map(i => i.tenant_id).filter(Boolean))];
  const cartItems   = cart.map(i => ({ price: i.price, quantity: i.qty, tenant_id: i.tenant_id }));

  // ── Checkout ──────────────────────────────────────────────────────────────
  async function handleBayar() {
    if (cart.length === 0) return;
    setError('');
    setCreating(true);
    try {
      const items  = cart.map(i => ({ product_id: i.id, quantity: i.qty }));
      const phone  = customerPhone.trim() || null;
      const voucher = appliedVoucher?.code || null;
      const res    = await createCashierOrder(items, phone, voucher);
      const txnId  = res.data.data?.transactionId;
      navigate(`/cashier/bayar/${txnId}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal membuat pesanan. Coba lagi.';
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-8rem)]">

      {/* ── Top: Phone + Barcode row ───────────────────────────────────────── */}
      <div className="flex gap-3 shrink-0">

        {/* Customer phone */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex-1 min-w-0">
          <span className="text-base shrink-0">📱</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400 mb-0.5">No. HP Customer (opsional)</p>
            <input
              type="tel"
              placeholder="08xxxxxxxxxx — kosongkan untuk Walk-in"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              className="w-full text-sm font-medium text-gray-800 focus:outline-none bg-transparent placeholder:text-gray-300"
            />
          </div>
          {customerPhone && (
            <button onClick={() => setCustomerPhone('')} className="text-gray-400 hover:text-gray-600 text-xs shrink-0">✕</button>
          )}
        </div>

        {/* Barcode scanner */}
        <form onSubmit={handleBarcodeScan} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex-1 min-w-0">
          <span className="text-base shrink-0">🔍</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400 mb-0.5">Scan Barcode</p>
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan atau ketik barcode..."
              value={barcodeInput}
              onChange={e => { setBarcodeInput(e.target.value); setBarcodeError(''); }}
              className="w-full text-sm font-medium text-gray-800 focus:outline-none bg-transparent placeholder:text-gray-300"
            />
          </div>
          {barcodeLoading
            ? <Spinner className="w-4 h-4 shrink-0" />
            : <button type="submit" className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-colors">Cari</button>
          }
        </form>
      </div>

      {/* Barcode error */}
      {barcodeError && (
        <p className="shrink-0 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{barcodeError}</p>
      )}

      {/* ── Main: Product browser + Cart ──────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Left: Product Browser */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="Cari produk..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 shrink-0 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product grid */}
          {loadingProducts ? (
            <div className="flex-1 flex items-center justify-center"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Tidak ada produk ditemukan.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {filtered.map(p => (
                  <ProductCard key={p.id} product={p} onAdd={addToCart} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Cart Panel */}
        <div className="w-72 shrink-0 flex flex-col bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-800 text-sm">
              🛒 Keranjang
              {totalQty > 0 && (
                <span className="ml-2 bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {totalQty}
                </span>
              )}
            </h2>
            {customerPhone && (
              <p className="text-[10px] text-blue-600 mt-0.5 font-medium">📱 {customerPhone}</p>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto divide-y">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm py-12 px-4 text-center">
                <span className="text-4xl mb-3">🧸</span>
                <p>Belum ada produk.</p>
                <p className="text-xs mt-1">Klik produk atau scan barcode.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="px-3 py-2">
                  <p className="text-xs font-semibold text-gray-800 truncate mb-1">{item.name}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setQty(item.id, item.qty - 1)}
                        className="w-6 h-6 rounded border border-gray-300 text-gray-600 text-xs font-bold flex items-center justify-center hover:bg-gray-100 transition-colors"
                      >−</button>
                      <span className="w-6 text-center text-xs font-bold text-gray-800">{item.qty}</span>
                      <button
                        onClick={() => setQty(item.id, item.qty + 1)}
                        disabled={item.qty >= item.stock}
                        className="w-6 h-6 rounded border border-gray-300 text-gray-600 text-xs font-bold flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-40"
                      >+</button>
                    </div>
                    <span className="text-xs font-bold text-blue-700">{formatRupiah(item.price * item.qty)}</span>
                    <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-gray-50 space-y-2">
            {error && (
              <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">{error}</p>
            )}

            {/* Subtotal + diskon */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Subtotal</span>
              <span className="text-sm font-bold text-gray-900">{formatRupiah(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-green-600">Diskon voucher</span>
                <span className="text-sm font-bold text-green-600">-{formatRupiah(discount)}</span>
              </div>
            )}
            <p className="text-[10px] text-gray-400">+ PPN dihitung saat proses pembayaran</p>

            {/* Voucher input */}
            {cart.length > 0 && (
              <VoucherInput
                cartTotal={subtotal}
                tenantIds={cartTenantIds}
                items={cartItems}
                onVoucherApplied={(v) => setAppliedVoucher(v)}
                onVoucherRemoved={() => setAppliedVoucher(null)}
              />
            )}

            <Button
              onClick={handleBayar}
              disabled={cart.length === 0 || creating}
              loading={creating}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              💳 Bayar
            </Button>
            {cart.length > 0 && (
              <button
                onClick={() => { setCart([]); setAppliedVoucher(null); }}
                className="w-full text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Kosongkan keranjang
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
