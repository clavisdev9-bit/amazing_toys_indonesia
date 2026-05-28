import React, { useState, useEffect, useCallback } from 'react';
import {
  getIntegration, saveIntegration, resyncTransactions, verifyOdooConnection, saveOdooConfig,
  getBcaQrisConfig, saveBcaQrisConfig, testBcaQrisToken,
} from '../../../api/admin';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Spinner from '../../../components/ui/Spinner';
import ToastContainer from '../../../components/ui/Toast';
import { useToast } from '../../../hooks/useToast';

const GATEWAYS = ['midtrans', 'xendit', 'doku', 'custom'];
const MASKED   = '••••••••';

const BCA_REQUIRED = [
  'bca_client_id', 'bca_client_secret', 'bca_api_key', 'bca_api_secret',
  'bca_merchant_id', 'bca_terminal_id', 'bca_channel_id', 'bca_callback_url',
];

const BCA_DEFAULT = {
  bca_env: 'sandbox', bca_base_url: 'https://sandbox.bca.co.id',
  bca_client_id: '', bca_client_secret: '', bca_api_key: '', bca_api_secret: '',
  bca_merchant_id: '', bca_terminal_id: '', bca_channel_id: '', bca_callback_url: '',
  bca_token_ttl: 840,
};

const SUB_TABS = [
  { key: 'payment', label: '💳 Payment & POS' },
  { key: 'odoo',    label: '🔶 Integration with Odoo' },
  { key: 'bca',     label: '🏦 BCA QRIS MPM' },
];

const ODOO_REQUIRED = ['odoo_walkin_partner_id'];

// Wizard step: 'idle' → user fills credentials
//              'verifying' → calling /admin/odoo/verify
//              'verified'  → company dropdown enabled
//              'error'     → inline error shown
const WIZARD_IDLE      = 'idle';
const WIZARD_VERIFYING = 'verifying';
const WIZARD_VERIFIED  = 'verified';
const WIZARD_ERROR     = 'error';

export default function IntegrationTab() {
  const { toasts, addToast, removeToast } = useToast();
  const [subTab, setSubTab]       = useState('payment');
  const [config, setConfig]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showKey, setShowKey]     = useState(false);
  const [errors, setErrors]       = useState({});
  const [saved, setSaved]         = useState(false);
  const [resyncing, setResyncing] = useState(false);

  // Wizard state
  const [wizardState,   setWizardState]   = useState(WIZARD_IDLE);
  const [verifyError,   setVerifyError]   = useState('');
  const [companies,     setCompanies]     = useState([]);
  const [odooSaving,    setOdooSaving]    = useState(false);

  // BCA QRIS state
  const [bca, setBca]               = useState({ ...BCA_DEFAULT });
  const [bcaLoading, setBcaLoading] = useState(false);
  const [bcaSaving,  setBcaSaving]  = useState(false);
  const [bcaTesting, setBcaTesting] = useState(false);
  const [bcaShowKey, setBcaShowKey] = useState(false);
  const [bcaErrors,  setBcaErrors]  = useState({});

  useEffect(() => {
    getIntegration()
      .then((r) => {
        const cfg = r.data.data;
        setConfig(cfg);
        if (cfg?.odoo_company_id) {
          setCompanies([{ id: cfg.odoo_company_id, name: cfg.odoo_company_name || `Company ${cfg.odoo_company_id}`, isDefault: false }]);
          setWizardState(WIZARD_VERIFIED);
        }
      })
      .catch(() => addToast('Gagal memuat konfigurasi integrasi.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBcaConfig = useCallback(() => {
    setBcaLoading(true);
    getBcaQrisConfig()
      .then((r) => setBca({ ...BCA_DEFAULT, ...r.data.data }))
      .catch(() => addToast('Gagal memuat konfigurasi BCA QRIS.', 'error'))
      .finally(() => setBcaLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (subTab === 'bca') loadBcaConfig();
  }, [subTab, loadBcaConfig]);

  function set(key, value) {
    setConfig((c) => ({ ...c, [key]: value }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    // If credentials change, reset wizard to idle so user must re-verify
    if (['odoo_base_url', 'odoo_db', 'odoo_login', 'odoo_password'].includes(key)) {
      setWizardState(WIZARD_IDLE);
      setCompanies([]);
      setVerifyError('');
    }
  }

  async function handleVerify() {
    const { odoo_base_url, odoo_db, odoo_login, odoo_password } = config || {};
    const errs = {};
    if (!String(odoo_base_url || '').trim()) errs.odoo_base_url = 'Wajib diisi';
    if (!String(odoo_db       || '').trim()) errs.odoo_db       = 'Wajib diisi';
    if (!String(odoo_login    || '').trim()) errs.odoo_login    = 'Wajib diisi';
    if (!String(odoo_password || '').trim() || odoo_password === MASKED) errs.odoo_password = 'Wajib diisi';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setWizardState(WIZARD_VERIFYING);
    setVerifyError('');
    try {
      const r = await verifyOdooConnection({
        base_url: odoo_base_url,
        db:       odoo_db,
        login:    odoo_login,
        password: odoo_password,
      });
      const list = r.data?.data?.companies || [];
      setCompanies(list);
      setWizardState(WIZARD_VERIFIED);
      // Auto-select the default company if none currently saved
      if (!config.odoo_company_id) {
        const def = list.find(c => c.isDefault) || list[0];
        if (def) {
          setConfig(c => ({ ...c, odoo_company_id: def.id, odoo_company_name: def.name }));
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Koneksi gagal';
      setVerifyError(msg);
      setWizardState(WIZARD_ERROR);
    }
  }

  async function handleOdooSave() {
    if (!config.odoo_company_id) {
      addToast('Pilih company terlebih dahulu.', 'error');
      return;
    }
    setOdooSaving(true);
    try {
      await saveOdooConfig({
        base_url:     config.odoo_base_url,
        db:           config.odoo_db,
        login:        config.odoo_login,
        password:     config.odoo_password !== MASKED ? config.odoo_password : undefined,
        company_id:   config.odoo_company_id,
        company_name: config.odoo_company_name || '',
      });
      addToast('Koneksi Odoo & company tersimpan.', 'success');
      setSaved(true);
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal menyimpan koneksi Odoo.', 'error');
    } finally {
      setOdooSaving(false);
    }
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

  // ── BCA helpers ────────────────────────────────────────────────────────────

  function setBcaField(key, value) {
    setBca((c) => ({ ...c, [key]: value }));
    if (bcaErrors[key]) setBcaErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  function setBcaEnv(env) {
    setBca((c) => ({
      ...c,
      bca_env:      env,
      bca_base_url: env === 'production' ? 'https://api.bca.co.id' : 'https://sandbox.bca.co.id',
    }));
  }

  function bcaFilledCount() {
    return BCA_REQUIRED.filter((k) => {
      const v = bca[k];
      return v && v !== MASKED && String(v).trim();
    }).length;
  }

  function validateBca() {
    const errs = {};
    for (const k of BCA_REQUIRED) {
      if (!bca[k] || bca[k] === MASKED || !String(bca[k]).trim()) errs[k] = 'Wajib diisi';
    }
    return errs;
  }

  async function handleBcaSave(e) {
    e.preventDefault();
    const errs = validateBca();
    if (Object.keys(errs).length) {
      setBcaErrors(errs);
      addToast('Lengkapi semua field yang wajib diisi.', 'error');
      return;
    }
    setBcaSaving(true);
    try {
      const r = await saveBcaQrisConfig(bca);
      setBca({ ...BCA_DEFAULT, ...r.data.data });
      setBcaErrors({});
      addToast('Konfigurasi BCA QRIS disimpan.', 'success');
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal menyimpan konfigurasi BCA QRIS.', 'error');
    } finally {
      setBcaSaving(false);
    }
  }

  async function handleBcaTokenTest() {
    setBcaTesting(true);
    try {
      const r = await testBcaQrisToken();
      addToast(r.data.message || 'Token berhasil didapatkan!', 'success');
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Test token gagal. Periksa credential.', 'error');
    } finally {
      setBcaTesting(false);
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

            {/* Section 1: Koneksi Odoo — connection wizard */}
            <section>
              <SectionTitle color="orange">🔗 Koneksi Odoo</SectionTitle>
              <div className="space-y-3">
                <Input label="Odoo Base URL" required
                  hint="→ ODOO_BASE_URL"
                  value={config.odoo_base_url || ''}
                  onChange={(e) => set('odoo_base_url', e.target.value)}
                  placeholder="https://your-instance.odoo.com"
                  error={errors.odoo_base_url} />

                <Input label="Database Name" required
                  hint="→ ODOO_DB"
                  value={config.odoo_db || ''}
                  onChange={(e) => set('odoo_db', e.target.value)}
                  placeholder="your-db-name"
                  error={errors.odoo_db} />

                <Input label="Login Username" required
                  hint="→ ODOO_LOGIN"
                  value={config.odoo_login || ''}
                  onChange={(e) => set('odoo_login', e.target.value)}
                  placeholder="admin@example.com"
                  error={errors.odoo_login} />

                <Input label="Password" required
                  hint="→ ODOO_PASSWORD"
                  type={showKey ? 'text' : 'password'}
                  value={config.odoo_password || ''}
                  onChange={(e) => set('odoo_password', e.target.value)}
                  placeholder={MASKED}
                  error={errors.odoo_password} />

                <ShowKeysToggle checked={showKey} onChange={setShowKey} />

                {/* Verify button */}
                <div className="flex items-center gap-3 pt-1">
                  <Button type="button"
                    loading={wizardState === WIZARD_VERIFYING}
                    disabled={wizardState === WIZARD_VERIFYING}
                    onClick={handleVerify}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5">
                    {wizardState === WIZARD_VERIFYING ? '⟳ Memverifikasi…' : '🔍 Verify Connection'}
                  </Button>
                  {wizardState === WIZARD_VERIFIED && (
                    <span className="text-xs text-green-600 font-medium">✓ Koneksi berhasil</span>
                  )}
                </div>

                {/* Inline auth error */}
                {wizardState === WIZARD_ERROR && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                    <span className="mt-0.5">✕</span>
                    <span>{verifyError}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Company dropdown — enabled only after successful verify */}
            <section>
              <SectionTitle color="orange">
                🏢 Pilih Company
                {wizardState !== WIZARD_VERIFIED && (
                  <span className="ml-2 text-xs font-normal text-gray-400">(verify koneksi terlebih dahulu)</span>
                )}
              </SectionTitle>

              {wizardState === WIZARD_VERIFIED && companies.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">
                      Company <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      value={config.odoo_company_id || ''}
                      onChange={(e) => {
                        const selected = companies.find(c => c.id === Number(e.target.value));
                        if (selected) {
                          set('odoo_company_id', selected.id);
                          set('odoo_company_name', selected.name);
                        }
                      }}>
                      <option value="">-- Pilih Company --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                    {config.odoo_company_id && (
                      <p className="text-xs text-gray-400">
                        Terpilih: <strong>{config.odoo_company_name}</strong> (ID: {config.odoo_company_id})
                      </p>
                    )}
                  </div>

                  <Button type="button"
                    loading={odooSaving}
                    disabled={odooSaving || !config.odoo_company_id}
                    onClick={handleOdooSave}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-5">
                    {odooSaving ? '⟳ Menyimpan…' : '💾 Simpan Koneksi & Company'}
                  </Button>
                </div>
              ) : (
                <div className="border border-dashed border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-400">
                  {wizardState === WIZARD_VERIFIED && companies.length === 0
                    ? 'Tidak ada company ditemukan untuk akun ini.'
                    : 'Lakukan Verify Connection untuk memuat daftar company dari Odoo.'}
                </div>
              )}
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

        {/* Save button — only for payment/odoo sub-tabs */}
        {subTab !== 'bca' && (
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
        )}
      </form>

      {/* ── BCA QRIS MPM Tab (outside main form to avoid nesting issues) ─── */}
      {subTab === 'bca' && (
        <div className="max-w-xl">
          {bcaLoading ? <Spinner /> : (
            <form onSubmit={handleBcaSave} className="space-y-6">

              {/* Header */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-900 to-blue-700 text-white">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center font-bold text-sm tracking-tight shrink-0">BCA</div>
                <div>
                  <p className="font-semibold text-sm">BCA QRIS MPM</p>
                  <p className="text-blue-200 text-xs mt-0.5">Merchant Presented Mode — SNAP OAuth 2.0</p>
                </div>
              </div>

              {/* Environment selector */}
              <section>
                <SectionTitle color="blue">🌐 Environment</SectionTitle>
                <div className="flex gap-2">
                  {['sandbox', 'production'].map((env) => (
                    <button key={env} type="button"
                      onClick={() => setBcaEnv(env)}
                      className={`px-5 py-2 rounded-lg text-sm font-medium border transition-all
                        ${bca.bca_env === env
                          ? 'bg-blue-900 text-white border-blue-900'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                      {env === 'sandbox' ? 'Sandbox' : 'Production'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2 font-mono">Base URL: {bca.bca_base_url}</p>
              </section>

              {/* Progress */}
              <BcaProgress filled={bcaFilledCount()} total={BCA_REQUIRED.length} />

              {/* OAuth Credentials */}
              <section>
                <SectionTitle color="blue">🔐 OAuth 2.0 — Identitas Aplikasi</SectionTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <BcaField label="Client ID" required hint="Header X-CLIENT-KEY"
                    id="bca_client_id" type={bcaShowKey ? 'text' : 'password'}
                    placeholder="xxxx-xxxx-xxxx"
                    value={bca.bca_client_id} onChange={(v) => setBcaField('bca_client_id', v)}
                    error={bcaErrors.bca_client_id} />
                  <BcaField label="Client Secret" required hint="Basic Auth untuk generate token"
                    id="bca_client_secret" type={bcaShowKey ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={bca.bca_client_secret} onChange={(v) => setBcaField('bca_client_secret', v)}
                    error={bcaErrors.bca_client_secret} />
                </div>
              </section>

              {/* API Credentials */}
              <section>
                <SectionTitle color="blue">🗝️ API Credential — Signing & Partner</SectionTitle>
                <div className="space-y-3">
                  <BcaField label="API Key" required hint="Nilai header X-PARTNER-ID tiap request QRIS"
                    id="bca_api_key" type={bcaShowKey ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={bca.bca_api_key} onChange={(v) => setBcaField('bca_api_key', v)}
                    error={bcaErrors.bca_api_key} />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      API Secret <span className="text-xs text-gray-500">(RSA Private Key)</span>
                      <span className="text-red-500 text-xs ml-1">*</span>
                    </label>
                    <p className="text-xs text-gray-400">Private key RSA untuk X-SIGNATURE asymmetric</p>
                    <textarea
                      rows={bcaShowKey ? 6 : 2}
                      placeholder={bcaShowKey ? '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----' : '••••••••••••••••'}
                      value={bca.bca_api_secret}
                      onChange={(e) => setBcaField('bca_api_secret', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2
                        resize-none transition-colors
                        ${bcaErrors.bca_api_secret
                          ? 'border-red-400 focus:ring-red-300'
                          : bca.bca_api_secret && bca.bca_api_secret !== MASKED
                            ? 'border-green-400 focus:ring-green-300'
                            : 'border-gray-300 focus:ring-blue-400'}`} />
                    {bcaErrors.bca_api_secret && (
                      <p className="text-xs text-red-500">{bcaErrors.bca_api_secret}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Show/hide toggle */}
              <ShowKeysToggle checked={bcaShowKey} onChange={setBcaShowKey} />

              <div className="border-t border-gray-100" />

              {/* Merchant Info */}
              <section>
                <SectionTitle color="blue">🏪 Merchant Info</SectionTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <BcaField label="Merchant ID" required hint="Dari BCA, di body generate QR"
                    id="bca_merchant_id" placeholder="000123456"
                    value={bca.bca_merchant_id} onChange={(v) => setBcaField('bca_merchant_id', v)}
                    error={bcaErrors.bca_merchant_id} />
                  <BcaField label="Terminal ID" required hint="ID terminal / kasir"
                    id="bca_terminal_id" placeholder="A01B02C3"
                    value={bca.bca_terminal_id} onChange={(v) => setBcaField('bca_terminal_id', v)}
                    error={bcaErrors.bca_terminal_id} />
                  <BcaField label="Channel ID" required hint="Nilai header CHANNEL-ID"
                    id="bca_channel_id" placeholder="95221"
                    value={bca.bca_channel_id} onChange={(v) => setBcaField('bca_channel_id', v)}
                    error={bcaErrors.bca_channel_id} />
                  <BcaField label="Callback / Webhook URL" required hint="URL publik HTTPS yang menerima notif BCA"
                    id="bca_callback_url" placeholder="https://yourdomain.com/api/v1/webhook/bca-qris"
                    value={bca.bca_callback_url} onChange={(v) => setBcaField('bca_callback_url', v)}
                    error={bcaErrors.bca_callback_url} />
                </div>
              </section>

              {/* Optional */}
              <section>
                <SectionTitle color="blue">
                  ⚙️ Opsional
                  <span className="ml-2 text-xs font-normal text-gray-400">(ada nilai default)</span>
                </SectionTitle>
                <div className="max-w-[200px]">
                  <BcaField label="Token TTL (detik)" hint="Default 840 = 900s expire − 60s buffer"
                    id="bca_token_ttl" type="number"
                    placeholder="840"
                    value={bca.bca_token_ttl}
                    onChange={(v) => setBcaField('bca_token_ttl', parseInt(v, 10) || 840)} />
                </div>
              </section>

              {/* Status indicator */}
              <BcaStatusBar filled={bcaFilledCount()} total={BCA_REQUIRED.length} />

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
                <Button type="submit" loading={bcaSaving}
                  className="bg-blue-900 hover:bg-blue-800 text-white px-8">
                  💾 Simpan Credential
                </Button>
                <Button type="button" loading={bcaTesting} disabled={bcaTesting}
                  onClick={handleBcaTokenTest}
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-5">
                  {bcaTesting ? '⟳ Testing…' : '🔍 Test Koneksi'}
                </Button>
              </div>

              {/* Info box */}
              <div className="flex gap-2 items-start bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
                <span className="mt-0.5 text-base">ℹ️</span>
                <div className="space-y-1">
                  <p><strong>Webhook URL</strong> harus bisa diakses publik melalui HTTPS.</p>
                  <p>Gunakan <code className="bg-blue-100 px-1 rounded font-mono">ngrok</code> untuk testing sandbox.</p>
                  <p>BCA akan POST ke: <code className="bg-blue-100 px-1 rounded font-mono">{bca.bca_callback_url || 'https://…/api/v1/webhook/bca-qris'}</code></p>
                </div>
              </div>

            </form>
          )}
        </div>
      )}

      {/* Odoo Actions — shown when on Odoo sub-tab */}
      {subTab === 'odoo' && (
        <div className="max-w-xl mt-4">
          <div className="flex items-center justify-between py-2 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-700">Sync Transaksi ke Odoo</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Push semua transaksi PAID yang belum masuk ke Odoo (termasuk transaksi lama yang terlewat).
              </p>
            </div>
            <Button type="button" loading={resyncing} disabled={resyncing}
              className="ml-4 bg-orange-500 hover:bg-orange-600 text-white text-xs px-4 whitespace-nowrap"
              onClick={async () => {
                setResyncing(true);
                try {
                  const r = (await resyncTransactions()).data;
                  addToast(
                    r.queued === 0
                      ? 'Semua transaksi sudah tersinkron.'
                      : `${r.queued} transaksi dikirim ke integration service.`,
                    'success'
                  );
                } catch (err) {
                  addToast(err.response?.data?.message || 'Gagal memulai resync.', 'error');
                } finally {
                  setResyncing(false);
                }
              }}>
              {resyncing ? '⟳ Syncing…' : '↻ Sync Transaksi'}
            </Button>
          </div>
        </div>
      )}

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
    blue:   'text-blue-900 border-blue-200',
  };
  return (
    <h3 className={`text-sm font-semibold mb-3 pb-1 border-b flex items-center gap-1 ${colors[color] || colors.teal}`}>
      {children}
    </h3>
  );
}

function BcaField({ label, required, hint, id, type = 'text', placeholder, value, onChange, error }) {
  const filled = value && value !== MASKED && String(value).trim();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-gray-700 flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 -mt-0.5">{hint}</p>}
      <input id={id} type={type} placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className={`border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 transition-colors
          ${error
            ? 'border-red-400 focus:ring-red-300'
            : filled
              ? 'border-green-400 focus:ring-green-300'
              : 'border-gray-300 focus:ring-blue-400'}`} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function BcaProgress({ filled, total }) {
  const pct = Math.round((filled / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full rounded-full bg-blue-700 transition-all duration-300"
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 shrink-0">{filled} / {total} terisi</span>
    </div>
  );
}

function BcaStatusBar({ filled, total }) {
  const complete = filled === total;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm
      ${complete
        ? 'bg-green-50 border-green-200 text-green-700'
        : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${complete ? 'bg-green-500' : 'bg-amber-400'}`} />
      {complete
        ? 'Semua field wajib terisi — siap generate .env'
        : `Belum lengkap: ${total - filled} field belum terisi`}
    </div>
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
