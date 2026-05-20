import { useState, useEffect } from 'react';
import { getTaxConfig, saveTaxConfig, getOdooTaxes } from '../../../api/admin';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Spinner from '../../../components/ui/Spinner';
import ToastContainer from '../../../components/ui/Toast';
import { useToast } from '../../../hooks/useToast';

// ── Tax Grid reference table ──────────────────────────────────────────────────
const TAX_GRID_ROWS = [
  { field: 'tax_grid_i1',  label: 'I1',  spt: 'Kolom DPP',  keterangan: 'Dasar Pengenaan Pajak Keluaran',          bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700' },
  { field: 'tax_grid_i2',  label: 'I2',  spt: 'Kolom PPN',  keterangan: 'PPN Keluaran',                             bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700' },
  { field: 'tax_grid_ii1', label: 'II1', spt: 'Kolom DPP',  keterangan: 'Dasar Pengenaan Pajak Masukan',           bg: 'bg-violet-50', badge: 'bg-violet-100 text-violet-700' },
  { field: 'tax_grid_ii2', label: 'II2', spt: 'Kolom PPN',  keterangan: 'PPN Masukan yang dapat dikreditkan',       bg: 'bg-violet-50', badge: 'bg-violet-100 text-violet-700' },
];

// ── Account mapping rows ──────────────────────────────────────────────────────
const ACCOUNT_ROWS = [
  { field: 'odoo_account_receivable',  label: 'Piutang (Receivable)',     pos: 'Dr', color: 'text-blue-700',   hint: 'Cth: 1100 / 1200 / Piutang Dagang' },
  { field: 'odoo_account_revenue',     label: 'Pendapatan (Revenue)',     pos: 'Cr', color: 'text-emerald-700',hint: 'Cth: 4100 / 4000 / Penjualan' },
  { field: 'odoo_account_tax_output',  label: 'PPN Keluaran (Output VAT)',pos: 'Cr', color: 'text-emerald-700',hint: 'Cth: 2100 / Utang PPN' },
  { field: 'odoo_account_tax_input',   label: 'PPN Masukan (Input VAT)',  pos: 'Dr', color: 'text-blue-700',   hint: 'Cth: 1500 / Pajak Dibayar di Muka' },
];

// ── Alur transaksi steps ──────────────────────────────────────────────────────
const FLOW_STEPS = [
  { icon: '🛒', label: 'Sales Order',      sub: 'Customer checkout & QR' },
  { icon: '✅', label: 'Konfirmasi',        sub: 'Kasir scan & proses bayar' },
  { icon: '🧾', label: 'Invoice / Faktur',  sub: 'Otomatis terbuat di Odoo' },
  { icon: '📒', label: 'Journal Entry',     sub: 'Piutang Dr / Pendapatan Cr / PPN Cr' },
  { icon: '📊', label: 'Tax Closing',       sub: 'Akhir masa → hutang PPN' },
  { icon: '📤', label: 'e-Faktur CSV',      sub: 'Export → upload ke DJP' },
];

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, subtitle, children, icon }) {
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

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, desc }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
          ${checked ? 'bg-emerald-500' : 'bg-gray-300'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TaxTab() {
  const { toasts, addToast, removeToast } = useToast();

  const [cfg, setCfg]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [odooTaxes, setOdooTaxes]   = useState([]);
  const [fetchingTaxes, setFetchingTaxes] = useState(false);
  const [taxFetchError, setTaxFetchError] = useState('');

  // ── Load config ─────────────────────────────────────────────────────────────
  useEffect(() => {
    getTaxConfig()
      .then((r) => setCfg(r.data.data))
      .catch(() => addToast('Gagal memuat konfigurasi pajak.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, value) {
    setCfg((c) => ({ ...c, [key]: value }));
  }

  // ── Fetch Odoo tax list ─────────────────────────────────────────────────────
  async function handleFetchOdooTaxes() {
    setFetchingTaxes(true);
    setTaxFetchError('');
    try {
      const r = await getOdooTaxes();
      setOdooTaxes(r.data.data);
      if (r.data.data.length === 0) setTaxFetchError('Tidak ada pajak penjualan aktif di Odoo.');
    } catch (err) {
      setTaxFetchError(err.response?.data?.message ?? 'Gagal terhubung ke Odoo. Pastikan konfigurasi Odoo sudah benar.');
    } finally {
      setFetchingTaxes(false);
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await saveTaxConfig(cfg);
      setCfg(r.data.data);
      addToast('Konfigurasi pajak berhasil disimpan.', 'success');
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (!cfg)    return null;

  const selectedTax = odooTaxes.find((t) => t.id === cfg.odoo_tax_id);

  return (
    <>
      <form onSubmit={handleSave} className="space-y-5">

        {/* ── 1. Konfigurasi PPN ─────────────────────────────────────────── */}
        <Section
          icon="🧮"
          title="Konfigurasi PPN"
          subtitle="Atur tarif dan status PPN untuk semua transaksi baru"
        >
          <div className="space-y-4">
            <Toggle
              checked={!!cfg.ppn_active}
              onChange={(v) => set('ppn_active', v)}
              label="PPN Aktif"
              desc="Jika dinonaktifkan, transaksi baru tidak dikenakan pajak"
            />

            <div className={`transition-opacity ${cfg.ppn_active ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Tarif PPN (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={cfg.ppn_rate ?? 12}
                  onChange={(e) => set('ppn_rate', e.target.value)}
                />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Nilai PPN contoh (Rp 1.000.000)
                  </label>
                  <div className="h-10 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono">
                    Rp {Math.round(1_000_000 * (parseFloat(cfg.ppn_rate) || 0) / 100).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </div>

            {/* Odoo Tax mapping */}
            <div className="border-t pt-4 mt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Mapping Odoo Tax ID
              </p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  {odooTaxes.length > 0 ? (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Pilih pajak dari Odoo
                      </label>
                      <select
                        value={cfg.odoo_tax_id ?? ''}
                        onChange={(e) => {
                          const id  = e.target.value ? parseInt(e.target.value, 10) : null;
                          const tax = odooTaxes.find((t) => t.id === id);
                          set('odoo_tax_id', id);
                          set('odoo_tax_name', tax?.name ?? '');
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 h-10 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                      >
                        <option value="">— Tidak dipilih —</option>
                        {odooTaxes.map((t) => (
                          <option key={t.id} value={t.id}>
                            [{t.id}] {t.name} — {t.amount}% {t.priceInclude ? '(inklusif)' : '(eksklusif)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <Input
                      label="Odoo Tax ID (manual)"
                      type="number"
                      placeholder="Contoh: 5"
                      value={cfg.odoo_tax_id ?? ''}
                      onChange={(e) => set('odoo_tax_id', e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleFetchOdooTaxes}
                  disabled={fetchingTaxes}
                  className="h-10 px-4 rounded-lg border border-orange-300 bg-orange-50 text-orange-700 text-sm font-medium
                    hover:bg-orange-100 disabled:opacity-50 whitespace-nowrap"
                >
                  {fetchingTaxes ? '⏳ Mengambil…' : '🔄 Fetch dari Odoo'}
                </button>
              </div>

              {taxFetchError && (
                <p className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{taxFetchError}</p>
              )}

              {cfg.odoo_tax_id && (
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                  <span>✓</span>
                  <span>
                    Odoo Tax ID <strong>{cfg.odoo_tax_id}</strong>
                    {cfg.odoo_tax_name ? ` — "${cfg.odoo_tax_name}"` : ''}
                    {selectedTax ? ` (${selectedTax.amount}%)` : ''}
                  </span>
                </div>
              )}

              <p className="mt-2 text-xs text-gray-400">
                Tax ID ini digunakan saat order dikirim ke Odoo agar PPN otomatis masuk ke invoice.
                Jalankan <code className="bg-gray-100 px-1 rounded">Fetch dari Odoo</code> untuk melihat daftar pajak yang tersedia.
              </p>
            </div>
          </div>
        </Section>

        {/* ── 2. Tax Grid SPT Masa PPN ───────────────────────────────────── */}
        <Section
          icon="📋"
          title="Tax Grid — SPT Masa PPN"
          subtitle="Mapping kode grid Odoo ke kolom formulir SPT. Digunakan di Accounting → Reporting → Tax Report"
        >
          <div className="space-y-3">
            {/* Info banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Cara konfigurasi di Odoo 18</p>
              <p>Buka <strong>Accounting → Configuration → Taxes</strong>, pilih PPN 12%, lalu di tab <strong>Advanced Options</strong> isi kolom <em>Tax Grids</em> sesuai mapping di bawah.</p>
            </div>

            {/* Mapping table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tax Grid</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kode Grid Odoo</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Formulir SPT</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {TAX_GRID_ROWS.map((row) => (
                    <tr key={row.field} className={row.bg}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${row.badge}`}>
                          {row.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={cfg[row.field] ?? ''}
                          onChange={(e) => set(row.field, e.target.value)}
                          placeholder={`+${row.label}`}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-xs font-mono
                            focus:ring-1 focus:ring-orange-400 focus:border-orange-400 bg-white"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 font-medium">{row.spt}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{row.keterangan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* ── 3. Mapping Akun Jurnal Odoo ───────────────────────────────── */}
        <Section
          icon="📒"
          title="Mapping Akun Jurnal Odoo"
          subtitle="Kode akun Chart of Accounts yang digunakan pada Journal Entry saat transaksi terbayar"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACCOUNT_ROWS.map((row) => (
                <div key={row.field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <span className={`font-bold mr-1 ${row.color}`}>{row.pos}</span>
                    {row.label}
                  </label>
                  <input
                    type="text"
                    value={cfg[row.field] ?? ''}
                    onChange={(e) => set(row.field, e.target.value)}
                    placeholder={row.hint}
                    className="w-full border border-gray-300 rounded-lg px-3 h-9 text-sm
                      focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  />
                </div>
              ))}
            </div>

            {/* Journal entry preview */}
            {(cfg.odoo_account_receivable || cfg.odoo_account_revenue || cfg.odoo_account_tax_output) && (
              <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Contoh Journal Entry (transaksi Rp 2.000.000 + PPN {cfg.ppn_rate}%)</p>
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-200">
                      <th className="text-left pb-1">Akun</th>
                      <th className="text-right pb-1">Debit</th>
                      <th className="text-right pb-1">Kredit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cfg.odoo_account_receivable && (
                      <tr>
                        <td className="py-1 text-blue-700">{cfg.odoo_account_receivable} — Piutang</td>
                        <td className="text-right py-1 text-blue-700">
                          {(2_000_000 * (1 + (parseFloat(cfg.ppn_rate) || 0) / 100)).toLocaleString('id-ID')}
                        </td>
                        <td className="text-right py-1">—</td>
                      </tr>
                    )}
                    {cfg.odoo_account_revenue && (
                      <tr>
                        <td className="py-1 text-emerald-700">{cfg.odoo_account_revenue} — Pendapatan</td>
                        <td className="text-right py-1">—</td>
                        <td className="text-right py-1 text-emerald-700">2.000.000</td>
                      </tr>
                    )}
                    {cfg.odoo_account_tax_output && (
                      <tr>
                        <td className="py-1 text-emerald-700">{cfg.odoo_account_tax_output} — PPN Keluaran</td>
                        <td className="text-right py-1">—</td>
                        <td className="text-right py-1 text-emerald-700">
                          {Math.round(2_000_000 * (parseFloat(cfg.ppn_rate) || 0) / 100).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Section>

        {/* ── 4. Info e-Faktur ───────────────────────────────────────────── */}
        <Section
          icon="🗂️"
          title="Info e-Faktur & PKP"
          subtitle="Data Pengusaha Kena Pajak untuk pembuatan e-Faktur dan laporan SPT"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="NPWP Pengusaha Kena Pajak"
              placeholder="00.000.000.0-000.000"
              value={cfg.efaktur_npwp ?? ''}
              onChange={(e) => set('efaktur_npwp', e.target.value)}
            />
            <Input
              label="Nama Pengusaha Kena Pajak"
              placeholder="Nama sesuai NPWP"
              value={cfg.efaktur_name ?? ''}
              onChange={(e) => set('efaktur_name', e.target.value)}
            />
          </div>
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 space-y-1">
            <p className="font-semibold">Alur e-Faktur di Odoo 18</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
              <li>Validasi Invoice di Odoo → Faktur Pajak otomatis terbuat</li>
              <li>Akhir masa pajak: <strong>Accounting → Tax Return</strong> → generate e-Faktur CSV</li>
              <li>Upload file CSV ke aplikasi <strong>DJP e-Faktur</strong></li>
              <li>Laporan SPT via <strong>Accounting → Reporting → Tax Report</strong></li>
            </ol>
          </div>
        </Section>

        {/* ── 5. Alur Transaksi (informational) ─────────────────────────── */}
        <Section
          icon="🔄"
          title="Alur Transaksi PPN di Sistem"
          subtitle="Gambaran keseluruhan alur dari checkout pelanggan hingga laporan pajak"
        >
          {/* Flow diagram */}
          <div className="flex flex-wrap items-center gap-1">
            {FLOW_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="flex flex-col items-center text-center min-w-[80px]">
                  <div className="w-10 h-10 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center text-lg mb-1">
                    {step.icon}
                  </div>
                  <p className="text-xs font-semibold text-gray-700 leading-tight">{step.label}</p>
                  <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{step.sub}</p>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <span className="text-gray-300 text-lg font-light mb-4">→</span>
                )}
              </div>
            ))}
          </div>

          {/* Tax report path */}
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 divide-y divide-gray-200 text-xs">
            <div className="px-4 py-2.5 flex items-start gap-3">
              <span className="font-semibold text-gray-500 w-24 shrink-0">Tax Report</span>
              <span className="text-gray-700">Accounting → Reporting → Tax Report</span>
            </div>
            <div className="px-4 py-2.5 flex items-start gap-3">
              <span className="font-semibold text-gray-500 w-24 shrink-0">SPT Masa PPN</span>
              <span className="text-gray-700">I1 (DPP Keluaran) · I2 (PPN Keluaran) · II1 (DPP Masukan) · II2 (PPN Masukan)</span>
            </div>
            <div className="px-4 py-2.5 flex items-start gap-3">
              <span className="font-semibold text-gray-500 w-24 shrink-0">e-Faktur</span>
              <span className="text-gray-700">Export CSV dari Odoo → Upload DJP</span>
            </div>
          </div>
        </Section>

        {/* ── Save button ────────────────────────────────────────────────── */}
        <div className="flex justify-end pt-2">
          <Button type="submit" loading={saving}>
            Simpan Konfigurasi Pajak
          </Button>
        </div>

      </form>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
