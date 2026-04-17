import { useState, useEffect, useCallback } from 'react';
import { getAdminTenants, adminCreateTenant, adminUpdateTenant } from '../../../api/admin';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import Spinner from '../../../components/ui/Spinner';
import EmptyState from '../../../components/ui/EmptyState';
import ToastContainer from '../../../components/ui/Toast';
import { useToast } from '../../../hooks/useToast';

const EMPTY_FORM = {
  tenant_name: '',
  booth_location: '',
  floor_label: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
};

// Defined at module scope to avoid re-mount on re-render
function FormFields({ form, setForm }) {
  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }
  return (
    <div className="space-y-3">
      <Input label="Nama Booth / Tenant" placeholder="ToysWorld"
        value={form.tenant_name}
        onChange={(e) => set('tenant_name', e.target.value)}
        required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Lokasi Booth" placeholder="Hall A, Stand A1"
          value={form.booth_location}
          onChange={(e) => set('booth_location', e.target.value)}
          required />
        <Input label="Label Lantai" placeholder="GF / LG / L1"
          value={form.floor_label}
          onChange={(e) => set('floor_label', e.target.value)} />
      </div>
      <Input label="Nama Kontak PIC" placeholder="Budi Santoso"
        value={form.contact_name}
        onChange={(e) => set('contact_name', e.target.value)}
        required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="No. HP Kontak" placeholder="08xxxxxxxxxx"
          value={form.contact_phone}
          onChange={(e) => set('contact_phone', e.target.value)}
          required />
        <Input label="Email Kontak" type="email" placeholder="pic@tenant.com"
          value={form.contact_email}
          onChange={(e) => set('contact_email', e.target.value)} />
      </div>
    </div>
  );
}

function BoothRow({ tenant, onEdit, onToggle }) {
  return (
    <tr className="hover:bg-gray-50 border-b last:border-0">
      <td className="px-4 py-3">
        <p className="font-semibold text-gray-900 text-sm">{tenant.tenant_name}</p>
        <p className="text-xs font-mono text-gray-400">{tenant.tenant_id}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        <p>{tenant.booth_location}</p>
        {tenant.floor_label && <p className="text-xs text-gray-400">{tenant.floor_label}</p>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        <p>{tenant.contact_name}</p>
        <p className="text-xs text-gray-400">{tenant.contact_phone}</p>
        {tenant.contact_email && <p className="text-xs text-gray-400">{tenant.contact_email}</p>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
          ${tenant.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {tenant.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => onEdit(tenant)}
            className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100">
            Edit
          </button>
          <button onClick={() => onToggle(tenant)}
            className={`px-2.5 py-1 text-xs rounded border
              ${tenant.is_active
                ? 'border-red-300 text-red-600 hover:bg-red-50'
                : 'border-green-300 text-green-700 hover:bg-green-50'}`}>
            {tenant.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function BoothTab() {
  const { toasts, addToast, removeToast } = useToast();
  const [tenants, setTenants]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const [createModal, setCreateModal] = useState(false);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [creating, setCreating]       = useState(false);
  const [formError, setFormError]     = useState('');

  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm]   = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);

  const fetchTenants = useCallback(() => {
    setLoading(true);
    getAdminTenants({ search: search || undefined, include_inactive: 'true' })
      .then((r) => setTenants(r.data.data ?? []))
      .catch(() => addToast('Gagal memuat data booth.', 'error'))
      .finally(() => setLoading(false));
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      await adminCreateTenant(form);
      addToast(`Booth ${form.tenant_name} berhasil ditambahkan.`, 'success');
      setCreateModal(false);
      setForm({ ...EMPTY_FORM });
      fetchTenants();
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Gagal membuat booth.');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(tenant) {
    setEditModal(tenant);
    setEditForm({
      tenant_name:    tenant.tenant_name,
      booth_location: tenant.booth_location,
      floor_label:    tenant.floor_label    ?? '',
      contact_name:   tenant.contact_name,
      contact_phone:  tenant.contact_phone,
      contact_email:  tenant.contact_email  ?? '',
    });
  }

  async function handleEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminUpdateTenant(editModal.tenant_id, editForm);
      addToast('Booth diperbarui.', 'success');
      setEditModal(null);
      fetchTenants();
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal memperbarui booth.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(tenant) {
    try {
      await adminUpdateTenant(tenant.tenant_id, { is_active: !tenant.is_active });
      addToast(
        `${tenant.tenant_name} ${!tenant.is_active ? 'diaktifkan' : 'dinonaktifkan'}.`,
        'success'
      );
      fetchTenants();
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal mengubah status.', 'error');
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white mb-4">
        <span className="text-base">🏪</span>
        <h2 className="text-sm font-semibold flex-1">Manajemen Booth Tenant</h2>
        <Button size="sm"
          onClick={() => { setForm({ ...EMPTY_FORM }); setFormError(''); setCreateModal(true); }}
          className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
          + Tambah Booth
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Cari nama booth, lokasi, atau kontak..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Table */}
      {loading ? <Spinner /> : tenants.length === 0 ? (
        <EmptyState icon="🏪" title="Belum ada booth terdaftar" />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Nama / ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Lokasi</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Kontak PIC</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <BoothRow key={t.tenant_id} tenant={t} onEdit={openEdit} onToggle={handleToggle} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400">
            {tenants.length} booth terdaftar &bull; {tenants.filter((t) => t.is_active).length} aktif
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Tambah Booth Baru">
        <form onSubmit={handleCreate} className="space-y-3">
          <FormFields form={form} setForm={setForm} />
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setCreateModal(false)}>
              Batal
            </Button>
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" loading={creating}>
              Tambah Booth
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Booth">
        <form onSubmit={handleEdit} className="space-y-3">
          <p className="text-xs text-gray-400 font-mono">ID: {editModal?.tenant_id}</p>
          <FormFields form={editForm} setForm={setEditForm} />
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditModal(null)}>
              Batal
            </Button>
            <Button type="submit" className="flex-1" loading={saving}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
