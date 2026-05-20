import React from 'react';
import ProductCard from './ProductCard';
import { useLang } from '../../context/LangContext';

export default function ProductGrid({ products, firstCardTourAttr }) {
  const { t } = useLang();
  if (products.length === 0) {
    return (
      <div className="py-12 text-center col-span-2 px-4">
        <div className="text-4xl mb-3">😔</div>
        <p className="text-sm font-bold mb-1" style={{ color: 'rgba(30,40,100,0.80)' }}>{t('product.notFound')}</p>
        <p className="text-xs" style={{ color: 'rgba(80,95,160,0.60)' }}>{t('product.tryOther')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-4 pb-4">
      {products.map((p, idx) => (
        <ProductCard
          key={p.id}
          product={p}
          tourAttr={idx === 0 ? firstCardTourAttr : undefined}
        />
      ))}
    </div>
  );
}
