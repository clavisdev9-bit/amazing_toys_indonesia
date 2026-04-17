import React, { createContext, useState, useCallback } from 'react';

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

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  const updateItems = useCallback((next) => {
    setItems(next);
    saveCart(next);
  }, []);

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
          product_id: product.product_id,
          product_name: product.product_name,
          price: product.price,
          tenant_id: product.tenant_id,
          tenant_name: product.tenant_name,
          image_url: product.image_url,
          quantity: qty,
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
  }, []);

  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateQty, removeItem, clearCart, totalAmount, totalItems }}>
      {children}
    </CartContext.Provider>
  );
}
