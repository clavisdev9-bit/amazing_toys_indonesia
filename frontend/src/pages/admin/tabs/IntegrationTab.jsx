import React, { useState, useEffect } from 'react';
import { getIntegration, saveIntegration } from '../../../api/admin';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Spinner from '../../../components/ui/Spinner';
import ToastContainer from '../../../components/ui/Toast';
import { useToast } from '../../../hooks/useToast';

const GATEWAYS = ['midtrans', 'xendit', 'doku', 'custom'];
const MASKED   = '••••••••';

const SUB_TABS = [
  { key: 'payment', label: '💳 Payment & POS' },
  { key: 'odoo',    label: '🔶 Integration with Odoo' },
];

const ODOO_REQUIRED = ['odoo_base_url', 'odoo_db', 'odoo_login', 'odoo_password', 'odoo_walkin_partner_id'];


export default function IntegrationTab() {
  const { toasts, addToast, removeToast } = useToast();
  const [subTab, setSubTab]       = useState('payment');
  const [config, setConfig]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showKey, setShowKey]     = useState(false);
  const [errors, setErrors]       = useState({});
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    getIntegration()
      .then((r) => setConfig(r.data.data))
      .catch(() => addToast('Gagal memuat konfigurasi integrasi.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, value) {
    setConfig((c) => ({ ...c, [key]: value }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  function validateOdoo() {
    const errs = {};
    for (const f of ODOO_REQUIRED) {
      const val = String(config[f] ?? '').trim();
      if (!val || val === MASKED) errs[f] = 'Wajib diisi';
    }
    return errs;
  }

  async function handleSave(e) {
    e.preventDefault();
    if (subTab === 'odoo') {
      const errs = validateOdoo();
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        addToast('Lengkapi semua field yang wajib diisi.', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const r = await saveIntegration(config);
      setConfig(r.data.data);
      setErrors({});
      addToast('Konfigurasi integrasi disimpan.', 'success');
      if (subTab === 'odoo') setSaved(true);
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (!config)  return <p className="text-sm text-gray-500">Gagal memuat konfigurasi.</p>;

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white mb-5">
        <span className="text-base">🔌</span>
        <h2 className="text-sm font-semibold flex-1">Konfigurasi Integrasi</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {SUB_TABS.map((t) => (
          <button key={t.key} onClick={() => { setSubTab(t.key); setSaved(false); }}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg
              ${subTab === t.key
                ? 'text-teal-700 border-b-2 border-teal-600 bg-teal-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="max-w-xl space-y-6">

        {/* ── Payment & POS ────────────────────────────────────────────────── */}
        {subTab === 'payment' && (
          <>
            <div className={`flex items-center justify-between p-4 rounded-xl border-2
              ${config.is_active ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div>
                <p className="font-medium text-gray-800 text-sm">Status Integrasi Payment</p>
                <p className={`text-xs mt-0.5 ${config.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                  {config.is_active ? 'Terhubung & Aktif' : 'Tidak Aktif'}
                </p>
              </div>
              <Toggle checked={!!config.is_active} onChange={(v) => set('is_active', v)} />
            </div>

            <section>
              <SectionTitle>💳 Payment Gateway</SectionTitle>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Provider</label>
                  <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={config.payment_gateway || ''}
                    onChange={(e) => set('payment_gateway', e.target.value)}>
                    <option value="">-- Pilih Provider --</option>
                    {GATEWAYS.map((g) => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                  </select>
                </div>
                <Input label="API Key / Client Key" type={showKey ? 'text' : 'password'}
                  value={config.api_key || ''} onChange={(e) => set('api_key', e.target.value)}
                  placeholder="Masukkan API key..." />
                <Input label="Secret Key" type={showKey ? 'text' : 'password'}
                  value={config.secret_key || ''} onChange={(e) => set('secret_key', e.target.value)}
                  placeholder={MASKED} />
                <ShowKeysToggle checked={showKey} onChange={setShowKey} />
                <Input label="Webhook URL"
                  value={config.webhook_url || ''} onChange={(e) => set('webhook_url', e.target.value)}
                  placeholder="https://yourdomain.com/api/v1/payments/webhook" />
              </div>
            </section>

            <section>
              <SectionTitle>🖥️ Integrasi POS</SectionTitle>
              <div className="space-y-3">
                <Input label="POS Base URL"
                  value={config.pos_url || ''} onChange={(e) => set('pos_url', e.target.value)}
                  placeholder="http://pos-system.local/api" />
                <Input label="POS API Key" type={showKey ? 'text' : 'password'}
                  value={config.pos_api_key || ''} onChange={(e) => set('pos_api_key', e.target.value)}
                  placeholder="Masukkan POS API key..." />
              </div>
            </section>

            <section>
              <SectionTitle>📝 Catatan</SectionTitle>
              <textarea rows={3} value={config.notes || ''} onChange={(e) => set('notes', e.target.value)}
                placeholder="Catatan konfigurasi integrasi..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </section>
          </>
        )}

        {/* ── Integration with Odoo ─────────────────────────────────────────── */}
        {subTab === 'odoo' && (
          <>
            {/* Legend */}
            <div className="flex gap-4 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span><span className="text-red-500 font-bold">*</span> Wajib diisi</span>
              <span><span className="text-yellow-500 font-bold">!</span> Direkomendasikan</span>
              <span className="text-gray-400">Tanpa tanda = opsional (ada nilai default)</span>
            </div>

            {/* Status */}
            <div className={`flex items-center justify-between p-4 rounded-xl border-2
              ${config.odoo_is_active ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
              <div>
                <p className="font-medium text-gray-800 text-sm">Status Integrasi Odoo 18</p>
                <p className={`text-xs mt-0.5 ${config.odoo_is_active ? 'text-orange-600' : 'text-gray-400'}`}>
                  {config.odoo_is_active ? '● Aktif — scheduler & webhook berjalan' : '○ Nonaktif'}
                </p>
              </div>
              <Toggle checked={!!config.odoo_is_active} onChange={(v) => set('odoo_is_active', v)} activeColor="bg-orange-500" />
            </div>

            {/* Section 1: Koneksi — all MANDATORY */}
            <section>
              <SectionTitle color="orange">🔗 Koneksi Odoo</SectionTitle>
              <div className="space-y-3">
                <Input label="Odoo Base URL" required
                  hint="→ ODOO_BASE_URL"
                  value={config.odoo_base_url || ''}
                  onChange={(e) => set('odoo_base_url', e.target.value)}
                  placeholder="http://localhost:8069"
                  error={errors.odoo_base_url} />

                <Input label="Database Name" required
                  hint="→ ODOO_DB"
                  value={config.odoo_db || ''}
                  onChange={(e) => set('odoo_db', e.target.value)}
                  placeholder="odoo18"
                  error={errors.odoo_db} />

                <Input label="Login Username" required
                  hint="→ ODOO_LOGIN"
                  value={config.odoo_login || ''}
                  onChange={(e) => set('odoo_login', e.target.value)}
                  placeholder="admin"
                  error={errors.odoo_login} />

                <Input label="Password" required
                  hint="→ ODOO_PASSWORD"
                  type={showKey ? 'text' : 'password'}
                  value={config.odoo_password || ''}
                  onChange={(e) => set('odoo_password', e.target.value)}
                  placeholder={MASKED}
                  error={errors.odoo_password} />

                <ShowKeysToggle checked={showKey} onChange={setShowKey} />
              </div>
            </section>

            {/* Section 2: Walk-in Partner — MANDATORY */}
            <section>
              <SectionTitle color="orange">🚶 Walk-in Customer</SectionTitle>
              <div className="space-y-2">
                <Input label="Walk-in Partner ID" required
                  hint="→ ODOO_WALKIN_PARTNER_ID"
                  type="number" min="1"
                  value={config.odoo_walkin_partner_id || ''}
                  onChange={(e) => set('odoo_walkin_partner_id', e.target.value)}
                  placeholder="Contoh: 3"
                  error={errors.odoo_walkin_partner_id} />
                <p className="text-xs text-gray-400">
                  ID integer <code className="bg-gray-100 px-1 rounded">res.partner</code> untuk customer dengan nomor telepon tidak valid.
                  Cek di Odoo: Kontak → pilih "Walk-in Customer" → lihat ID di URL.
                </p>
              </div>
            </section>

            {/* Section 3: Webhook Security — RECOMMENDED */}
            <section>
              <SectionTitle color="orange">🔐 Keamanan Webhook</SectionTitle>
              <div className="space-y-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    Webhook Secret
                    <span className="text-yellow-500 ml-1 font-bold">!</span>
                    <span className="ml-2 text-xs font-normal text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">Direkomendasikan untuk produksi</span>
                  </label>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={config.odoo_webhook_secret || ''}
                    onChange={(e) => set('odoo_webhook_secret', e.target.value)}
                    placeholder={MASKED}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <p className="text-xs text-gray-400 font-mono">→ WEBHOOK_SECRET</p>
                  <p className="text-xs text-gray-400">
                    Shared secret untuk header <code className="bg-gray-100 px-1 rounded">X-SOS-Signature</code>.
                    Kosong = validasi dinonaktifkan (dev only).
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4: Sync Schedule — OPTIONAL with defaults */}
            <section>
              <SectionTitle color="orange">
                ⏱️ Jadwal Sinkronisasi
                <span className="ml-2 text-xs font-normal text-gray-400">(opsional — ada nilai default)</span>
              </SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Product Sync (menit)"
                  hint="→ PRODUCT_SYNC_INTERVAL_MIN  default: 30"
                  type="number" min="1"
                  value={config.odoo_product_sync_interval_min ?? 30}
                  onChange={(e) => set('odoo_product_sync_interval_min', parseInt(e.target.value) || 30)} />

                <Input label="Stock Sync (menit)"
                  hint="→ STOCK_SYNC_INTERVAL_MIN  default: 30"
                  type="number" min="1"
                  value={config.odoo_stock_sync_interval_min ?? 30}
                  onChange={(e) => set('odoo_stock_sync_interval_min', parseInt(e.target.value) || 30)} />

                <Input label="Expiry Sweep (menit)"
                  hint="→ SWEEP_INTERVAL_MIN  default: 5"
                  type="number" min="1"
                  value={config.odoo_sweep_interval_min ?? 5}
                  onChange={(e) => set('odoo_sweep_interval_min', parseInt(e.target.value) || 5)} />

                <Input label="Order Polling (detik)"
                  hint="→ POLLING_INTERVAL_SEC  default: 60"
                  type="number" min="10"
                  value={config.odoo_polling_interval_sec ?? 60}
                  onChange={(e) => set('odoo_polling_interval_sec', parseInt(e.target.value) || 60)} />

                <Input label="Low Stock Threshold"
                  hint="→ LOW_STOCK_THRESHOLD  default: 10"
                  type="number" min="0"
                  value={config.odoo_low_stock_threshold ?? 10}
                  onChange={(e) => set('odoo_low_stock_threshold', parseInt(e.target.value) || 0)} />
              </div>
            </section>

            {/* Section 5: Stability — OPTIONAL */}
            <section>
              <SectionTitle color="orange">
                🛡️ Stabilitas
                <span className="ml-2 text-xs font-normal text-gray-400">(opsional — ada nilai default)</span>
              </SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Max Retry"
                  hint="→ RETRY_MAX_ATTEMPTS  default: 3"
                  type="number" min="1" max="10"
                  value={config.odoo_retry_max_attempts ?? 3}
                  onChange={(e) => set('odoo_retry_max_attempts', parseInt(e.target.value) || 3)} />

                <Input label="CB Threshold"
                  hint="→ CIRCUIT_BREAKER_THRESHOLD  default: 5"
                  type="number" min="1"
                  value={config.odoo_circuit_breaker_threshold ?? 5}
                  onChange={(e) => set('odoo_circuit_breaker_threshold', parseInt(e.target.value) || 5)} />

                <Input label="CB Reset (menit)"
                  hint="→ CIRCUIT_BREAKER_RESET_MIN  default: 2"
                  type="number" min="1"
                  value={config.odoo_circuit_breaker_reset_min ?? 2}
                  onChange={(e) => set('odoo_circuit_breaker_reset_min', parseInt(e.target.value) || 2)} />
              </div>
              <p className="text-xs text-gray-400 mt-2">CB = Circuit Breaker — proteksi jika Odoo/SOS tidak responsif.</p>
            </section>

            {/* Section 6: Tenant Mapping — OPTIONAL */}
            <section>
              <SectionTitle color="orange">
                🏪 Mapping Tenant
                <span className="ml-2 text-xs font-normal text-gray-400">(opsional)</span>
              </SectionTitle>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Tenant Product Mapping (JSON)</label>
                  <textarea rows={3}
                    value={config.odoo_tenant_product_mapping || '{}'}
                    onChange={(e) => set('odoo_tenant_product_mapping', e.target.value)}
                    placeholder={'{"Hasbro": "T001", "Lego": "T002"}'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
                  <p className="text-xs text-gray-400 font-mono">→ TENANT_PRODUCT_MAPPING</p>
                  <p className="text-xs text-gray-400">Peta nama kategori Odoo → SOS tenant_id. Gunakan format JSON.</p>
                </div>

                <Input label="Default Tenant ID"
                  hint="→ DEFAULT_TENANT_ID  default: T001"
                  value={config.odoo_default_tenant_id || 'T001'}
                  onChange={(e) => set('odoo_default_tenant_id', e.target.value)}
                  placeholder="T001" />
              </div>
            </section>
          </>
        )}

        {/* Save button */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <Button type="submit" loading={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white px-8">
            💾 Simpan
          </Button>
          {subTab === 'payment' && config.is_active && config.api_key && (
            <span className="text-xs text-green-600 font-medium">✓ Koneksi terkonfigurasi</span>
          )}
          {subTab === 'odoo' && config.odoo_is_active && config.odoo_base_url && (
            <span className="text-xs text-orange-600 font-medium">✓ Odoo terkonfigurasi</span>
          )}
        </div>
      </form>

      {/* Restart banner — shown after Odoo config saved */}
      {subTab === 'odoo' && saved && (
        <div className="max-w-xl mt-5 flex gap-3 items-start bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
          <span className="text-lg mt-0.5">⚡</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Konfigurasi tersimpan ke database</p>
            <p className="text-xs text-amber-700 mt-1">
              Integration service membaca config dari DB saat startup.
              Restart service agar perubahan diterapkan:
            </p>
            <code className="inline-block mt-2 bg-amber-100 text-amber-900 text-xs px-2 py-1 rounded font-mono">
              cd integration &amp;&amp; node src/app.js
            </code>
          </div>
        </div>
      )}
    </>
  );
}

function SectionTitle({ children, color = 'teal' }) {
  const colors = {
    teal:   'text-teal-700 border-teal-200',
    orange: 'text-orange-700 border-orange-200',
  };
  return (
    <h3 className={`text-sm font-semibold mb-3 pb-1 border-b flex items-center gap-1 ${colors[color] || colors.teal}`}>
      {children}
    </h3>
  );
}

function Toggle({ checked, onChange, activeColor = 'bg-green-500' }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked}
          onChange={(e) => onChange(e.target.checked)} />
        <div className={`w-10 h-6 rounded-full transition-colors ${checked ? activeColor : 'bg-gray-300'}`} />
        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
    </label>
  );
}

function ShowKeysToggle({ checked, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      Tampilkan nilai tersembunyi
    </label>
  );
}
