import React, { useState, useEffect } from 'react';
import { getStockStatus, getStockBadgeStyle } from '../../utils/stockUtils';
import { useLang } from '../../context/LangContext';
import { usePublicConfig } from '../../hooks/useAppLogo';

function formatPrice(price) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price ?? 0);
}

export default function ProductBottomSheet({ product, onClose }) {
  const { t } = useLang();
  const [visible, setVisible] = useState(false);
  const config  = usePublicConfig();
  const ppnRate = parseFloat(config?.ppn_rate) || 0;

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 250);
  }

  const { key: stockKey, level: stockLevel } = getStockStatus(product.stock);
  const { bg: badgeBg, text: badgeText } = getStockBadgeStyle(stockLevel);

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
            style={{ aspectRatio: '16/9', background: product.colorHex || '#F3F4F6' }}
          >
            {product.image_url
              ? <img src={product.image_url} alt={product.name} className="w-full h-full object-contain rounded-xl" />
              : '🧸'}
          </div>

          {/* Name + Stock badge */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-base font-semibold text-gray-900 flex-1">{product.name}</h2>
            <span
              className="text-[10px] font-medium px-2 py-1 rounded-full shrink-0"
              style={{ background: badgeBg, color: badgeText }}
            >
              {t(stockKey)}
            </span>
          </div>

          <p className="text-sm text-gray-400 mb-4">{formatPrice(Math.round(product.price * (1 + ppnRate / 100)))}</p>

          <p className="text-xs font-medium text-gray-500 mb-2">
            Kategori {product.category} · Available at
          </p>

          {/* Booth info */}
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-xs font-medium px-2 py-1 rounded-md shrink-0 bg-[#EEEDFE] text-[#3C3489]">
                {product.floor || '-'}
              </span>
              <span className="flex-1 text-xs font-medium text-gray-800">{product.tenant_name}</span>
              <span className="text-[11px] text-gray-400">{product.booth_location}</span>
            </div>
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
