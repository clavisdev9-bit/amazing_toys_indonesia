import { useState, useEffect, useCallback } from 'react';
import { listProductPromos, createProductPromo } from '../../../api/vouchers';
import { getProducts } from '../../../api/products';
import { getTenants } from '../../../api/tenants';
import { formatDate } from '../../../utils/format';
import Button     from '../../../components/ui/Button';
import Input      from '../../../components/ui/Input';
import Modal      from '../../../components/ui/Modal';
import Spinner    from '../../../components/ui/Spinner';
import EmptyState from '../../../components/ui/EmptyState';
import ToastContainer from '../../../components/ui/Toast';
import { useToast }   from '../../../hooks/useToast';
import { deleteVoucher } from '../../../api/vouchers';

// ── Helpers ───────────────────────────────────────────────────────────────────

function promoStatus(v) {
  if (!v.is_active) return { label: 'Nonaktif', cls: 'bg-gray-100 text-gray-500' };
  const now = new Date();
  if (now < new Date(v.valid_from)) return { label: 'Belum Mulai', cls: 'bg-yellow-100 text-yellow-700' };
  if (now > new Date(v.valid_until)) return { label: 'Expired',   cls: 'bg-red-100 text-red-600' };
  return { label: 'Aktif', cls: 'bg-green-100 text-green-700' };
}

function fromLocalDatetimeInput(val) {
  if (!val) return '';
  return new Date(val).toISOString();
}

const EMPTY_RULE = {
  buy_product_id:  '',
  free_product_id: '',  // kosong = same product
  buy_qty:         '1',
  free_qty:        '1',
  max_free_qty:    '',
};

const EMPTY_FORM = {
  code:        '',
  description: '',
  valid_from:  '',
  valid_until: '',
  tenant_id:   '',
  usage_limit: '',
  rules:       [{ ...EMPTY_RULE }],
};

// ── Section wrapper (konsisten dengan VoucherTab) ─────────────────────────────

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

// ── Rule row dalam form ───────────────────────────────────────────────────────

function RuleRow({ rule, idx, products, onChange, onRemove, canRemove }) {
  const buyProduct  = products.find(p => p.product_id === rule.buy_product_id);
  const freeProduct = products.find(p => p.product_id === rule.free_product_id);
  const isSame = !rule.free_product_id;

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Rule #{idx + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Hapus
          </button>
        )}
      </div>

      {/* Produk yang DIBELI */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Produk yang Dibeli *</label>
        <select
          value={rule.buy_product_id}
          onChange={e => onChange('buy_product_id', e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          required
        >
          <option value="">— Pilih produk —</option>
          {products.map(p => (
            <option key={p.product_id} value={p.product_id}>
              {p.product_name} ({p.product_id}) · Stok: {p.stock_quantity}
            </option>
          ))}
        </select>
        {buyProduct && (
          <p className="text-xs text-gray-400">
            Tenant: {buyProduct.tenant_id} · Harga: Rp {Number(buyProduct.price).toLocaleString('id-ID')}
          </p>
        )}
      </div>

      {/* Tipe: same / cross product */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Tipe Gratis</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange('free_product_id', '')}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
              ${isSame
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'}`}
          >
            Same Product
          </button>
          <button
            type="button"
            onClick={() => onChange('free_product_id', rule.buy_product_id || '')}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
              ${!isSame
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'}`}
          >
            Cross Product
          </button>
        </div>
      </div>

      {/* Produk GRATIS (hanya tampil jika cross product) */}
      {!isSame && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Produk Gratis *</label>
          <select
            value={rule.free_product_id}
            onChange={e => onChange('free_product_id', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— Pilih produk gratis —</option>
            {products.map(p => (
              <option key={p.product_id} value={p.product_id}>
                {p.product_name} ({p.product_id}) · Stok: {p.stock_quantity}
              </option>
            ))}
          </select>
          {freeProduct && (
            <p className="text-xs text-gray-400">
              Tenant: {freeProduct.tenant_id}
            </p>
          )}
        </div>
      )}

      {/* Qty & limit */}
      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Buy Qty *"
          type="number" min="1" max="99"
          value={rule.buy_qty}
          onChange={e => onChange('buy_qty', e.target.value)}
          hint="Min beli"
          required
        />
        <Input
          label="Free Qty *"
          type="number" min="1" max="99"
          value={rule.free_qty}
          onChange={e => onChange('free_qty', e.target.value)}
          hint="Jml gratis"
          required
        />
        <Input
          label="Maks. Gratis"
          type="number" min="1"
          value={rule.max_free_qty}
          onChange={e => onChange('max_free_qty', e.target.value)}
          hint="Kosong = ∞"
        />
      </div>

      {/* Preview formula */}
      {rule.buy_product_id && rule.buy_qty && rule.free_qty && (
        <div
          className="text-xs rounded-lg px-3 py-2"
          style={{ background: 'rgba(59,91,219,0.06)', color: '#3B5BDB' }}
        >
          Formula: floor(qty / {rule.buy_qty}) × {rule.free_qty}
          {rule.max_free_qty ? ` · maks ${rule.max_free_qty} gratis` : ''}
          {' · '}
          {isSame
            ? `Beli ${rule.buy_qty} ${buyProduct?.product_name || '...'} → Gratis ${rule.free_qty}`
            : `Beli ${rule.buy_qty} ${buyProduct?.product_name || '...'} → Gratis ${rule.free_qty} ${freeProduct?.product_name || '...'}`}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductPromoTab() {
  const { toasts, addToast, removeToast } = useToast();

  const [promos,   setPromos]   = useState([]);
  const [products, setProducts] = useState([]);
  const [tenants,  setTenants]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [filter,   setFilter]   = useState('all');

  const [showCreate,   setShowCreate]   = useState(false);
  const [deactTarget,  setDeactTarget]  = useState(null);
  const [expandedCode, setExpandedCode] = useState(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  // ── Load data ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, prodRes, tRes] = await Promise.all([
        listProductPromos(),
        getProducts({ limit: 500 }),
        getTenants(),
      ]);
      setPromos(pRes.data.data   || []);
      setProducts(prodRes.data.data?.items || prodRes.data.data || []);
      setTenants(tRes.data.data  || []);
    } catch {
      addToast('Gagal memuat data promo.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = promos.filter(v => {
    if (filter === 'active')   return v.is_active && new Date() <= new Date(v.valid_until);
    if (filter === 'inactive') return !v.is_active || new Date() > new Date(v.valid_until);
    return true;
  });

  // ── Form helpers ───────────────────────────────────────────────────────────

  function openCreate() {
    setForm({ ...EMPTY_FORM, rules: [{ ...EMPTY_RULE }] });
    setShowCreate(true);
  }

  function updateRule(idx, field, value) {
    setForm(f => {
      const rules = f.rules.map((r, i) => i === idx ? { ...r, [field]: value } : r);
      return { ...f, rules };
    });
  }

  function addRule() {
    setForm(f => ({ ...f, rules: [...f.rules, { ...EMPTY_RULE }] }));
  }

  function removeRule(idx) {
    setForm(f => ({ ...f, rules: f.rules.filter((_, i) => i !== idx) }));
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.code || !form.valid_from || !form.valid_until) {
      addToast('Kode, tanggal mulai, dan tanggal selesai wajib diisi.', 'error'); return;
    }
    for (const [i, r] of form.rules.entries()) {
      if (!r.buy_product_id) {
        addToast(`Rule #${i + 1}: produk yang dibeli belum dipilih.`, 'error'); return;
      }
      if (!r.buy_qty || parseInt(r.buy_qty) < 1) {
        addToast(`Rule #${i + 1}: buy qty minimal 1.`, 'error'); return;
      }
    }

    setSaving(true);
    try {
      await createProductPromo({
        code:        form.code.trim().toUpperCase(),
        description: form.description || null,
        valid_from:  fromLocalDatetimeInput(form.valid_from),
        valid_until: fromLocalDatetimeInput(form.valid_until),
        tenant_id:   form.tenant_id || null,
        usage_limit: form.usage_limit ? parseInt(form.usage_limit, 10) : null,
        rules: form.rules.map((r, idx) => ({
          buy_product_id:  r.buy_product_id,
          free_product_id: r.free_product_id || null,
          buy_qty:         parseInt(r.buy_qty,  10) || 1,
          free_qty:        parseInt(r.free_qty, 10) || 1,
          max_free_qty:    r.max_free_qty ? parseInt(r.max_free_qty, 10) : null,
          priority:        idx + 1,
        })),
      });
      addToast(`Promo ${form.code.toUpperCase()} berhasil dibuat.`, 'success');
      setShowCreate(false);
      load();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal membuat promo.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Deactivate ─────────────────────────────────────────────────────────────

  async function handleDeactivate() {
    setSaving(true);
    try {
      await deleteVoucher(deactTarget.code);
      addToast(`Promo ${deactTarget.code} dinonaktifkan.`, 'success');
      setDeactTarget(null);
      load();
    } catch (err) {
      addToast(err.response?.data?.message || 'Gagal menonaktifkan promo.', 'error');
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
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'}`}
            >
              {f.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full
                ${filter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {f.key === 'all'      ? promos.length :
                 f.key === 'active'   ? promos.filter(v => v.is_active && new Date() <= new Date(v.valid_until)).length :
                                        promos.filter(v => !v.is_active || new Date() > new Date(v.valid_until)).length}
              </span>
            </button>
          ))}
        </div>
        <Button onClick={openCreate} size="sm">
          🎁 Buat Promo B1G1 / B2G1
        </Button>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Total Promo',  value: promos.length,
              cls: 'bg-emerald-50 text-emerald-700' },
            { label: 'Aktif Sekarang',
              value: promos.filter(v => v.is_active && new Date() >= new Date(v.valid_from) && new Date() <= new Date(v.valid_until)).length,
              cls: 'bg-green-50 text-green-700' },
            { label: 'Expired / Nonaktif',
              value: promos.filter(v => !v.is_active || new Date() > new Date(v.valid_until)).length,
              cls: 'bg-gray-50 text-gray-500' },
          ].map(card => (
            <div key={card.label} className={`rounded-xl px-4 py-3 ${card.cls}`}>
              <p className="text-xs font-medium opacity-70">{card.label}</p>
              <p className="text-2xl font-bold mt-0.5">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Promo list ─────────────────────────────────────────────────────── */}
      <Section icon="🎁" title="Daftar Promo Produk"
        subtitle="Voucher Buy X Get Y yang aktif otomatis saat produk masuk cart">
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon="🎁" title="Belum ada promo produk"
            description='Klik "Buat Promo B1G1 / B2G1" untuk menambahkan promo pertama.' />
        ) : (
          <div className="space-y-3">
            {filtered.map(v => {
              const st       = promoStatus(v);
              const isExpanded = expandedCode === v.code;
              const rules    = v.rules || [];

              return (
                <div key={v.code}
                  className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Header row */}
                  <div
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedCode(isExpanded ? null : v.code)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-gray-800 text-sm">{v.code}</span>
                        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${st.cls}`}>
                          {st.label}
                        </span>
                        <span className="text-xs bg-emerald-50 text-emerald-700 rounded px-2 py-0.5 font-medium">
                          PRODUCT_PROMO
                        </span>
                        {v.tenant_id && (
                          <span className="text-xs bg-blue-50 text-blue-600 rounded px-2 py-0.5">
                            Tenant: {v.tenant_id}
                          </span>
                        )}
                      </div>
                      {v.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{v.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(v.valid_from)} — {formatDate(v.valid_until)}
                        {' · '}
                        <span className="font-medium text-emerald-700">
                          {rules.length} rule{rules.length !== 1 ? 's' : ''}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {v.is_active && (
                        <button
                          onClick={e => { e.stopPropagation(); setDeactTarget(v); }}
                          className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-lg
                            hover:bg-red-100 font-medium transition-colors"
                        >
                          Nonaktifkan
                        </button>
                      )}
                      <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded: rules detail */}
                  {isExpanded && rules.length > 0 && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        Detail Rules
                      </p>
                      <div className="space-y-2">
                        {rules.map((r, i) => {
                          const buyProd  = products.find(p => p.product_id === r.buy_product_id);
                          const freeProd = r.free_product_id
                            ? products.find(p => p.product_id === r.free_product_id)
                            : buyProd;
                          const isSame = !r.free_product_id;

                          return (
                            <div key={i}
                              className="bg-white rounded-lg px-3 py-2.5 border border-gray-200 text-sm">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-700">
                                  Beli {r.buy_qty}×{' '}
                                  <span className="text-blue-700">
                                    {buyProd?.product_name || r.buy_product_id}
                                  </span>
                                </span>
                                <span className="text-gray-400">→</span>
                                <span className="font-medium text-emerald-700">
                                  Gratis {r.free_qty}×{' '}
                                  {freeProd?.product_name || r.free_product_id || r.buy_product_id}
                                </span>
                                {isSame && (
                                  <span className="text-xs bg-emerald-50 text-emerald-600 rounded px-1.5 py-0.5">
                                    same product
                                  </span>
                                )}
                                {!isSame && (
                                  <span className="text-xs bg-purple-50 text-purple-600 rounded px-1.5 py-0.5">
                                    cross product
                                  </span>
                                )}
                                {r.max_free_qty && (
                                  <span className="text-xs text-amber-600">
                                    maks {r.max_free_qty} gratis
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                Formula: floor(qty / {r.buy_qty}) × {r.free_qty}
                                {r.max_free_qty ? `, cap ${r.max_free_qty}` : ''}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Info box ───────────────────────────────────────────────────────── */}
      <Section icon="ℹ️" title="Cara Kerja Promo Produk"
        subtitle="Referensi untuk operator">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold mt-0.5 shrink-0">🔁</span>
              <div>
                <p className="font-medium text-gray-700">Otomatis di Cart</p>
                <p className="text-xs text-gray-400">
                  Promo langsung aktif saat produk masuk keranjang. Customer tidak perlu input kode.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold mt-0.5 shrink-0">📦</span>
              <div>
                <p className="font-medium text-gray-700">Same vs Cross Product</p>
                <p className="text-xs text-gray-400">
                  Same: gratis produk yang sama. Cross: gratis produk berbeda (misal beli Coca Cola gratis Sprite).
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-amber-600 font-bold mt-0.5 shrink-0">📊</span>
              <div>
                <p className="font-medium text-gray-700">Stok Terpotong</p>
                <p className="text-xs text-gray-400">
                  Item gratis tetap memotong stok. Jika stok tidak cukup, qty gratis otomatis dikurangi.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-600 font-bold mt-0.5 shrink-0">🧾</span>
              <div>
                <p className="font-medium text-gray-700">Kasir Mendapat Info</p>
                <p className="text-xs text-gray-400">
                  Banner kuning muncul di cart dan di panel kasir agar item gratis tidak terlewat diserahkan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Modal: Buat Promo ───────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Buat Promo Produk Baru">
        <div className="max-h-[75vh] overflow-y-auto pr-1 space-y-4">

          {/* Header info */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Kode Voucher *" placeholder="B1G1-COCA"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              required />
            <Input label="Deskripsi" placeholder="Beli 1 Gratis 1 Coca Cola"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Berlaku Mulai *" type="datetime-local"
              value={form.valid_from}
              onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
              required />
            <Input label="Berlaku Sampai *" type="datetime-local"
              value={form.valid_until}
              onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
              required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Berlaku untuk Tenant</label>
              <select
                value={form.tenant_id}
                onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Tenant</option>
                {tenants.map(t => (
                  <option key={t.tenant_id} value={t.tenant_id}>
                    {t.tenant_id} — {t.tenant_name}
                  </option>
                ))}
              </select>
            </div>
            <Input label="Batas Pemakaian" type="number" min="1"
              placeholder="Kosong = unlimited"
              value={form.usage_limit}
              onChange={e => setForm(f => ({ ...f, usage_limit: e.target.value }))}
              hint="Kosong = unlimited" />
          </div>

          {/* Rules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Rules Produk</p>
              <button
                type="button"
                onClick={addRule}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Tambah Rule
              </button>
            </div>
            <div className="space-y-3">
              {form.rules.map((rule, idx) => (
                <RuleRow
                  key={idx}
                  rule={rule}
                  idx={idx}
                  products={products}
                  onChange={(field, val) => updateRule(idx, field, val)}
                  onRemove={() => removeRule(idx)}
                  canRemove={form.rules.length > 1}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)} className="flex-1">
            Batal
          </Button>
          <Button size="sm" onClick={handleCreate} loading={saving} className="flex-1">
            Buat Promo
          </Button>
        </div>
      </Modal>

      {/* ── Modal: Konfirmasi Nonaktifkan ───────────────────────────────────── */}
      <Modal open={!!deactTarget} onClose={() => setDeactTarget(null)}
        title="Nonaktifkan Promo">
        <p className="text-sm text-gray-600 mb-1">
          Yakin menonaktifkan promo{' '}
          <span className="font-mono font-bold text-gray-800">{deactTarget?.code}</span>?
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Promo tidak akan aktif lagi di cart customer. Item gratis tidak akan muncul untuk order baru.
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
