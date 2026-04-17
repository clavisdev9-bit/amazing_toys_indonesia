import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, getCategories } from '../../api/products';
import { useCart } from '../../hooks/useCart';
import { formatRupiah } from '../../utils/format';
import { useLang } from '../../context/LangContext';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

export default function BrowsePage() {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const { t } = useLang();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [added, setAdded] = useState({});

  useEffect(() => {
    getCategories().then((r) => setCategories(r.data.data ?? []));
  }, []);

  const fetchProducts = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const res = await getProducts({ search, category, in_stock_only: inStockOnly || undefined, page: currentPage, limit: 20 });
      const { items, total: t } = res.data.data;
      if (reset) {
        setProducts(items);
        setPage(1);
      } else {
        setProducts((p) => (currentPage === 1 ? items : [...p, ...items]));
      }
      setTotal(t);
    } finally {
      setLoading(false);
    }
  }, [search, category, inStockOnly, page]);

  useEffect(() => {
    fetchProducts(true);
  }, [search, category, inStockOnly]);

  function handleAddToCart(product) {
    if (product.stock_status === 'OUT_OF_STOCK') return;
    addItem(product, 1);
    setAdded((a) => ({ ...a, [product.product_id]: true }));
    setTimeout(() => setAdded((a) => ({ ...a, [product.product_id]: false })), 1500);
  }

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    setLoading(true);
    getProducts({ search, category, in_stock_only: inStockOnly || undefined, page: nextPage, limit: 20 })
      .then((res) => {
        const { items } = res.data.data;
        setProducts((p) => [...p, ...items]);
      })
      .finally(() => setLoading(false));
  }

  const hasMore = products.length < total;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Search bar */}
      <div className="sticky top-[57px] bg-gray-50 px-4 pt-3 pb-2 z-20 border-b">
        <input
          type="text"
          placeholder={t('search.placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setCategory('')}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors
            ${!category ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
        >
          {t('filter.all')}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat === category ? '' : cat)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors
              ${cat === category ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* In-stock toggle */}
      <div className="px-4 pb-2 flex items-center gap-2 text-sm text-gray-600">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="rounded"
          />
          {t('filter.inStockOnly')}
        </label>
        <span className="ml-auto text-gray-400 text-xs">{t('filter.productCount', { count: total })}</span>
      </div>

      {/* Products grid */}
      {products.length === 0 && !loading ? (
        <EmptyState icon="🔍" title={t('product.notFound')} description={t('product.tryOther')} />
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          {products.map((p) => (
            <div key={p.product_id} className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
              <div
                className="aspect-square bg-gray-100 flex items-center justify-center cursor-pointer"
                onClick={() => navigate(`/katalog/${p.product_id}`)}
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">🧸</span>
                )}
              </div>
              <div className="p-2 flex flex-col gap-1 flex-1">
                <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight">{p.product_name}</p>
                <p className="text-xs text-gray-400">{p.tenant_name}</p>
                <div className="flex items-center justify-between mt-auto pt-1">
                  <span className="text-sm font-bold text-blue-700">{formatRupiah(p.price)}</span>
                  <Badge status={p.stock_status} />
                </div>
                <button
                  onClick={() => handleAddToCart(p)}
                  disabled={p.stock_status === 'OUT_OF_STOCK'}
                  className={`w-full mt-1 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${p.stock_status === 'OUT_OF_STOCK'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : added[p.product_id]
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {added[p.product_id] ? t('product.added') : t('product.addToCart')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && <Spinner />}

      {hasMore && !loading && (
        <div className="px-4 pb-6">
          <button
            onClick={loadMore}
            className="w-full py-2 border border-blue-600 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50"
          >
            {t('product.loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
