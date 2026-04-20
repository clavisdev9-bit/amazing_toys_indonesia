import React, { useState, useEffect, useCallback } from 'react';
import ProductBulkUpload from '../ProductBulkUpload';
import {
  getAdminProducts, adminCreateProduct, adminUpdateProduct,
  adminDeleteProduct, uploadProductImage, syncStock,
} from '../../../api/admin';
import { useAuth } from '../../../hooks/useAuth';
import { getTenants } from '../../../api/tenants';
import { getCategories } from '../../../api/products';
import { formatRupiah, formatDate } from '../../../utils/format';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import CategoryCombobox from '../../../components/ui/CategoryCombobox';
import ComboboxField from '../../../components/ui/ComboboxField';
import Modal from '../../../components/ui/Modal';
import Spinner from '../../../components/ui/Spinner';
import EmptyState from '../../../components/ui/EmptyState';
import ToastContainer from '../../../components/ui/Toast';
import { useToast } from '../../../hooks/useToast';
import { useOdooProductCategories } from '../../../hooks/useOdooProductCategories';

const EMPTY_FORM = {
  product_id: '', product_name: '', category: '', price: '',
  tenant_id: '', barcode: '', stock_quantity: '0', description: '', image_url: '',
  odoo_categ_id: null, odoo_categ_name: '', is_active: true,
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Defined outside MasterDataTab so its identity is stable across re-renders.
// Defining it inside would cause React to unmount/remount inputs on every
// keystroke (new component type each render), which destroys cursor focus.
function FormFields({ isEdit, form, setForm, tenants, categories, odooCategories, odooLoading, odooError }) {
  return (
    <>
      {!isEdit && (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Product ID *" placeholder="P001-T001"
            value={form.product_id}
            onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value.toUpperCase() }))}
            required />
          <Input label="Barcode *" placeholder="8999999001234"
            value={form.barcode}
            onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
            required />
        </div>
      )}
      {isEdit && (
        <Input label="Barcode *" value={form.barcode}
          onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
          required />
      )}
      <Input label="Nama Produk *" value={form.product_name}
        onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
        required />
      <div className="grid grid-cols-2 gap-3">
        <CategoryCombobox label="Kategori *"
          value={form.category}
          onChange={(val) => setForm((f) => ({ ...f, category: val }))}
          categories={categories}
          required />
        <Input label="Harga (Rp) *" type="number" min="1"
          value={form.price}
          onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!isEdit ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tenant *</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.tenant_id}
              onChange={(e) => setForm((f) => ({ ...f, tenant_id: e.target.value }))}
              required>
              <option value="">-- Pilih Tenant --</option>
              {tenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>{t.tenant_name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tenant</label>
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              value={form.tenant_id}
              disabled>
              {tenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>{t.tenant_name}</option>
              ))}
            </select>
          </div>
        )}
        <Input label="Stok *" type="number" min="0"
          value={form.stock_quantity}
          onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
          required />
      </div>
      <ComboboxField
        label="Kategori Odoo *"
        options={odooCategories.map(c => ({ value: c.id, label: c.completeName }))}
        value={form.odoo_categ_id}
        onChange={(opt) => setForm(f => ({ ...f, odoo_categ_id: opt?.value ?? null, odoo_categ_name: opt?.label ?? '' }))}
        isLoading={odooLoading}
        error={odooError}
        required
        placeholder="Ketik untuk mencari kategori Odoo..."
      />
      <Input label="Deskripsi" value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      <Input label="Image URL" placeholder="/uploads/... atau https://..."
        value={form.image_url}
        onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
      {isEdit && (
        <div className="flex items-center gap-3 py-1">
          <label className="text-sm font-medium text-gray-700">Status Produk</label>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
          <span className={`text-xs font-medium ${form.is_active ? 'text-green-600' : 'text-red-500'}`}>
            {form.is_active ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>
      )}
    </>
  );
}

export default function MasterDataTab() {
  const { role } = useAuth();
  const { toasts, addToast, removeToast } = useToast();
  const { categories: odooCategories, isLoading: odooLoading, error: odooError } = useOdooProductCategories();
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [products, setProducts]           = useState([]);
  const [tenants, setTenants]             = useState([]);
  const [categories, setCategories]       = useState([]);
  const [loading, setLoading]             = useState(false);
  const [search, setSearch]               = useState('');
  const [filterTenant, setFilterTenant]   = useState('');
  const [includeInactive, setInclude]     = useState(true);

  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal]     = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [imageModal, setImageModal]   = useState(null);

  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');

  const [uploadFile, setUploadFile]   = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [previewUrl, setPreviewUrl]   = useState(null);

  const [syncingToOdoo, setSyncingToOdoo] = useState(false);

  // ── Pagination state ──────────────────────────────────────────────────────
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(20);
  const [pagination, setPagination] = useState({ total: 0, page: 1, page_size: 20, total_pages: 1 });

  const fetchProducts = useCallback(() => {
    setLoading(true);
    getAdminProducts({
      search:           search || undefined,
      tenant_id:        filterTenant || undefined,
      include_inactive: String(includeInactive),
      page,
      page_size:        pageSize,
    })
      .then((r) => {
        setProducts(r.data.data?.items ?? []);
        if (r.data.data?.pagination) setPagination(r.data.data.pagination);
      })
      .catch(() => addToast('Gagal memuat produk.', 'error'))
      .finally(() => setLoading(false));
  }, [search, filterTenant, includeInactive, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 whenever filters change
  const resetPage = useCallback(() => setPage(1), []);

  useEffect(() => { resetPage(); }, [search, filterTenant, includeInactive, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => {
    getTenants({ active_only: false }).then((r) => setTenants(r.data.data ?? []));
    getCategories().then((r) => setCategories(r.data.data ?? []));
  }, []);

  const resolveCategory = useCallback((raw) => {
    const match = categories.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
    return match ?? raw.trim();
  }, [categories]);

  if (showBulkUpload) {
    return <ProductBulkUpload onBack={() => { setShowBulkUpload(false); fetchProducts(); }} />;
  }

  async function handleSyncToOdoo() {
    if (syncingToOdoo) return;
    setSyncingToOdoo(true);
    try {
      const data = (await syncStock()).data;
      if (data?.total != null) {
        const msg = data.skipped > 0
          ? `Synced ${data.synced}/${data.total} — ${data.skipped} skipped`
          : `Synced ${data.synced} products`;
        addToast(msg, 'success');
      } else {
        addToast('Sync selesai.', 'success');
      }
      fetchProducts();
    } catch (err) {
      addToast(err.response?.data?.message || err.message || 'Sync failed.', 'error');
    } finally {
      setSyncingToOdoo(false);
    }
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setCreateModal(true);
  }

  function openEdit(p) {
    const odooCat = odooCategories.find(c => c.id === p.odoo_categ_id) ?? null;
    setForm({
      product_id:      p.product_id,
      product_name:    p.product_name,
      category:        p.category,
      price:           String(p.price),
      tenant_id:       p.tenant_id,
      barcode:         p.barcode,
      stock_quantity:  String(p.stock_quantity),
      description:     p.description || '',
      image_url:       p.image_url   || '',
      odoo_categ_id:   p.odoo_categ_id ?? null,
      odoo_categ_name: odooCat?.completeName ?? '',
      is_active:       p.is_active ?? true,
    });
    setFormError('');
    setEditModal(p);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    if (!form.odoo_categ_id) { setFormError('Kategori Odoo wajib dipilih.'); return; }
    setSaving(true);
    try {
      await adminCreateProduct({
        ...form,
        category:       resolveCategory(form.category),
        price:          parseFloat(form.price),
        stock_quantity: parseInt(form.stock_quantity, 10),
        image_url:      form.image_url || undefined,
        description:    form.description || undefined,
        categ_id:       form.odoo_categ_id,
      });
      addToast('Produk berhasil dibuat.', 'success');
      setCreateModal(false);
      Promise.all([fetchProducts(), getCategories().then((r) => setCategories(r.data.data ?? []))]);
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Gagal membuat produk.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.odoo_categ_id) { setFormError('Kategori Odoo wajib dipilih.'); return; }
    setSaving(true);
    try {
      await adminUpdateProduct(editModal.product_id, {
        product_name:   form.product_name,
        category:       resolveCategory(form.category),
        price:          parseFloat(form.price),
        stock_quantity: parseInt(form.stock_quantity, 10),
        barcode:        form.barcode,
        description:    form.description || null,
        image_url:      form.image_url   || null,
        categ_id:       form.odoo_categ_id,
        is_active:      form.is_active,
      });
      addToast('Produk diperbarui.', 'success');
      setEditModal(null);
      Promise.all([fetchProducts(), getCategories().then((r) => setCategories(r.data.data ?? []))]);
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Gagal memperbarui produk.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await adminDeleteProduct(deleteModal.product_id);
      addToast('Produk dinonaktifkan.', 'success');
      setDeleteModal(null);
      fetchProducts();
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal menonaktifkan.', 'error');
    }
  }

  async function handleRestore(p) {
    try {
      await adminUpdateProduct(p.product_id, { is_active: true });
      addToast(`${p.product_name} diaktifkan kembali.`, 'success');
      fetchProducts();
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal mengaktifkan.', 'error');
    }
  }

  function onFileChange(e) {
    const f = e.target.files[0];
    setUploadFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function handleImageUpload(e) {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(uploadFile);
      const r      = await uploadProductImage({ base64 });
      const url    = r.data.data.url;
      await adminUpdateProduct(imageModal.product_id, { image_url: url });
      addToast('Foto berhasil diupload.', 'success');
      setImageModal(null);
      setUploadFile(null);
      setPreviewUrl(null);
      fetchProducts();
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal upload foto.', 'error');
    } finally {
      setUploading(false);
    }
  }

  const stockColor = (qty) =>
    qty === 0 ? 'text-red-500' : qty <= 5 ? 'text-amber-600' : 'text-green-600';

  const statusBadge = (p) => {
    if (!p.is_active)                        return 'bg-red-100 text-red-600';
    if (p.stock_status === 'OUT_OF_STOCK')   return 'bg-gray-100 text-gray-500';
    if (p.stock_status === 'LOW_STOCK')      return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  const statusLabel = (p) => {
    if (!p.is_active)                        return 'Nonaktif';
    if (p.stock_status === 'OUT_OF_STOCK')   return 'Habis';
    if (p.stock_status === 'LOW_STOCK')      return 'Sedikit';
    return 'Tersedia';
  };


  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white mb-0">
        <span className="text-base">📦</span>
        <h2 className="text-sm font-semibold flex-1">Daftar Produk</h2>
        {role === 'ADMIN' && (
          <Button size="sm" onClick={handleSyncToOdoo} disabled={syncingToOdoo}
            className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
            {syncingToOdoo ? '⟳ Syncing…' : '↻ Sync to Odoo'}
          </Button>
        )}
        <Button size="sm" onClick={() => setShowBulkUpload(true)}
          className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
          ⬆ Upload Massal
        </Button>
        <Button size="sm" onClick={openCreate}
          className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
          + Tambah Produk
        </Button>
      </div>

      <div className="mb-4" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="text" placeholder="Cari produk / ID / barcode..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-60" />
        <select value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Semua Tenant</option>
          {tenants.map((t) => <option key={t.tenant_id} value={t.tenant_id}>{t.tenant_name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setInclude(e.target.checked)} className="rounded" />
          Tampilkan nonaktif
        </label>
      </div>

      {/* Table */}
      {loading ? <Spinner /> : products.length === 0 ? (
        <EmptyState icon="📦" title="Belum ada produk" />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['ID / Nama','Kategori','Harga','Tenant','Stok','Status','Foto','Diperbarui','Aksi'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product_id}
                    className={`border-b last:border-0 ${!p.is_active ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900">{p.product_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.product_id}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{p.category}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">{formatRupiah(p.price)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{p.tenant_name}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold">
                      <span className={stockColor(p.stock_quantity)}>{p.stock_quantity}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(p)}`}>
                        {statusLabel(p)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {p.image_url
                        ? <img src={p.image_url} alt="" className="w-9 h-9 object-cover rounded border" />
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{formatDate(p.updated_at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => openEdit(p)}
                          className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100">Edit</button>
                        <button onClick={() => { setImageModal(p); setUploadFile(null); setPreviewUrl(null); }}
                          className="px-2 py-1 text-xs rounded border border-blue-300 text-blue-600 hover:bg-blue-50">Foto</button>
                        {p.is_active
                          ? <button onClick={() => setDeleteModal(p)}
                              className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50">Nonaktif</button>
                          : <button onClick={() => handleRestore(p)}
                              className="px-2 py-1 text-xs rounded border border-green-300 text-green-700 hover:bg-green-50">Aktifkan</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span>Baris per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-gray-400">
                {pagination.total === 0 ? '0' : `${(pagination.page - 1) * pagination.page_size + 1}–${Math.min(pagination.page * pagination.page_size, pagination.total)}`} dari {pagination.total}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:cursor-not-allowed">
                ‹ Prev
              </button>
              <span className="px-3 py-1 font-medium">
                {pagination.page} / {pagination.total_pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:cursor-not-allowed">
                Next ›
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Tambah Produk Baru">
        <form onSubmit={handleCreate} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <FormFields isEdit={false} form={form} setForm={setForm} tenants={tenants} categories={categories}
            odooCategories={odooCategories} odooLoading={odooLoading} odooError={odooError} />
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{formError}</div>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setCreateModal(false)}>Batal</Button>
            <Button type="submit" className="flex-1" loading={saving}>Simpan</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Produk">
        <form onSubmit={handleEdit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-xs text-gray-400 font-mono">
            {editModal?.product_id} &bull; Tenant: {editModal?.tenant_name}
          </p>
          <FormFields isEdit={true} form={form} setForm={setForm} tenants={tenants} categories={categories}
            odooCategories={odooCategories} odooLoading={odooLoading} odooError={odooError} />
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{formError}</div>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditModal(null)}>Batal</Button>
            <Button type="submit" className="flex-1" loading={saving}>Simpan</Button>
          </div>
        </form>
      </Modal>

      {/* Image Upload Modal */}
      <Modal open={!!imageModal} onClose={() => { setImageModal(null); setUploadFile(null); setPreviewUrl(null); }} title="Upload Foto Produk">
        <form onSubmit={handleImageUpload} className="space-y-3">
          <p className="text-sm text-gray-600 font-medium">{imageModal?.product_name}</p>
          {imageModal?.image_url && !previewUrl && (
            <div className="flex justify-center">
              <img src={imageModal.image_url} alt="current" className="h-28 object-contain rounded border" />
            </div>
          )}
          {previewUrl && (
            <div className="flex justify-center">
              <img src={previewUrl} alt="preview" className="h-28 object-contain rounded border" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Pilih Gambar</label>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
              className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            <p className="text-xs text-gray-400">Format: JPG, PNG, WEBP &bull; Maks 2 MB</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1"
              onClick={() => { setImageModal(null); setUploadFile(null); setPreviewUrl(null); }}>Batal</Button>
            <Button type="submit" className="flex-1" loading={uploading} disabled={!uploadFile}>Upload</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Nonaktifkan Produk">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Nonaktifkan produk <span className="font-semibold">{deleteModal?.product_name}</span>?
            Produk tidak akan muncul di katalog pelanggan.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteModal(null)}>Batal</Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete}>Nonaktifkan</Button>
          </div>
        </div>
      </Modal>

    </>
  );
}
