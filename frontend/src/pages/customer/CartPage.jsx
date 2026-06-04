import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { createOrder } from '../../api/orders';
import { formatRupiah } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import { usePublicConfig } from '../../hooks/useAppLogo';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import VoucherInput from '../../components/cart/VoucherInput';

export default function CartPage() {
  const {
    items, updateQty, removeItem, clearCart, totalAmount,
    appliedVoucher, discountAmount, applyVoucher, removeVoucher,
  } = useCart();
  const navigate = useNavigate();
  const { t }    = useLang();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const config           = usePublicConfig();
  const ppnRate          = parseFloat(config?.ppn_rate) || 0;
  const maxItemsPerOrder = parseInt(config?.max_items_per_order, 10) || 20;
  const totalQty         = items.reduce((sum, i) => sum + i.quantity, 0);
  const isOverLimit      = totalQty > maxItemsPerOrder;

  // Tenant IDs for voucher scope check
  const tenantIds = [...new Set(items.map(i => i.tenant_id).filter(Boolean))];

  // Price breakdown (all pre-tax, then add PPN on discounted base)
  const subtotalRaw  = totalAmount;                                           // pre-tax, pre-discount
  const discountRaw  = discountAmount;                                        // pre-tax
  const taxableRaw   = subtotalRaw - discountRaw;                             // pre-tax after discount
  const taxRaw       = Math.round(taxableRaw * ppnRate / 100);
  const grandTotal   = taxableRaw + taxRaw;

  async function handleCheckout() {
    setError('');
    setLoading(true);
    try {
      const orderItems = items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
      const res = await createOrder(orderItems, appliedVoucher?.code || null);
      console.log('✅ Order API Response:', res.data);
      const data = res.data.data;
      console.log('✅ Order data extracted:', {
        transactionId: data.transactionId,
        totalAmount: data.totalAmount,
        discountAmount: data.discountAmount,
        qrPayloadLength: data.qrPayload?.length,
      });
      clearCart();
      navigate('/checkout/sukses', { state: data });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || t('cart.checkoutError');
      setError(errorMsg);
      console.error('❌ Checkout error details:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        error: err.response?.data?.error,
      });
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
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
    <div className="max-w-lg mx-auto">
      <div className="px-4 py-3 font-semibold text-gray-800 border-b bg-white sticky top-[57px] z-10">
        {t('cart.title', { count: items.length })}
      </div>

      <div id="tour-cart-items" className="divide-y bg-white">
        {items.map((item) => (
          <div key={item.product_id} className="px-4 py-3 flex gap-3">
            <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 text-2xl">
              {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover rounded-lg" alt="" /> : '🧸'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 line-clamp-2">{item.product_name}</p>
              <p className="text-xs text-gray-400 mb-1">{item.tenant_name}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 border rounded">
                  <button
                    onClick={() => removeItem(item.product_id)}
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
                <span className="text-sm font-semibold text-blue-700">
                  {formatRupiah(Math.round(item.price * item.quantity * (1 + ppnRate / 100)))}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Voucher input */}
      <div className="px-4 py-3 bg-white border-t mt-2">
        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Voucher Diskon</p>
        <VoucherInput
          cartTotal={subtotalRaw}
          tenantIds={tenantIds}
          items={items}
          onVoucherApplied={applyVoucher}
          onVoucherRemoved={removeVoucher}
        />
      </div>

      {/* Summary */}
      <div id="tour-cart-total" className="p-4 bg-white border-t">
        {isOverLimit && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">
            Maksimal <strong>{maxItemsPerOrder} item</strong> per order. Saat ini <strong>{totalQty} item</strong> — kurangi sebelum checkout.
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}

        {/* Price rows */}
        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-700">{formatRupiah(subtotalRaw)}</span>
          </div>
          {discountRaw > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600">
                Diskon{appliedVoucher?.code ? ` (${appliedVoucher.code})` : ''}
              </span>
              <span className="text-green-600 font-medium">− {formatRupiah(discountRaw)}</span>
            </div>
          )}
          {ppnRate > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">PPN {ppnRate}%</span>
              <span className="text-gray-700">{formatRupiah(taxRaw)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="font-semibold text-gray-800">{t('cart.total')}</span>
            <span className="text-xl font-bold text-blue-700">{formatRupiah(grandTotal)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400">{totalQty} / {maxItemsPerOrder} item</span>
          {isOverLimit && <span className="text-xs text-red-500 font-medium">Melebihi batas</span>}
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {t('cart.pendingNote')}
        </p>
        <div id="tour-checkout-btn">
          <Button size="full" onClick={handleCheckout} loading={loading} disabled={isOverLimit}>
            {t('cart.checkout')}
          </Button>
        </div>
      </div>
    </div>
  );
}
