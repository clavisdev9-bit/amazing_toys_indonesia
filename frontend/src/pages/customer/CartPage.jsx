import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { useWishlist } from '../../hooks/useWishlist';
import { useWebSocket } from '../../hooks/useWebSocket';
import { createOrder } from '../../api/orders';
import { formatRupiah } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import { usePublicConfig } from '../../hooks/useAppLogo';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import VoucherInput from '../../components/cart/VoucherInput';
import StockApprovalModal from '../../components/cart/StockApprovalModal';

// ── Saved-for-later persistence (sessionStorage) ────────────────────────────
const SFL_KEY = 'sos_saved_for_later';
function loadSFL() {
  try { return JSON.parse(sessionStorage.getItem(SFL_KEY) || '[]'); } catch { return []; }
}
function saveSFL(items) {
  sessionStorage.setItem(SFL_KEY, JSON.stringify(items));
}

// ── WS availability toast ───────────────────────────────────────────────────
function ProductAvailableToast({ product, onMoveToCart, onDismiss }) {
  const [visible, setVisible] = useState(true);
  const timer = useRef(null);
  const { t } = useLang();

  useEffect(() => {
    timer.current = setTimeout(() => { setVisible(false); onDismiss(); }, 9000);
    return () => clearTimeout(timer.current);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm"
      style={{ transform: 'translateX(-50%)', animation: 'slideDownFade 0.3s ease' }}
    >
      <div
        className="rounded-2xl px-4 py-3.5 flex items-start gap-3"
        style={{
          background: 'rgba(235,252,245,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(8,127,91,0.25)',
          boxShadow: '0 8px 30px rgba(8,127,91,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <span className="text-xl shrink-0">🎉</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-emerald-800 line-clamp-1">
            {product.product_name}
          </p>
          <p className="text-[11px] text-emerald-600 mt-0.5">
            {t('cart.stockAvailablePrompt')}
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => { setVisible(false); onMoveToCart(product); }}
              className="text-[11px] font-bold text-white px-3 py-1.5 rounded-lg"
              style={{ background: 'linear-gradient(135deg,#087F5B,#2F9E44)' }}
            >
              {t('cart.moveToCart')}
            </button>
            <button
              onClick={() => { setVisible(false); onDismiss(); }}
              className="text-[11px] font-semibold text-emerald-700 px-2 py-1.5 rounded-lg"
              style={{ background: 'rgba(8,127,91,0.08)' }}
            >
              {t('common.later')}
            </button>
          </div>
        </div>
        <button
          onClick={() => { setVisible(false); onDismiss(); }}
          className="text-emerald-400 text-lg leading-none shrink-0"
        >×</button>
      </div>
    </div>
  );
}

// ── Saved-for-later item row ────────────────────────────────────────────────
function SavedForLaterRow({ item, onMoveToCart, onRemove, ppnRate, isAvailable, t }) {
  return (
    <div
      className="px-4 py-3 flex gap-3 relative"
      style={isAvailable ? { background: 'rgba(235,252,245,0.5)' } : {}}
    >
      {/* Thumbnail */}
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 text-xl"
        style={{ background: 'rgba(245,247,255,0.8)' }}
      >
        {item.image_url
          ? <img src={item.image_url} className="w-full h-full object-cover rounded-lg" alt="" />
          : '🧸'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="text-[12px] font-semibold text-gray-700 line-clamp-2 leading-snug">
            {item.product_name}
          </p>
          <button
            onClick={() => onRemove(item.product_id)}
            className="text-gray-300 hover:text-red-400 text-sm shrink-0 mt-0.5 ml-1"
          >×</button>
        </div>
        <p className="text-[10px] text-gray-400 mb-1.5">{item.tenant_name}</p>

        <div className="flex items-center justify-between">
          {/* Status badge */}
          {isAvailable ? (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(8,127,91,0.1)', color: '#087F5B' }}
            >
              {t('cart.stockAvailable')}
            </span>
          ) : (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,183,0,0.12)', color: '#B45309' }}
            >
              {t('cart.waitingForStock')}
            </span>
          )}

          <button
            onClick={() => onMoveToCart(item)}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-opacity active:opacity-70"
            style={
              isAvailable
                ? {
                    background: 'linear-gradient(135deg,#3B5BDB,#4C6EF5)',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(59,91,219,0.3)',
                  }
                : {
                    background: 'rgba(59,91,219,0.08)',
                    color: '#3B5BDB',
                  }
            }
          >
            {t('product.addToCart')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function CartPage() {
  const {
    items, updateQty, removeItem, clearCart, totalAmount, addItem,
    markOnHold,
    appliedVoucher, discountAmount, applyVoucher, removeVoucher,
  } = useCart();
  const { toggleWish } = useWishlist();
  const { subscribe }  = useWebSocket();
  const navigate       = useNavigate();
  const { t }          = useLang();

  const config           = usePublicConfig();
  const ppnRate          = parseFloat(config?.ppn_rate) || 0;
  const maxItemsPerOrder = parseInt(config?.max_items_per_order, 10) || 20;
  const orderMode        = config?.order_mode ?? 'HELPER_INPUT';
  const isHelperMode     = orderMode === 'HELPER_INPUT';
  const isApproveMode    = orderMode === 'HELPER_APPROVE';
  const totalQty         = items.reduce((sum, i) => sum + i.quantity, 0);
  const isOverLimit      = totalQty > maxItemsPerOrder;

  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Saved for later state
  const [savedForLater, setSavedForLater] = useState(loadSFL);
  // productId → true when WS says it's now available
  const [availableProducts, setAvailableProducts] = useState({});
  // WS toast queue
  const [availableToast, setAvailableToast] = useState(null);

  // ── Split cart items ───────────────────────────────────────────────────────
  const approvedItems = items.filter((i) => !i.is_on_hold);
  const waitingItems  = items.filter((i) => i.is_on_hold);
  const hasWaiting    = waitingItems.length > 0;

  // ── Tenant IDs for voucher scope ───────────────────────────────────────────
  const tenantIds = [...new Set(approvedItems.map((i) => i.tenant_id).filter(Boolean))];

  // ── Price breakdown (approved items only when modal triggered) ─────────────
  const subtotalRaw     = totalAmount;
  const discountRaw     = discountAmount;
  const taxableRaw      = subtotalRaw - discountRaw;
  const taxRaw          = Math.round(taxableRaw * ppnRate / 100);
  const grandTotal      = taxableRaw + taxRaw;
  // Display: tax-inclusive subtotal (before discount) for customer-facing summary
  const subtotalInclTax = Math.round(subtotalRaw * (1 + ppnRate / 100));

  // ── WS: listen for PRODUCT_AVAILABLE ──────────────────────────────────────
  useEffect(() => {
    const unsub = subscribe('PRODUCT_AVAILABLE', (msg) => {
      const productId = msg.data?.productId;
      if (!productId) return;

      // Mark available
      setAvailableProducts((prev) => ({ ...prev, [productId]: true }));

      // Promote is_on_hold items in cart to available
      // (this is visual only — real re-validation happens at checkout)

      // Show toast only if product is in saved-for-later
      const saved = loadSFL();
      const matchSaved = saved.find((s) => s.product_id === productId);
      if (matchSaved) {
        setAvailableToast(matchSaved);
      }
    });
    return unsub;
  }, [subscribe]);

  // ── Saved-for-later helpers ────────────────────────────────────────────────
  const persistSFL = useCallback((next) => {
    setSavedForLater(next);
    saveSFL(next);
  }, []);

  function saveItemsForLater(itemsToSave) {
    const currentSFL = loadSFL();
    const newIds = new Set(currentSFL.map((s) => s.product_id));
    const merged = [...currentSFL];
    itemsToSave.forEach((item) => {
      if (!newIds.has(item.product_id)) merged.push({ ...item, savedAt: Date.now() });
    });
    persistSFL(merged);
    // Also add to wishlist API (fire-and-forget)
    itemsToSave.forEach((item) => toggleWish(item.product_id).catch(() => {}));
  }

  function handleRemoveSFL(productId) {
    persistSFL(savedForLater.filter((s) => s.product_id !== productId));
  }

  function handleMoveToCart(savedItem) {
    addItem({
      product_id:   savedItem.product_id,
      product_name: savedItem.product_name,
      price:        savedItem.price,
      tenant_id:    savedItem.tenant_id,
      tenant_name:  savedItem.tenant_name,
      image_url:    savedItem.image_url,
      is_on_hold:   false, // moving back means stok is available
    }, savedItem.quantity || 1);
    persistSFL(savedForLater.filter((s) => s.product_id !== savedItem.product_id));
  }

  // ── Checkout handlers ──────────────────────────────────────────────────────
  function handlePlaceOrder() {
    if (hasWaiting) {
      setShowApprovalModal(true);
      return;
    }
    doCheckout(items);
  }

  function handleApprovalConfirm() {
    // Save waiting items to SFL, remove from cart, checkout approved
    setShowApprovalModal(false);
    saveItemsForLater(waitingItems);
    waitingItems.forEach((i) => removeItem(i.product_id));
    doCheckout(approvedItems);
  }

  async function doCheckout(checkoutItems) {
    setError('');
    setLoading(true);
    try {
      const orderItems = checkoutItems.map((i) => ({
        product_id: i.product_id,
        quantity:   i.quantity,
      }));
      const res  = await createOrder(orderItems, appliedVoucher?.code || null);
      const data = res.data.data;
      // Only clear approved items, keep waiting (already removed above) & SFL intact
      approvedItems.forEach((i) => removeItem(i.product_id));
      clearCart(); // clears remaining approved
      if (data.status === 'PENDING_APPROVAL') {
        // CR-040: redirect to order tracking — customer waits for helper approval
        navigate(`/pesanan/${data.transactionId}`, { state: { fromApprovalSubmit: true } });
      } else {
        navigate('/checkout/sukses', { state: data });
      }
    } catch (err) {
      // If backend signals specific on-hold products, mark them in cart and show modal
      const onHoldIds = err.response?.data?.meta?.onHoldProductIds;
      if (onHoldIds?.length > 0) {
        markOnHold(onHoldIds);
        setShowApprovalModal(true);
        return;
      }
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || t('cart.checkoutError');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Checkout button label ──────────────────────────────────────────────────
  function checkoutBtnLabel() {
    if (isHelperMode)     return t('cart.contactBooth');
    if (loading)          return t('cart.checkout');
    if (isApproveMode)    return t('cart.submitForApproval');
    if (hasWaiting && approvedItems.length > 0)
      return t('cart.orderAvailable', { count: approvedItems.length });
    if (hasWaiting && approvedItems.length === 0)
      return t('cart.allItemsWaiting');
    return t('cart.checkout');
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (items.length === 0 && savedForLater.length === 0) {
    return (
      <EmptyState
        icon="🛒"
        title={t('cart.empty.title')}
        description={t('cart.empty.desc')}
        action={
          <button onClick={() => navigate('/katalog')} className="text-blue-600 font-medium text-sm">
            {t('cart.toCatalog')}
          </button>
        }
      />
    );
  }

  return (
    <>
      {/* WS availability toast */}
      {availableToast && (
        <ProductAvailableToast
          product={availableToast}
          onMoveToCart={(item) => { handleMoveToCart(item); setAvailableToast(null); }}
          onDismiss={() => setAvailableToast(null)}
        />
      )}

      {/* Approval modal */}
      {showApprovalModal && (
        <StockApprovalModal
          approvedItems={approvedItems}
          waitingItems={waitingItems}
          onConfirm={handleApprovalConfirm}
          onCancel={() => setShowApprovalModal(false)}
        />
      )}

      <div className="max-w-lg mx-auto">
        <div className="px-4 py-3 font-semibold text-gray-800 border-b bg-white sticky top-[57px] z-10">
          {t('cart.title', { count: items.length })}
        </div>

        {/* ── Cart items ──────────────────────────────────────────────────── */}
        <div id="tour-cart-items" className="divide-y bg-white">
          {items.map((item) => (
            <div key={item.product_id} className="px-4 py-3 flex gap-3 relative">
              {/* On-hold dim overlay */}
              {item.is_on_hold && (
                <div
                  className="absolute inset-0 pointer-events-none rounded-none"
                  style={{ background: 'rgba(255,248,220,0.35)' }}
                />
              )}

              <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 text-2xl relative">
                {item.image_url
                  ? <img src={item.image_url} className="w-full h-full object-cover rounded-lg" alt="" />
                  : '🧸'}
                {/* Hold badge overlay on image */}
                {item.is_on_hold && (
                  <div
                    className="absolute bottom-0 right-0 text-[8px] font-bold px-1 py-0.5 rounded-tl-md"
                    style={{ background: 'rgba(230,119,0,0.9)', color: '#fff' }}
                  >
                    HOLD
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-medium text-gray-800 line-clamp-2 flex-1">
                    {item.product_name}
                  </p>
                  {/* Waiting badge */}
                  {item.is_on_hold && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-1"
                      style={{
                        background: 'rgba(255,183,0,0.15)',
                        color: '#B45309',
                        border: '1px solid rgba(230,119,0,0.25)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('cart.waitingForStock')}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-400 mb-1">{item.tenant_name}</p>

                {item.is_on_hold && (
                  <p className="text-[10px] text-amber-600 mb-1.5 leading-snug">
                    {t('cart.unconfirmedNote')}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 border rounded">
                    <button
                      onClick={() =>
                        item.quantity > 1
                          ? updateQty(item.product_id, item.quantity - 1)
                          : removeItem(item.product_id)
                      }
                      className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500"
                    >
                      {item.quantity === 1 ? '🗑' : '−'}
                    </button>
                    <span className="w-6 text-center text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.product_id, item.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-600"
                    >+</button>
                  </div>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: item.is_on_hold ? '#92400E' : '#1D4ED8' }}
                  >
                    {formatRupiah(Math.round(item.price * item.quantity * (1 + ppnRate / 100)))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Saved for later section ──────────────────────────────────────── */}
        {savedForLater.length > 0 && (
          <div className="mt-2 bg-white border-t">
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{ background: 'rgba(245,247,255,0.8)', borderBottom: '1px solid rgba(200,210,240,0.4)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">📌</span>
                <span className="text-[12px] font-bold text-gray-600 uppercase tracking-wide">
                  {t('cart.savedForLater')}
                </span>
              </div>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(59,91,219,0.08)', color: '#3B5BDB' }}
              >
                {t('cart.itemCount', { count: savedForLater.length })}
              </span>
            </div>

            <div className="divide-y divide-gray-50">
              {savedForLater.map((item) => (
                <SavedForLaterRow
                  key={item.product_id}
                  item={item}
                  ppnRate={ppnRate}
                  isAvailable={!!availableProducts[item.product_id]}
                  onMoveToCart={handleMoveToCart}
                  onRemove={handleRemoveSFL}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}

        {/* Only show below sections if there are active cart items */}
        {items.length > 0 && (
          <>
            {/* ── Voucher ───────────────────────────────────────────────── */}
            <div className="px-4 py-3 bg-white border-t mt-2">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                {t('cart.voucherSection')}
              </p>
              <VoucherInput
                cartTotal={subtotalRaw}
                tenantIds={tenantIds}
                items={approvedItems}
                onVoucherApplied={applyVoucher}
                onVoucherRemoved={removeVoucher}
              />
            </div>

            {/* ── Waiting items warning banner ─────────────────────────── */}
            {hasWaiting && (
              <div
                className="mx-4 my-2 px-3.5 py-3 rounded-xl flex items-start gap-2.5"
                style={{
                  background: 'rgba(255,248,220,0.85)',
                  border: '1px solid rgba(230,119,0,0.25)',
                }}
              >
                <span className="text-amber-500 shrink-0 mt-0.5">⚠️</span>
                <div>
                  <p className="text-[12px] font-bold text-amber-800">
                    {t('cart.waitingWarningTitle', { count: waitingItems.length })}
                  </p>
                  <p className="text-[11px] text-amber-600 mt-0.5 leading-relaxed">
                    {t('cart.waitingWarningBody')}
                  </p>
                </div>
              </div>
            )}

            {/* ── Price summary ─────────────────────────────────────────── */}
            <div id="tour-cart-total" className="p-4 bg-white border-t">
              {isHelperMode && (
                <div className="bg-violet-50 border border-violet-200 text-violet-700 text-sm rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                  <span>🙋</span>
                  <span>{t('cart.helperModeWarning')}</span>
                </div>
              )}
              {isApproveMode && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
                  <span className="shrink-0">✅</span>
                  <span>{t('cart.approveModeWarning')}</span>
                </div>
              )}
              {isOverLimit && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">
                  {t('cart.itemLimitWarning', { max: maxItemsPerOrder, current: totalQty })}
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">
                  {error}
                </div>
              )}

              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {t('cart.subtotal')}
                    {ppnRate > 0 && (
                      <span className="text-xs text-gray-400 ml-1">(incl. PPN {ppnRate}%)</span>
                    )}
                  </span>
                  <span className="text-gray-700">{formatRupiah(subtotalInclTax)}</span>
                </div>
                {discountRaw > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600">
                      {t('cart.discount')}{appliedVoucher?.code ? ` (${appliedVoucher.code})` : ''}
                    </span>
                    <span className="text-green-600 font-medium">− {formatRupiah(subtotalInclTax - grandTotal)}</span>
                  </div>
                )}
                {hasWaiting && approvedItems.length > 0 && (
                  <div
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg mt-1"
                    style={{ background: 'rgba(235,252,245,0.7)', color: '#087F5B' }}
                  >
                    <span>{t('cart.estimatedTotal', { count: approvedItems.length })}</span>
                    <span className="font-bold">
                      {formatRupiah(approvedItems.reduce((s, i) =>
                        s + Math.round(i.price * i.quantity * (1 + ppnRate / 100)), 0))}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-semibold text-gray-800">{t('cart.total')}</span>
                  <span className="text-xl font-bold text-blue-700">{formatRupiah(grandTotal)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">{totalQty} / {maxItemsPerOrder} item</span>
                {isOverLimit && <span className="text-xs text-red-500 font-medium">{t('cart.exceedsLimit')}</span>}
              </div>
              <p className="text-xs text-gray-400 mb-3">{t('cart.pendingNote')}</p>

              <div id="tour-checkout-btn">
                <Button
                  size="full"
                  onClick={handlePlaceOrder}
                  loading={loading}
                  disabled={
                    isOverLimit ||
                    isHelperMode ||
                    (!isApproveMode && hasWaiting && approvedItems.length === 0)
                  }
                  style={
                    hasWaiting && approvedItems.length > 0
                      ? {
                          background: 'linear-gradient(135deg,#F59E0B 0%,#D97706 100%)',
                          boxShadow: '0 4px 16px rgba(245,158,11,0.35)',
                        }
                      : undefined
                  }
                >
                  {checkoutBtnLabel()}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Slide-down animation keyframe */}
      <style>{`
        @keyframes slideDownFade {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}
