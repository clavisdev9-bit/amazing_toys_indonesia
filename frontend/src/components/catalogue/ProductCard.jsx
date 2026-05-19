import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { STORE_MAP, formatPrice } from '../../data/mockData';
import { getStockStatus, getStockBadgeStyle, canAddToCart } from '../../utils/stockUtils';

export default function ProductCard({ product, tourAttr }) {
  const navigate  = useNavigate();
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const primaryStore  = STORE_MAP[product.storeIds[0]];
  const { label: stockLabel, level: stockLevel } = getStockStatus(product.stock);
  const { bg: badgeBg, text: badgeText } = getStockBadgeStyle(stockLevel);
  const addable = canAddToCart(product.stock);

  function goToDetail() {
    navigate(`/product/${product.id}`);
  }

  function handleAddToCart(e) {
    e.stopPropagation();
    addItem({
      product_id:   product.id,
      product_name: product.name,
      price:        product.price,
      tenant_id:    product.storeIds[0],
      tenant_name:  primaryStore?.booth || primaryStore?.name || '',
      image_url:    null,
    }, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
      {...tourAttr}
    >
      {/* Tappable area → product detail */}
      <button onClick={goToDetail} className="text-left w-full">
        <div
          className="aspect-square flex items-center justify-center text-3xl"
          style={{ background: product.colorHex }}
        >
          🧸
        </div>
        <div className="px-2.5 pt-2.5 pb-1.5">
          <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug mb-0.5">
            {product.name}
          </p>
          <p className="text-[10px] text-gray-400 mb-2">
            {primaryStore?.booth || primaryStore?.name || ''}
          </p>
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-bold text-[#2563EB]">{formatPrice(product.price)}</span>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{ background: badgeBg, color: badgeText }}
            >
              {stockLabel}
            </span>
          </div>
        </div>
      </button>

      {/* Cart button — only when stock > 0 */}
      {addable && (
        <div className="px-2.5 pb-2.5">
          <button
            onClick={handleAddToCart}
            disabled={added}
            className={`w-full text-white text-xs font-semibold py-2 rounded-lg transition-colors ${
              added
                ? 'bg-green-500 cursor-default'
                : 'bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {added ? '✓ Ditambahkan' : '+ Keranjang'}
          </button>
        </div>
      )}
    </div>
  );
}
