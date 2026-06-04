import { useState, useEffect, useCallback } from 'react';
import {
  listVouchers, createVoucher, updateVoucher, deleteVoucher,
} from '../../../api/vouchers';
import { getTenants } from '../../../api/tenants';
import { formatRupiah, formatDate } from '../../../utils/format';
import Button    from '../../../components/ui/Button';
import Input     from '../../../components/ui/Input';
import Modal     from '../../../components/ui/Modal';
import Spinner   from '../../../components/ui/Spinner';
import EmptyState from '../../../components/ui/EmptyState';
import ToastContainer from '../../../components/ui/Toast';
import { useToast }   from '../../../hooks/useToast';

// ── Helpers ───────────────────────────────────────────────────────────────────

function voucherStatus(v) {
  if (!v.is_active) return { label: 'Nonaktif', cls: 'bg-gray-100 text-gray-500' };
  const now = new Date();
  if (now < new Date(v.valid_from)) return { label: 'Belum Mulai', cls: 'bg-yellow-100 text-yellow-700' };
  if (now > new Date(v.valid_until)) return { label: 'Expired',   cls: 'bg-red-100 text-red-600' };
  return { label: 'Aktif', cls: 'bg-green-100 text-green-700' };
}

function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 16);
}

function fromLocalDatetimeInput(val) {
  if (!val) return '';
  return new Date(val).toISOString();
}

const EMPTY_FORM = {
  code: '', description: '',
  discount_type: 'PERCENT', discount_value: '',
  min_purchase: '0', max_discount: '', usage_limit: '',
  valid_from: '', valid_until: '', tenant_id: '',
};

// ── Section wrapper (sama dengan TaxTab) ──────────────────────────────────────

function Section({ title, subtitle, icon, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5">{icon}</span>
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── Voucher Form ──────────────────────────────────────────────────────────────

function VoucherForm({ form, setForm, tenants, isEdit }) {
  const isPercent = form.discount_type === 'PERCENT';

  return (
    <div className="space-y-3">
      {/* Kode & Deskripsi */}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Kode Voucher *" placeholder="AMZTOYS20"
          value={form.code}
          onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
          disabled={isEdit}
          required />
        <Input label="Deskripsi" placeholder="Diskon spesial event"
          value={form.description}
          onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>

      {/* Tipe diskon */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Tipe Diskon *</label>
        <div className="flex gap-2">
          {['PERCENT', 'FIXED'].map(t => (
            <button key={t} type="button"
              onClick={() => setForm(f => ({ ...f, discount_type: t }))}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                ${form.discount_type === t
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
            >
              {t === 'PERCENT' ? '% Persentase' : 'Rp Nominal'}
            </button>
          ))}
        </div>
      </div>

      {/* Nilai diskon */}
      <div className="grid grid-cols-2 gap-3">
        <Input label={isPercent ? 'Diskon (%) *' : 'Diskon (Rp) *'}
          type="number" min="0" max={isPercent ? 100 : undefined} step={isPercent ? '0.01' : '1000'}
          placeholder={isPercent ? '20' : '50000'}
          value={form.discount_value}
          onChange={(e) => setForm(f => ({ ...f, discount_value: e.target.value }))}
          hint={isPercent ? '0–100' : 'Nominal rupiah'}
          required />
        {isPercent ? (
          <Input label="Maks Diskon (Rp)" type="number" min="0" step="1000"
            placeholder="50000 (kosong = tidak ada batas)"
            value={form.max_discount}
            onChange={(e) => setForm(f => ({ ...f, max_discount: e.target.value }))}
            hint="Opsional — cap nominal" />
        ) : (
          <div /> /* empty cell */
        )}
      </div>

      {/* Min belanja & limit pemakaian */}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Min. Belanja (Rp)" type="number" min="0" step="1000"
          placeholder="100000"
          value={form.min_purchase}
          onChange={(e) => setForm(f => ({ ...f, min_purchase: e.target.value }))}
          hint="Pre-tax. 0 = tidak ada minimum" />
        <Input label="Batas Pemakaian" type="number" min="1"
          placeholder="100 (kosong = unlimited)"
          value={form.usage_limit}
          onChange={(e) => setForm(f => ({ ...f, usage_limit: e.target.value }))}
          hint="Kosong = unlimited" />
      </div>

      {/* Masa berlaku */}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Berlaku Mulai *" type="datetime-local"
          value={form.valid_from}
          onChange={(e) => setForm(f => ({ ...f, valid_from: e.target.value }))}
          required />
        <Input label="Berlaku Sampai *" type="datetime-local"
          value={form.valid_until}
          onChange={(e) => setForm(f => ({ ...f, valid_until: e.target.value }))}
          required />
      </div>

      {/* Tenant scope */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Berlaku untuk Tenant</label>
        <select
          value={form.tenant_id}
          onChange={(e) => setForm(f => ({ ...f, tenant_id: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Tenant</option>
          {tenants.map(t => (
            <option key={t.tenant_id} value={t.tenant_id}>
              {t.tenant_id} — {t.tenant_name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400">Pilih "Semua Tenant" agar voucher berlaku untuk seluruh booth</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VoucherTab() {
  const { toasts, addToast, removeToast } = useToast();

  const [vouchers, setVouchers]       = useState([]);
  const [tenants,  setTenants]        = useState([]);
  const [loading,  setLoading]        = useState(true);
  const [saving,   setSaving]         = useState(false);
  const [filter,   setFilter]         = useState('all'); // all | active | inactive

  const [showCreate, setShowCreate]   = useState(false);
  const [editTarget, setEditTarget]   = useState(null);   // voucher object being edited
  const [deactTarget, setDeactTarget] = useState(null);   // voucher object to deactivate

  const [form, setForm]               = useState({ ...EMPTY_FORM });

  // ── Load data ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, tRes] = await Promise.all([listVouchers(), getTenants()]);
      setVouchers(vRes.data.data || []);
      setTenants(tRes.data.data  || []);
    } catch {
      addToast('Gagal memuat data voucher.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = vouchers.filter(v => {
    if (filter === 'active')   return v.is_active && new Date() <= new Date(v.valid_until);
    if (filter === 'inactive') return !v.is_active || new Date() > new Date(v.valid_until);
    return true;
  });

  // ── Create ─────────────────────────────────────────────────────────────────

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!form.code || !form.discount_value || !form.valid_from || !form.valid_until) {
      addToast('Lengkapi semua field wajib.', 'error'); return;
    }
    setSaving(true);
    try {
      await createVoucher({
        code:           form.code,
        description:    form.description || null,
        discount_type:  form.discount_type,
        discount_value: parseFloat(form.discount_value),
        min_purchase:   parseFloat(form.min_purchase)  || 0,
        max_discount:   form.max_discount ? parseFloat(form.max_discount) : null,
        usage_limit:    form.usage_limit  ? parseInt(form.usage_limit, 10) : null,
        valid_from:     fromLocalDatetimeInput(form.valid_from),
        valid_until:    fromLocalDatetimeInput(form.valid_until),
        tenant_id:      form.tenant_id || null,
      });
      addToast(`Voucher ${form.code} berhasil dibuat.`, 'success');
      setShowCreate(false);
      load();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal membuat voucher.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  function openEdit(v) {
    setForm({
      code:           v.code,
      description:    v.description || '',
      discount_type:  v.discount_type,
      discount_value: String(v.discount_value),
      min_purchase:   String(v.min_purchase ?? 0),
      max_discount:   v.max_discount != null ? String(v.max_discount) : '',
      usage_limit:    v.usage_limit  != null ? String(v.usage_limit)  : '',
      valid_from:     toLocalDatetimeInput(v.valid_from),
      valid_until:    toLocalDatetimeInput(v.valid_until),
      tenant_id:      v.tenant_id || '',
    });
    setEditTarget(v);
  }

  async function handleEdit() {
    if (!form.discount_value || !form.valid_from || !form.valid_until) {
      addToast('Lengkapi semua field wajib.', 'error'); return;
    }
    setSaving(true);
    try {
      await updateVoucher(editTarget.code, {
        description:    form.description || null,
        discount_type:  form.discount_type,
        discount_value: parseFloat(form.discount_value),
        min_purchase:   parseFloat(form.min_purchase)  || 0,
        max_discount:   form.max_discount ? parseFloat(form.max_discount) : null,
        usage_limit:    form.usage_limit  ? parseInt(form.usage_limit, 10) : null,
        valid_from:     fromLocalDatetimeInput(form.valid_from),
        valid_until:    fromLocalDatetimeInput(form.valid_until),
        tenant_id:      form.tenant_id || null,
      });
      addToast(`Voucher ${editTarget.code} berhasil diperbarui.`, 'success');
      setEditTarget(null);
      load();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal memperbarui voucher.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Deactivate ─────────────────────────────────────────────────────────────

  async function handleDeactivate() {
    setSaving(true);
    try {
      await deleteVoucher(deactTarget.code);
      addToast(`Voucher ${deactTarget.code} dinonaktifkan.`, 'success');
      setDeactTarget(null);
      load();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal menonaktifkan voucher.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header action bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {[
            { key: 'all',      label: 'Semua' },
            { key: 'active',   label: 'Aktif' },
            { key: 'inactive', label: 'Nonaktif / Expired' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${filter === f.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}
            >
              {f.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full
                ${filter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {f.key === 'all'      ? vouchers.length :
                 f.key === 'active'   ? vouchers.filter(v => v.is_active && new Date() <= new Date(v.valid_until)).length :
                                        vouchers.filter(v => !v.is_active || new Date() > new Date(v.valid_until)).length}
              </span>
            </button>
          ))}
        </div>
        <Button onClick={openCreate} size="sm">
          + Buat Voucher
        </Button>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Voucher',   value: vouchers.length,
              cls: 'bg-indigo-50 text-indigo-700' },
            { label: 'Aktif',
              value: vouchers.filter(v => v.is_active && new Date() <= new Date(v.valid_until)).length,
              cls: 'bg-green-50 text-green-700' },
            { label: 'Total Pemakaian',
              value: vouchers.reduce((s, v) => s + (v.usage_count || 0), 0),
              cls: 'bg-blue-50 text-blue-700' },
            { label: 'Expired / Nonaktif',
              value: vouchers.filter(v => !v.is_active || new Date() > new Date(v.valid_until)).length,
              cls: 'bg-gray-50 text-gray-500' },
          ].map(card => (
            <div key={card.label} className={`rounded-xl px-4 py-3 ${card.cls}`}>
              <p className="text-xs font-medium opacity-70">{card.label}</p>
              <p className="text-2xl font-bold mt-0.5">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Voucher table ──────────────────────────────────────────────────── */}
      <Section icon="🏷️" title="Daftar Voucher"
        subtitle="Kelola kode diskon untuk customer event">
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon="🏷️" title="Belum ada voucher"
            description={'Klik "+ Buat Voucher" untuk menambahkan kode diskon pertama.'} />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-2 text-left font-medium">Kode</th>
                  <th className="px-3 py-2 text-left font-medium">Tipe / Nilai</th>
                  <th className="px-3 py-2 text-left font-medium">Masa Berlaku</th>
                  <th className="px-3 py-2 text-left font-medium">Pemakaian</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-5 py-2 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(v => {
                  const st = voucherStatus(v);
                  const usageMax  = v.usage_limit || null;
                  const usagePct  = usageMax ? Math.min((v.usage_count / usageMax) * 100, 100) : null;

                  return (
                    <tr key={v.code} className="hover:bg-gray-50 transition-colors">
                      {/* Kode */}
                      <td className="px-5 py-3">
                        <p className="font-mono font-semibold text-gray-800">{v.code}</p>
                        {v.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{v.description}</p>
                        )}
                        {v.tenant_id && (
                          <span className="inline-block text-xs bg-blue-50 text-blue-600 rounded px-1.5 py-0.5 mt-0.5">
                            Tenant: {v.tenant_id}
                          </span>
                        )}
                      </td>

                      {/* Tipe / Nilai */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-block text-xs rounded px-2 py-0.5 font-medium mr-1.5
                          ${v.discount_type === 'PERCENT' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'}`}>
                          {v.discount_type}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {v.discount_type === 'PERCENT'
                            ? `${v.discount_value}%`
                            : formatRupiah(v.discount_value)}
                        </span>
                        {v.max_discount && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            maks {formatRupiah(v.max_discount)}
                          </p>
                        )}
                        {parseFloat(v.min_purchase) > 0 && (
                          <p className="text-xs text-gray-400">
                            min {formatRupiah(v.min_purchase)}
                          </p>
                        )}
                      </td>

                      {/* Masa berlaku */}
                      <td className="px-3 py-3 text-xs text-gray-500">
                        <p>{formatDate(v.valid_from)}</p>
                        <p className="text-gray-400">s/d</p>
                        <p>{formatDate(v.valid_until)}</p>
                      </td>

                      {/* Pemakaian */}
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium text-gray-700">
                          {v.usage_count}
                          {usageMax ? <span className="text-gray-400 font-normal"> / {usageMax}</span> : ''}
                        </p>
                        {usageMax && (
                          <div className="mt-1 w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-red-400' : usagePct >= 60 ? 'bg-yellow-400' : 'bg-green-400'}`}
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                        )}
                        {!usageMax && (
                          <p className="text-xs text-gray-400">unlimited</p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <span className={`inline-block text-xs font-medium rounded-full px-2 py-0.5 ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openEdit(v)}
                            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg
                              hover:bg-blue-100 font-medium transition-colors">
                            Edit
                          </button>
                          {v.is_active && (
                            <button onClick={() => setDeactTarget(v)}
                              className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-lg
                                hover:bg-red-100 font-medium transition-colors">
                              Nonaktifkan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Info box ───────────────────────────────────────────────────────── */}
      <Section icon="ℹ️" title="Cara Kerja Voucher"
        subtitle="Referensi cepat untuk operator">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-purple-600 font-bold mt-0.5 shrink-0">%</span>
              <div>
                <p className="font-medium text-gray-700">Tipe PERCENT</p>
                <p className="text-xs text-gray-400">Diskon = Total × (nilai/100), dengan cap Maks Diskon jika diisi. Persen diterapkan proporsional ke setiap baris di Odoo.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-600 font-bold mt-0.5 shrink-0">Rp</span>
              <div>
                <p className="font-medium text-gray-700">Tipe FIXED</p>
                <p className="text-xs text-gray-400">Diskon nominal langsung, tidak melebihi total belanja. Didistribusikan proporsional ke setiap baris di Odoo.</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-green-600 font-bold mt-0.5 shrink-0">✓</span>
              <div>
                <p className="font-medium text-gray-700">Kalkulasi Pajak</p>
                <p className="text-xs text-gray-400">PPN dihitung dari (Subtotal − Diskon). Total bayar = harga setelah diskon + PPN atas harga diskon.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold mt-0.5 shrink-0">1×</span>
              <div>
                <p className="font-medium text-gray-700">Satu Customer Satu Kali</p>
                <p className="text-xs text-gray-400">Satu customer tidak bisa memakai voucher yang sama dua kali. Walk-in customer (kasir POS) dikecualikan.</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Modal: Buat Voucher ─────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Buat Voucher Baru">
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <VoucherForm form={form} setForm={setForm} tenants={tenants} isEdit={false} />
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)} className="flex-1">
            Batal
          </Button>
          <Button size="sm" onClick={handleCreate} loading={saving} className="flex-1">
            Buat Voucher
          </Button>
        </div>
      </Modal>

      {/* ── Modal: Edit Voucher ─────────────────────────────────────────────── */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)}
        title={`Edit Voucher — ${editTarget?.code}`}>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <VoucherForm form={form} setForm={setForm} tenants={tenants} isEdit />
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <Button size="sm" variant="secondary" onClick={() => setEditTarget(null)} className="flex-1">
            Batal
          </Button>
          <Button size="sm" onClick={handleEdit} loading={saving} className="flex-1">
            Simpan Perubahan
          </Button>
        </div>
      </Modal>

      {/* ── Modal: Konfirmasi Nonaktifkan ───────────────────────────────────── */}
      <Modal open={!!deactTarget} onClose={() => setDeactTarget(null)}
        title="Nonaktifkan Voucher">
        <p className="text-sm text-gray-600 mb-1">
          Yakin menonaktifkan voucher <span className="font-mono font-bold text-gray-800">{deactTarget?.code}</span>?
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Voucher tidak akan bisa digunakan lagi. Customer yang sedang berbelanja tidak terdampak.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDeactTarget(null)} className="flex-1">
            Batal
          </Button>
          <Button size="sm" onClick={handleDeactivate} loading={saving}
            className="flex-1 !bg-red-600 hover:!bg-red-700">
            Nonaktifkan
          </Button>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
