// import React from 'react';
// import ProductCard from './ProductCard';
// import { useLang } from '../../context/LangContext';

// export default function ProductGrid({ products, firstCardTourAttr }) {
//   const { t } = useLang();
//   if (products.length === 0) {
//     return (
//       <div className="py-12 text-center col-span-2 px-4">
//         <div className="text-4xl mb-3">😔</div>
//         <p className="text-sm font-bold mb-1" style={{ color: 'rgba(30,40,100,0.80)' }}>{t('product.notFound')}</p>
//         <p className="text-xs" style={{ color: 'rgba(80,95,160,0.60)' }}>{t('product.tryOther')}</p>
//       </div>
//     );
//   }

//   return (
//     <div className="grid grid-cols-2 gap-3 px-4 pb-4">
//       {products.map((p, idx) => (
//         <ProductCard
//           key={p.id}
//           product={p}
//           tourAttr={idx === 0 ? firstCardTourAttr : undefined}
//           isFirstCard={idx === 0}
//         />
//       ))}
//     </div>
//   );
// }


import React, { useState, useRef, useCallback } from 'react';
import ProductCard from './ProductCard';
import { useLang } from '../../context/LangContext';

const PAGE_SIZE = 10; // jumlah produk per batch

export default function ProductGrid({ products, firstCardTourAttr }) {
  const { t } = useLang();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerRef = useRef(null);

  // Sentinel ref — elemen kosong di bawah grid sebagai trigger
  const sentinelRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, products.length));
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(node);
  }, [products.length]);

  if (products.length === 0) {
    return (
      <div className="py-12 text-center col-span-2 px-4">
        <div className="text-4xl mb-3">😔</div>
        <p className="text-sm font-bold mb-1" style={{ color: 'rgba(30,40,100,0.80)' }}>
          {t('product.notFound')}
        </p>
        <p className="text-xs" style={{ color: 'rgba(80,95,160,0.60)' }}>
          {t('product.tryOther')}
        </p>
      </div>
    );
  }

  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        {visibleProducts.map((p, idx) => (
          <ProductCard
            key={p.id}
            product={p}
            tourAttr={idx === 0 ? firstCardTourAttr : undefined}
            isFirstCard={idx === 0}
          />
        ))}
      </div>

      {/* Sentinel: trigger load lebih banyak */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{
                  background: 'rgba(59,91,219,0.45)',
                  animationDelay: `${i * 120}ms`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pesan saat semua produk sudah tampil */}
      {!hasMore && products.length > PAGE_SIZE && (
        <p className="text-center text-xs pb-6" style={{ color: 'rgba(80,95,160,0.50)' }}>
          {t('product.allLoaded') ?? 'Semua produk sudah ditampilkan'}
        </p>
      )}
    </>
  );
}