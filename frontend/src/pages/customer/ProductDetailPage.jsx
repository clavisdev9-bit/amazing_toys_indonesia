import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduct } from '../../api/products';
import { useCart } from '../../hooks/useCart';
import { formatRupiah } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';

export default function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { t } = useLang();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    getProduct(productId)
      .then((r) => setProduct(r.data.data))
      .finally(() => setLoading(false));
  }, [productId]);

  function handleAdd() {
    addItem(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (loading) return <Spinner />;
  if (!product) return <div className="p-4 text-center text-gray-500">{t('product.notFoundDetail')}</div>;

  return (
    <div className="max-w-lg mx-auto">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 px-4 py-3 hover:text-blue-600">
        {t('back')}
      </button>

      {/* Image */}
      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        {product.image_url ? (
          <img src={product.image_url} alt={product.product_name} className="w-full h-full object-contain" />
        ) : (
          <span className="text-8xl">🧸</span>
        )}
      </div>

      {/* Info */}
      <div className="p-4 bg-white">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-bold text-gray-900">{product.product_name}</h1>
          <Badge status={product.stock_status} />
        </div>
        <p className="text-2xl font-bold text-blue-700 mt-1">{formatRupiah(product.price)}</p>

        <div className="mt-3 text-sm text-gray-600 space-y-1">
          <p>{t('product.booth')}: <span className="font-medium">{product.tenant_name}</span></p>
          <p>{t('product.location')}: <span className="font-medium">{product.booth_location}</span></p>
          <p>{t('product.stock')}: <span className="font-medium">{product.stock_quantity} pcs</span></p>
        </div>

        {product.description && (
          <p className="mt-3 text-sm text-gray-500 leading-relaxed">{product.description}</p>
        )}
      </div>

      {/* Add to cart */}
      {product.stock_status !== 'OUT_OF_STOCK' && (
        <div className="p-4 bg-white border-t flex items-center gap-3">
          <div className="flex items-center gap-2 border rounded-lg">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-9 h-9 flex items-center justify-center text-lg text-gray-600 hover:bg-gray-100 rounded-l-lg"
            >−</button>
            <span className="w-8 text-center text-sm font-medium">{qty}</span>
            <button
              onClick={() => setQty((q) => Math.min(product.stock_quantity, q + 1))}
              className="w-9 h-9 flex items-center justify-center text-lg text-gray-600 hover:bg-gray-100 rounded-r-lg"
            >+</button>
          </div>
          <Button
            onClick={handleAdd}
            variant={added ? 'success' : 'primary'}
            className="flex-1"
          >
            {added ? t('product.addedFull') : t('product.addToCartFull')}
          </Button>
        </div>
      )}
    </div>
  );
}
