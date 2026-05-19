import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PRODUCTS, STORE_MAP, formatPrice } from '../../data/mockData';
import { getStockStatus, getStockBadgeStyle } from '../../utils/stockUtils';
import { useCart } from '../../hooks/useCart';
import QuantitySelector from '../../components/catalogue/QuantitySelector';

export default function MockProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [expandStores, setExpandStores] = useState(false);
  const [added, setAdded] = useState(false);

  const product = PRODUCTS.find(p => p.id === id);

  if (!product) {
    return (
      <div className="max-w-[390px] mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-sm font-medium text-gray-700 mb-1">Produk tidak ditemukan</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-[#2563EB]">
          ← Kembali
        </button>
      </div>
    );
  }

  const primaryStore   = STORE_MAP[product.storeIds[0]];
  const additionalStores = product.storeIds.slice(1).map(sid => STORE_MAP[sid]).filter(Boolean);

  const { label: stockLabel, level: stockLevel } = getStockStatus(product.stock);
  const { bg: badgeBg, text: badgeText } = getStockBadgeStyle(stockLevel);
  const inStock = product.stock > 0;

  function handleAddToCart() {
    addItem({
      product_id:   product.id,
      product_name: product.name,
      price:        product.price,
      tenant_id:    product.storeIds[0],
      tenant_name:  primaryStore?.booth || primaryStore?.name || '',
      image_url:    null,
    }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <>
      {/* Scrollable content — extra bottom padding when action bar is visible */}
      <div className={`max-w-[390px] mx-auto bg-white ${inStock ? 'pb-[88px]' : 'pb-6'}`}>

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 px-4 pt-4 pb-2 hover:text-gray-700"
        >
          ← Kembali
        </button>

        {/* Product image */}
        <div className="w-full aspect-square flex items-center justify-center bg-gray-100 text-7xl">
          🧸
        </div>

        {/* Info */}
        <div className="px-4 pt-4">
          {/* Name + badge */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-[18px] font-bold text-gray-900 leading-snug flex-1">
              {product.name}
            </h1>
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0 mt-0.5"
              style={{ background: badgeBg, color: badgeText }}
            >
              {stockLabel}
            </span>
          </div>

          {/* Price */}
          <p className="text-[22px] font-bold text-[#2563EB] mb-5">
            {formatPrice(product.price)}
          </p>

          {/* Store info */}
          {primaryStore && (
            <div className="flex flex-col gap-2.5 text-[13px] border-t pt-4">
              <div className="flex gap-2">
                <span className="text-gray-400 w-14 shrink-0">Booth</span>
                <span className="font-semibold text-gray-800">{primaryStore.booth}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-14 shrink-0">Lokasi</span>
                <span className="font-semibold text-gray-800">{primaryStore.lokasi}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-14 shrink-0">Stok</span>
                <span className="font-semibold text-gray-800">{product.stock} pcs</span>
              </div>
            </div>
          )}

          {/* Additional stores */}
          {additionalStores.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <button
                onClick={() => setExpandStores(v => !v)}
                className="flex items-center gap-1 text-xs font-medium text-[#534AB7]"
              >
                {expandStores ? '▲' : '▼'} Lihat semua lokasi ({additionalStores.length + 1} toko)
              </button>
              {expandStores && (
                <div className="mt-3 flex flex-col gap-2">
                  {[primaryStore, ...additionalStores].filter(Boolean).map(store => (
                    <div
                      key={store.id}
                      className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-[13px]"
                    >
                      <span
                        className="text-[10px] font-medium px-2 py-1 rounded-md shrink-0"
                        style={{ background: store.colorHex, color: store.textColorHex }}
                      >
                        {store.floor}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{store.booth}</p>
                        <p className="text-xs text-gray-400 truncate">{store.lokasi}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky action bar — above CustomerShell bottom nav (h=64px) */}
      {inStock && (
        <div className="fixed bottom-16 left-0 right-0 z-20 bg-white border-t px-4 py-3">
          <div className="max-w-[390px] mx-auto flex items-center gap-3">
            <QuantitySelector
              value={qty}
              min={1}
              max={product.stock}
              onChange={setQty}
            />
            <button
              onClick={handleAddToCart}
              disabled={added}
              className={`flex-1 font-semibold text-sm py-3 rounded-xl transition-colors ${
                added
                  ? 'bg-green-500 text-white cursor-default'
                  : 'bg-[#2563EB] text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {added ? '✓ Ditambahkan ke Keranjang' : 'Tambah ke Keranjang'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
