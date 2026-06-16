import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBoothProducts } from '../../api/helper';
import { toggleProductPreorder } from '../../api/products';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n ?? 0);
}

export default function ProductPreorderTogglePage() {
  const navigate = useNavigate();
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(null); // product_id being saved
  const [error, setError]         = useState('');
  const [toast, setToast]         = useState(null);
  // editing state: { [product_id]: { is_preorder, preorder_note } }
  const [edits, setEdits] = useState({});

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchProducts = useCallback(() => {
    setLoading(true);
    getBoothProducts()
      .then(r => {
        const list = r.data.data ?? [];
        setProducts(list);
        // Initialise edits from current DB state
        const init = {};
        list.forEach(p => {
          init[p.product_id] = {
            is_preorder:   !!p.is_preorder,
            preorder_note: p.preorder_note || '',
          };
        });
        setEdits(init);
        setError('');
      })
      .catch(() => setError('Gagal memuat produk. Coba refresh.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  async function handleSave(productId) {
    const edit = edits[productId];
    if (!edit) return;
    setSaving(productId);
    try {
      await toggleProductPreorder(productId, edit.is_preorder, edit.preorder_note || null);
      setProducts(prev => prev.map(p =>
        p.product_id === productId
          ? { ...p, is_preorder: edit.is_preorder, preorder_note: edit.preorder_note || null }
          : p
      ));
      showToast(edit.is_preorder ? 'Produk dijadikan Pre-Order.' : 'Produk diubah ke reguler.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal menyimpan.', 'error');
    } finally {
      setSaving(null);
    }
  }

  function patchEdit(productId, patch) {
    setEdits(prev => ({ ...prev, [productId]: { ...prev[productId], ...patch } }));
  }

  function isDirty(productId) {
    const p = products.find(x => x.product_id === productId);
    if (!p) return false;
    const e = edits[productId];
    if (!e) return false;
    return e.is_preorder !== !!p.is_preorder || e.preorder_note !== (p.preorder_note || '');
  }

  return (
    <div className="max-w-lg mx-auto pb-10">
      {/* Global toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white`}
          style={{ transform: 'translateX(-50%)', minWidth: 220, textAlign: 'center',
            background: toast.type === 'error' ? '#DC2626' : '#059669' }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold text-gray-900 text-sm">🔖 Kelola Status Pre-Order</h1>
          <p className="text-xs text-gray-400">Toggle produk yang dijual sebagai pre-order</p>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-3">📦</span>
          <p className="text-gray-600 font-semibold">Tidak ada produk</p>
          <p className="text-sm text-gray-400 mt-1">Belum ada produk yang terdaftar di booth ini.</p>
        </div>
      ) : (
        <div className="divide-y bg-white mt-2 rounded-xl mx-2 shadow-sm border overflow-hidden">
          {products.map(product => {
            const edit    = edits[product.product_id] ?? { is_preorder: false, preorder_note: '' };
            const dirty   = isDirty(product.product_id);
            const isSaving = saving === product.product_id;

            return (
              <div key={product.product_id} className={`px-4 py-3 ${edit.is_preorder ? 'bg-orange-50' : ''}`}>
                {/* Product info row */}
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-xl overflow-hidden">
                    {product.image_url
                      ? <img src={product.image_url} className="w-full h-full object-cover" alt="" />
                      : '🧸'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800 truncate">{product.product_name}</p>
                      {edit.is_preorder && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
                          PRE-ORDER
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{formatRupiah(product.price)}</p>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => patchEdit(product.product_id, { is_preorder: !edit.is_preorder })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 mt-0.5
                      ${edit.is_preorder ? 'bg-orange-500' : 'bg-gray-200'}`}
                  >
                    <span
                      className={`inline-block w-4 h-4 transform bg-white rounded-full shadow transition-transform
                        ${edit.is_preorder ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>

                {/* Pre-order note input */}
                {edit.is_preorder && (
                  <div className="mt-2">
                    <input
                      className="w-full border border-orange-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                      placeholder="Catatan pre-order (estimasi kedatangan, dll.)"
                      value={edit.preorder_note}
                      onChange={e => patchEdit(product.product_id, { preorder_note: e.target.value })}
                      maxLength={500}
                    />
                  </div>
                )}

                {/* Save button — shown only when dirty */}
                {dirty && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={isSaving}
                      onClick={() => handleSave(product.product_id)}
                      style={{ background: edit.is_preorder ? '#EA580C' : '#6366F1' }}
                    >
                      Simpan
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
