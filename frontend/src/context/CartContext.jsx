import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import { getActivePromos } from '../api/vouchers';

export const CartContext = createContext(null);

function loadCart() {
  try {
    const stored = sessionStorage.getItem('sos_cart');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  sessionStorage.setItem('sos_cart', JSON.stringify(items));
}

/**
 * Hitung free items dari active promo rules berdasarkan cart items.
 * Sama dengan logika di backend (calculateFreeItems) — untuk preview cart saja.
 * Validasi stok definitif tetap dilakukan di backend saat checkout.
 */
function derivePromoFreeItems(cartItems, rules) {
  const freeItems = [];
  for (const rule of rules) {
    const cartItem = cartItems.find(i => i.product_id === rule.buy_product_id);
    if (!cartItem) continue;

    const rawFree = Math.floor(cartItem.quantity / rule.buy_qty) * rule.free_qty;
    if (rawFree <= 0) continue;

    const maxCapped = (rule.max_free_qty != null)
      ? Math.min(rawFree, rule.max_free_qty)
      : rawFree;

    const stockAvailable = rule.free_product_stock != null
      ? parseInt(rule.free_product_stock, 10)
      : Infinity;
    const finalQty = Math.min(maxCapped, stockAvailable);
    if (finalQty <= 0) continue;

    freeItems.push({
      product_id:        rule.free_product_id,
      product_name:      rule.free_product_name,
      price:             0,
      quantity:          finalQty,
      tenant_id:         rule.voucher_tenant_id || cartItem.tenant_id,
      tenant_name:       cartItem.tenant_name,
      is_free:           true,
      free_reason:       rule.voucher_code,
      buy_product_name:  rule.buy_product_name,
      capped_by_max:     rule.max_free_qty != null && rawFree > rule.max_free_qty,
      capped_by_stock:   stockAvailable < maxCapped,
    });
  }
  return freeItems;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  // ── Voucher state (diskon PERCENT/FIXED) ──────────────────────────────────
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  const applyVoucher = useCallback((voucherData) => {
    setAppliedVoucher(voucherData);
    setDiscountAmount(voucherData.discount_amount || 0);
  }, []);

  const removeVoucher = useCallback(() => {
    setAppliedVoucher(null);
    setDiscountAmount(0);
  }, []);

  // ── Product Promo state (B1G1/B2G1) ──────────────────────────────────────
  const [activePromos, setActivePromos] = useState([]);

  // itemsKey: stabil string agar useEffect tidak re-run tiap render
  const itemsKey = items.map(i => `${i.product_id}:${i.quantity}`).join(',');

  useEffect(() => {
    const productIds = items.map(i => i.product_id).filter(Boolean);
    if (!productIds.length) {
      setActivePromos([]);
      return;
    }
    getActivePromos(productIds)
      .then(res => setActivePromos(res.data?.data || []))
      .catch(() => setActivePromos([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  // Free items dihitung ulang setiap cart atau promo berubah
  const freeItems = useMemo(
    () => derivePromoFreeItems(items, activePromos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsKey, activePromos]
  );

  // ── Cart operations ───────────────────────────────────────────────────────

  const addItem = useCallback((product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.product_id);
      let next;
      if (existing) {
        next = prev.map((i) =>
          i.product_id === product.product_id
            ? { ...i, quantity: i.quantity + qty }
            : i
        );
      } else {
        next = [...prev, {
          product_id:   product.product_id,
          product_name: product.product_name,
          price:        product.price,
          tenant_id:    product.tenant_id,
          tenant_name:  product.tenant_name,
          image_url:    product.image_url,
          is_on_hold:   product.is_on_hold  || false,
          is_preorder:  product.is_preorder || false,
          quantity:     qty,
        }];
      }
      saveCart(next);
      return next;
    });
  }, []);

  const updateQty = useCallback((productId, qty) => {
    setItems((prev) => {
      const next = qty <= 0
        ? prev.filter((i) => i.product_id !== productId)
        : prev.map((i) => i.product_id === productId ? { ...i, quantity: qty } : i);
      saveCart(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.product_id !== productId);
      saveCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    sessionStorage.removeItem('sos_cart');
    setItems([]);
    setAppliedVoucher(null);
    setDiscountAmount(0);
    setActivePromos([]);
  }, []);

  const markOnHold = useCallback((productIds) => {
    const idSet = new Set(productIds);
    setItems((prev) => {
      const next = prev.map((i) =>
        idSet.has(i.product_id) ? { ...i, is_on_hold: true } : i,
      );
      saveCart(next);
      return next;
    });
  }, []);

  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalItems  = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, addItem, updateQty, removeItem, clearCart, totalAmount, totalItems,
      markOnHold,
      appliedVoucher, discountAmount, applyVoucher, removeVoucher,
      freeItems, activePromos,
    }}>
      {children}
    </CartContext.Provider>
  );
}
