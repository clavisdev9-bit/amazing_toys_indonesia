import React, { useState, useEffect } from 'react';
import { STORE_MAP, formatPrice } from '../../data/mockData';
import { getStockStatus, getStockBadgeStyle } from '../../utils/stockUtils';

const CATEGORY_ID = {
  'Doll':     'Boneka',
  'Brick':    'Brick',
  'Art toys': 'Art Toys',
  'Hobbies':  'Hobi',
};

export default function ProductBottomSheet({ product, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 250);
  }

  const stores = product.storeIds.map(id => STORE_MAP[id]).filter(Boolean);
  const { label: stockLabel, level: stockLevel } = getStockStatus(product.stock);
  const { bg: badgeBg, text: badgeText } = getStockBadgeStyle(stockLevel);
  const categoryLabel = CATEGORY_ID[product.category] || product.category;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={handleClose}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-[250ms]
          ${visible ? 'opacity-40' : 'opacity-0'}`}
      />

      {/* Sheet */}
      <div
        className={`relative w-full bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto
          transition-transform duration-[250ms] ease-out
          ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-4 pb-6">
          {/* Image */}
          <div
            className="w-full rounded-xl flex items-center justify-center text-5xl mb-4"
            style={{ aspectRatio: '16/9', background: product.colorHex }}
          >
            🧸
          </div>

          {/* Name + Stock badge */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-base font-semibold text-gray-900 flex-1">{product.name}</h2>
            <span
              className="text-[10px] font-medium px-2 py-1 rounded-full shrink-0"
              style={{ background: badgeBg, color: badgeText }}
            >
              {stockLabel}
            </span>
          </div>

          <p className="text-sm text-gray-400 mb-4">{formatPrice(product.price)}</p>

          {/* CR 1 — category prefix on the section label */}
          <p className="text-xs font-medium text-gray-500 mb-2">
            Kategori {categoryLabel} · Available at
          </p>

          <div className="flex flex-col gap-2 mb-4">
            {stores.map(store => (
              <div
                key={store.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100"
              >
                <span
                  className="text-xs font-medium px-2 py-1 rounded-md shrink-0"
                  style={{ background: store.colorHex, color: store.textColorHex }}
                >
                  {store.floor}
                </span>
                <span className="flex-1 text-xs font-medium text-gray-800">{store.name}</span>
                <button className="flex items-center gap-1 text-[11px] text-[#534AB7] font-medium hover:underline">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  Go
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleClose}
            className="w-full py-3 rounded-xl bg-[#EEEDFE] text-[#3C3489] text-sm font-medium hover:bg-[#dddcfc] transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
