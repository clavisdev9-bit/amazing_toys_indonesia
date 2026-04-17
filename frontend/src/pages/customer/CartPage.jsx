import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { createOrder } from '../../api/orders';
import { formatRupiah } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';

export default function CartPage() {
  const { items, updateQty, removeItem, clearCart, totalAmount } = useCart();
  const navigate = useNavigate();
  const { t } = useLang();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCheckout() {
    setError('');
    setLoading(true);
    try {
      const orderItems = items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
      const res = await createOrder(orderItems);
      console.log('✅ Order API Response:', res.data);
      const data = res.data.data;
      console.log('✅ Order data extracted:', { 
        transactionId: data.transactionId,
        totalAmount: data.totalAmount,
        qrPayloadLength: data.qrPayload?.length,
        qrPayloadStart: data.qrPayload?.substring(0, 50),
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
        stack: err.response?.data?.stack,
        fullError: err
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

      <div className="divide-y bg-white">
        {items.map((item) => (
          <div key={item.product_id} className="px-4 py-3 flex gap-3">
            <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 text-2xl">
              {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover rounded-lg" /> : '🧸'}
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
                  {item.quantity > 1 && (
                    <>
                      <span className="w-6 text-center text-xs">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.product_id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-600"
                      >+</button>
                    </>
                  )}
                  {item.quantity === 1 && (
                    <>
                      <span className="w-6 text-center text-xs">1</span>
                      <button
                        onClick={() => updateQty(item.product_id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-600"
                      >+</button>
                    </>
                  )}
                </div>
                <span className="text-sm font-semibold text-blue-700">
                  {formatRupiah(item.price * item.quantity)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="p-4 bg-white border-t mt-2">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-600">{t('cart.total')}</span>
          <span className="text-xl font-bold text-blue-700">{formatRupiah(totalAmount)}</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {t('cart.pendingNote')}
        </p>
        <Button size="full" onClick={handleCheckout} loading={loading}>
          {t('cart.checkout')}
        </Button>
      </div>
    </div>
  );
}
