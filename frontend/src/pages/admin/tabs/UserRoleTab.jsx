import React, { useState, useEffect, useCallback } from 'react';
import { getUsers, createUser, updateUser, resetPassword } from '../../../api/admin';
import { getTenants } from '../../../api/tenants';
import { formatDate } from '../../../utils/format';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import Spinner from '../../../components/ui/Spinner';
import EmptyState from '../../../components/ui/EmptyState';
import ToastContainer from '../../../components/ui/Toast';
import { useToast } from '../../../hooks/useToast';

const ROLE_TABS = [
  { key: 'CASHIER', label: 'Kasir',  icon: '💳' },
  { key: 'TENANT',  label: 'Tenant', icon: '🏪' },
  { key: 'LEADER',  label: 'Leader', icon: '📊' },
];

const EMPTY_FORM = { username: '', password: '', display_name: '', tenant_id: '' };

function UserRow({ user, tenants, onEdit, onResetPw, onToggle }) {
  const tenant = tenants.find((t) => t.tenant_id === user.tenant_id);
  return (
    <tr className="hover:bg-gray-50 border-b last:border-0">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 text-sm">{user.display_name}</p>
        <p className="text-xs text-gray-400 font-mono">{user.username}</p>
      </td>
      {user.role === 'TENANT' && (
        <td className="px-4 py-3 text-sm text-gray-600">
          {tenant
            ? <span>{tenant.tenant_name}<br /><span className="text-xs text-gray-400">{tenant.booth_location}</span></span>
            : <span className="text-gray-400">—</span>}
        </td>
      )}
      <td className="px-4 py-3 text-xs text-gray-400">
        {user.last_login_at ? formatDate(user.last_login_at) : 'Belum login'}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
          ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {user.is_active ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => onEdit(user)}
            className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100">Edit</button>
          <button onClick={() => onResetPw(user)}
            className="px-2.5 py-1 text-xs rounded border border-amber-300 text-amber-700 hover:bg-amber-50">Reset PW</button>
          <button onClick={() => onToggle(user)}
            className={`px-2.5 py-1 text-xs rounded border
              ${user.is_active
                ? 'border-red-300 text-red-600 hover:bg-red-50'
                : 'border-green-300 text-green-700 hover:bg-green-50'}`}>
            {user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function UserRoleTab() {
  const { toasts, addToast, removeToast } = useToast();
  const [tab, setTab]       = useState('CASHIER');
  const [users, setUsers]   = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);

  const [createModal, setCreateModal] = useState(false);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [creating, setCreating]       = useState(false);
  const [formError, setFormError]     = useState('');

  const [editModal, setEditModal]   = useState(null);
  const [editForm, setEditForm]     = useState({ display_name: '', tenant_id: '' });
  const [saving, setSaving]         = useState(false);

  const [pwModal, setPwModal]   = useState(null);
  const [newPw, setNewPw]       = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    getUsers({ role: tab })
      .then((r) => setUsers(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    getTenants({ active_only: false }).then((r) => setTenants(r.data.data ?? []));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      await createUser({ ...form, role: tab, tenant_id: form.tenant_id || undefined });
      addToast(`User ${form.username} berhasil dibuat.`, 'success');
      setCreateModal(false);
      setForm({ ...EMPTY_FORM });
      fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Gagal membuat user.');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(user) {
    setEditModal(user);
    setEditForm({ display_name: user.display_name, tenant_id: user.tenant_id ?? '' });
  }

  async function handleEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUser(editModal.user_id, {
        display_name: editForm.display_name,
        tenant_id:    editForm.tenant_id || null,
      });
      addToast('User diperbarui.', 'success');
      setEditModal(null);
      fetchUsers();
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal memperbarui.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPw(e) {
    e.preventDefault();
    setResetting(true);
    try {
      await resetPassword(pwModal.user_id, newPw);
      addToast(`Password ${pwModal.username} berhasil direset.`, 'success');
      setPwModal(null);
      setNewPw('');
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal reset password.', 'error');
    } finally {
      setResetting(false);
    }
  }

  async function handleToggle(user) {
    try {
      await updateUser(user.user_id, { is_active: !user.is_active });
      addToast(`${user.username} ${!user.is_active ? 'diaktifkan' : 'dinonaktifkan'}.`, 'success');
      fetchUsers();
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal mengubah status.', 'error');
    }
  }

  const roleLabel = { CASHIER: 'Kasir', TENANT: 'Tenant User', LEADER: 'Leader' };

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white mb-4">
        <span className="text-base">👥</span>
        <h2 className="text-sm font-semibold flex-1">Manajemen Pengguna</h2>
        <Button size="sm"
          onClick={() => { setForm({ ...EMPTY_FORM }); setFormError(''); setCreateModal(true); }}
          className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
          + Tambah {roleLabel[tab]}
        </Button>
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 mb-4">
        {ROLE_TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t.key
                ? 'bg-violet-600 text-white shadow'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600'}`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : users.length === 0 ? (
        <EmptyState icon={ROLE_TABS.find((t) => t.key === tab)?.icon} title="Belum ada pengguna" />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Nama / Username</th>
                  {tab === 'TENANT' && <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Booth</th>}
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Login Terakhir</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow key={u.user_id} user={u} tenants={tenants}
                    onEdit={openEdit}
                    onResetPw={(user) => { setPwModal(user); setNewPw(''); }}
                    onToggle={handleToggle} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)}
        title={`Tambah ${roleLabel[tab]} Baru`}>
        <form onSubmit={handleCreate} className="space-y-3">
          <Input label="Nama Tampilan" placeholder="Kasir Tiga / ToysWorld Portal"
            value={form.display_name}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
            required />
          <Input label="Username" placeholder="kasir03 / tenant_t002"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
            required />
          <Input label="Password" type="password" placeholder="Min. 6 karakter"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required />
          {tab === 'TENANT' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Booth Tenant <span className="text-red-500">*</span></label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.tenant_id}
                onChange={(e) => setForm((f) => ({ ...f, tenant_id: e.target.value }))}
                required>
                <option value="">-- Pilih booth --</option>
                {tenants.filter((t) => t.is_active).map((t) => (
                  <option key={t.tenant_id} value={t.tenant_id}>
                    {t.tenant_name} ({t.booth_location})
                  </option>
                ))}
              </select>
            </div>
          )}
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{formError}</div>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setCreateModal(false)}>Batal</Button>
            <Button type="submit" className="flex-1" loading={creating}>Buat Akun</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Pengguna">
        <form onSubmit={handleEdit} className="space-y-3">
          <p className="text-sm text-gray-500">
            Username: <span className="font-mono font-medium text-gray-800">{editModal?.username}</span>
            <span className="ml-2 text-xs text-gray-400">({editModal?.role})</span>
          </p>
          <Input label="Nama Tampilan"
            value={editForm.display_name}
            onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
            required />
          {editModal?.role === 'TENANT' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Booth Tenant</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editForm.tenant_id}
                onChange={(e) => setEditForm((f) => ({ ...f, tenant_id: e.target.value }))}>
                <option value="">-- Tidak ada --</option>
                {tenants.map((t) => (
                  <option key={t.tenant_id} value={t.tenant_id}>
                    {t.tenant_name} ({t.booth_location})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditModal(null)}>Batal</Button>
            <Button type="submit" className="flex-1" loading={saving}>Simpan</Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!pwModal} onClose={() => setPwModal(null)} title="Reset Password">
        <form onSubmit={handleResetPw} className="space-y-3">
          <p className="text-sm text-gray-500">
            Reset password untuk <span className="font-mono font-medium text-gray-800">{pwModal?.username}</span>
          </p>
          <Input label="Password Baru" type="password" placeholder="Min. 6 karakter"
            value={newPw} onChange={(e) => setNewPw(e.target.value)}
            required minLength={6} />
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setPwModal(null)}>Batal</Button>
            <Button type="submit" variant="danger" className="flex-1" loading={resetting}>Reset Password</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
