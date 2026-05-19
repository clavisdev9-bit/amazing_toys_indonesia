import React from 'react';
import ProductCard from './ProductCard';

export default function ProductGrid({ products, firstCardTourAttr }) {
  if (products.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-sm font-medium text-gray-700 mb-1">Produk tidak ditemukan</p>
        <p className="text-xs text-gray-400">Coba kategori atau toko lain</p>
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
