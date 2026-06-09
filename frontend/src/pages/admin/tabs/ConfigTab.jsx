import { useState, useEffect } from 'react';
import { getConfig, saveConfig, uploadLogo, getPrinterStatus, getUsers } from '../../../api/admin';
import { bustPublicConfigCache } from '../../../hooks/useAppLogo';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Spinner from '../../../components/ui/Spinner';
import ToastContainer from '../../../components/ui/Toast';
import { useToast } from '../../../hooks/useToast';

function SectionHeader({ color, icon, title }) {
  const colors = {
    amber:  'from-amber-500 to-orange-500',
    blue:   'from-blue-500 to-indigo-500',
    slate:  'from-slate-500 to-gray-600',
    rose:   'from-rose-500 to-pink-500',
    violet: 'from-violet-500 to-purple-600',
  };
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r ${colors[color]} text-white mb-3`}>
      <span className="text-base">{icon}</span>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ConfigTab() {
  const { toasts, addToast, removeToast } = useToast();
  const [config, setConfig]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo,   setUploadingLogo]   = useState(false);
  const [printerStatus,      setPrinterStatus]      = useState(null);
  const [testingPrinter,     setTestingPrinter]     = useState(false);
  const [cashiers,           setCashiers]           = useState([]);   // list of CASHIER users
  const [cashierTestStatus,  setCashierTestStatus]  = useState({});   // { [user_id]: { connected, address, message } | 'testing' }
  const [testingUserId,      setTestingUserId]       = useState(null);

  useEffect(() => {
    Promise.all([
      getConfig(),
      getUsers({ role: 'CASHIER' }),
    ])
      .then(([cfgRes, usersRes]) => {
        setConfig(cfgRes.data.data);
        setCashiers(usersRes.data.data ?? []);
      })
      .catch(() => addToast('Gagal memuat konfigurasi.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, value) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function onLogoChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  }

  async function handleLogoUpload(e) {
    e.preventDefault();
    if (!logoFile) return;
    setUploadingLogo(true);
    try {
      const base64 = await fileToBase64(logoFile);
      const r = await uploadLogo({ base64 });
      setConfig(r.data.data.config);
      setLogoFile(null);
      setLogoPreview(null);
      addToast('Logo berhasil diupload.', 'success');
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal upload logo.', 'error');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleTestPrinter() {
    setTestingPrinter(true);
    setPrinterStatus(null);
    try {
      const r = await getPrinterStatus();
      setPrinterStatus(r.data);
    } catch (err) {
      setPrinterStatus({ configured: false, connected: false, message: err.response?.data?.message ?? 'Gagal menghubungi server.' });
    } finally {
      setTestingPrinter(false);
    }
  }

  // Update a single field for a per-cashier printer assignment
  function setCashierPrinter(userId, field, value) {
    setConfig((c) => {
      const assignments = [...(c.printer_assignments || [])];
      const idx = assignments.findIndex((a) => a.user_id === userId);
      if (idx >= 0) {
        assignments[idx] = { ...assignments[idx], [field]: value };
      } else {
        assignments.push({ user_id: userId, printer_ip: '', printer_port: 9100, [field]: value });
      }
      return { ...c, printer_assignments: assignments };
    });
    setCashierTestStatus((s) => ({ ...s, [userId]: null }));
  }

  function getCashierAssignment(userId) {
    return (config?.printer_assignments || []).find((a) => a.user_id === userId) ?? { printer_ip: '', printer_port: 9100 };
  }

  async function handleTestCashierPrinter(userId) {
    setTestingUserId(userId);
    setCashierTestStatus((s) => ({ ...s, [userId]: 'testing' }));
    try {
      const r = await getPrinterStatus(userId);
      setCashierTestStatus((s) => ({ ...s, [userId]: r.data }));
    } catch (err) {
      setCashierTestStatus((s) => ({
        ...s,
        [userId]: { configured: false, connected: false, message: err.response?.data?.message ?? 'Gagal.' },
      }));
    } finally {
      setTestingUserId(null);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await saveConfig(config);
      setConfig(r.data.data);
      bustPublicConfigCache(); // invalidate logo/map/maintenance cache
      addToast('Konfigurasi berhasil disimpan.', 'success');
    } catch (err) {
      addToast(err.response?.data?.message ?? 'Gagal menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (!config) return <p className="text-sm text-gray-500">Gagal memuat konfigurasi.</p>;

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="max-w-xl space-y-6">

        {/* ── Logo Upload ─────────────────────────────────────────────────── */}
        <section>
          <SectionHeader color="violet" icon="🖼️" title="Logo Aplikasi" />
          <div className="bg-white rounded-xl border p-4 space-y-4">
            {/* Current logo preview */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
                {(logoPreview || config.logo_url) ? (
                  <img
                    src={logoPreview || config.logo_url}
                    alt="Logo"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <span className="text-3xl">🧸</span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  {config.logo_url ? 'Logo Terpasang' : 'Belum ada logo'}
                </p>
                <p className="text-xs text-gray-400">Format: PNG, JPG, SVG &bull; Maks 2MB &bull; Rekomendasi 200×200px</p>
                {config.logo_url && (
                  <p className="text-xs text-gray-400 font-mono mt-1 truncate">{config.logo_url}</p>
                )}
              </div>
            </div>

            {/* Upload form */}
            <form onSubmit={handleLogoUpload} className="flex items-center gap-3 pt-1 border-t">
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={onLogoChange}
                  className="hidden"
                />
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed text-sm transition-colors
                  ${logoFile ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-400 hover:border-violet-300 hover:text-violet-500'}`}>
                  <span>📁</span>
                  <span className="truncate">{logoFile ? logoFile.name : 'Pilih file logo...'}</span>
                </div>
              </label>
              <Button
                type="submit"
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
                loading={uploadingLogo}
                disabled={!logoFile}
              >
                Upload
              </Button>
              {logoFile && (
                <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                  className="text-gray-400 hover:text-gray-600 text-lg shrink-0">✕</button>
              )}
            </form>
          </div>
        </section>

        {/* ── Map Configuration ───────────────────────────────────────────── */}
        <section>
          <SectionHeader color="blue" icon="📍" title="Peta Lokasi" />
          <div className="bg-white rounded-xl border p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Google Maps Embed URL
              </label>
              <input
                type="url"
                placeholder="https://www.google.com/maps/embed?pb=..."
                value={config.map_embed_url || ''}
                onChange={(e) => set('map_embed_url', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Di Google Maps → Share → Embed a map → salin URL dari atribut <code className="bg-gray-100 px-1 rounded">src</code> pada iframe.
              </p>
            </div>
            {config.map_embed_url && (
              <div className="rounded-lg overflow-hidden border" style={{ height: '200px' }}>
                <iframe
                  src={config.map_embed_url}
                  title="Map Preview"
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Atau: URL Gambar Peta (fallback)
              </label>
              <input
                type="url"
                placeholder="https://... atau /uploads/map.png"
                value={config.map_image_url || ''}
                onChange={(e) => set('map_image_url', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Digunakan jika Google Maps Embed tidak tersedia. Upload gambar via fitur upload di atas lalu tempel URL-nya.
              </p>
            </div>
          </div>
        </section>

        {/* ── Event Info ──────────────────────────────────────────────────── */}
        <form onSubmit={handleSave} className="space-y-6">
          <section>
            <SectionHeader color="amber" icon="🎪" title="Informasi Event" />
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <Input label="Nama Event"
                value={config.event_name || ''}
                onChange={(e) => set('event_name', e.target.value)} />
              <Input label="Venue / Lokasi"
                value={config.venue || ''}
                onChange={(e) => set('venue', e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Tanggal Mulai" type="date"
                  value={config.event_date_start || ''}
                  onChange={(e) => set('event_date_start', e.target.value)} />
                <Input label="Tanggal Selesai" type="date"
                  value={config.event_date_end || ''}
                  onChange={(e) => set('event_date_end', e.target.value)} />
              </div>
              <Input label="Email Kontak" type="email"
                value={config.contact_email || ''}
                onChange={(e) => set('contact_email', e.target.value)} />
            </div>
          </section>

          {/* ── Transaction Rules ────────────────────────────────────────── */}
          <section>
            <SectionHeader color="blue" icon="🛒" title="Aturan Transaksi" />
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input label="Batas Waktu Checkout (menit)" type="number" min="1" max="1440"
                    value={config.txn_timeout_checkout ?? 30}
                    onChange={(e) => set('txn_timeout_checkout', parseInt(e.target.value, 10) || 30)} />
                  <p className="text-xs text-gray-400 mt-1">
                    Timer "Bayar dalam X menit" di halaman konfirmasi order customer. Sumber: <code className="bg-gray-100 px-1 rounded">TXN_PENDING_TIMEOUT_MINUTES</code>
                  </p>
                </div>
                <Input label="Maks Item per Order" type="number" min="1" max="100"
                  value={config.max_items_per_order ?? 20}
                  onChange={(e) => set('max_items_per_order', parseInt(e.target.value, 10))} />
              </div>
            </div>
          </section>

          {/* ── Mode Penjualan (CR-035) ──────────────────────────────────── */}
          <section>
            <SectionHeader color="violet" icon="🏪" title="Mode Penjualan" />
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <p className="text-xs text-gray-500">
                Menentukan cara customer melakukan pemesanan secara global. Setiap booth dapat override mode ini secara individual di tab <strong>Booth</strong>.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {/* HELPER_INPUT card */}
                <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors
                  ${(config.order_mode || 'HELPER_INPUT') === 'HELPER_INPUT'
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-200 hover:border-violet-300'}`}>
                  <input
                    type="radio"
                    name="order_mode"
                    value="HELPER_INPUT"
                    checked={(config.order_mode || 'HELPER_INPUT') === 'HELPER_INPUT'}
                    onChange={() => set('order_mode', 'HELPER_INPUT')}
                    className="mt-0.5 accent-violet-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Helper Input <span className="ml-1 text-xs bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">Model C</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Petugas booth (HELPER) menginput pesanan atas nama customer. Stok dikurangi langsung, customer menerima QR dan bayar ke kasir.
                    </p>
                  </div>
                </label>
                {/* HELPER_APPROVE card — CR-040 */}
                <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors
                  ${config.order_mode === 'HELPER_APPROVE'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-300'}`}>
                  <input
                    type="radio"
                    name="order_mode"
                    value="HELPER_APPROVE"
                    checked={config.order_mode === 'HELPER_APPROVE'}
                    onChange={() => set('order_mode', 'HELPER_APPROVE')}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Helper Approve <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">Model D — Baru</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Customer memesan sendiri, tetapi pesanan masuk ke antrian <em>PENDING_APPROVAL</em>. Petugas booth mereview dan menyetujui/menolak. Stok dikurangi dan timer mulai hanya setelah disetujui.
                    </p>
                  </div>
                </label>
                {/* SELF_ORDER card */}
                <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors
                  ${config.order_mode === 'SELF_ORDER'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'}`}>
                  <input
                    type="radio"
                    name="order_mode"
                    value="SELF_ORDER"
                    checked={config.order_mode === 'SELF_ORDER'}
                    onChange={() => set('order_mode', 'SELF_ORDER')}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Self Order <span className="ml-1 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">Legacy</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Customer memilih produk dan membuat pesanan sendiri. Stok dikurangi langsung. Mode sebelum CR-035.
                    </p>
                  </div>
                </label>
              </div>
              {(config.order_mode || 'HELPER_INPUT') === 'HELPER_INPUT' && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>Dalam mode <strong>Helper Input</strong>, halaman kiosk customer masih bisa diakses tetapi backend akan mengarahkan pembuatan order hanya melalui petugas booth. Pastikan semua booth sudah memiliki akun HELPER yang terdaftar.</span>
                </div>
              )}
              {config.order_mode === 'HELPER_APPROVE' && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
                  <span className="shrink-0 mt-0.5">✅</span>
                  <span>Dalam mode <strong>Helper Approve</strong>, customer memesan mandiri namun pesanan tidak akan memotong stok sampai petugas booth menyetujuinya. Tab <em>Antrian Approval</em> akan muncul di halaman Helper.</span>
                </div>
              )}
            </div>
          </section>

          {/* ── Printer Thermal ──────────────────────────────────────────── */}
          <section>
            <SectionHeader color="slate" icon="🖨️" title="Printer Thermal (ESC/POS)" />

            {/* Global / fallback printer */}
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Printer Global (Fallback)</p>
              <p className="text-xs text-gray-400">
                Digunakan jika kasir tidak memiliki printer yang ditetapkan secara khusus.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Input label="IP Address"
                    placeholder="Contoh: 192.168.0.105"
                    value={config.printer_ip || ''}
                    onChange={(e) => { set('printer_ip', e.target.value); setPrinterStatus(null); }} />
                </div>
                <div>
                  <Input label="Port" type="number" min="1" max="65535"
                    placeholder="9100"
                    value={config.printer_port ?? 9100}
                    onChange={(e) => { set('printer_port', parseInt(e.target.value, 10) || 9100); setPrinterStatus(null); }} />
                </div>
              </div>

              {printerStatus && (
                <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm border
                  ${printerStatus.connected
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'}`}>
                  <span className="text-base leading-none mt-0.5">{printerStatus.connected ? '✅' : '❌'}</span>
                  <div>
                    <p className="font-medium">{printerStatus.connected ? 'Printer terhubung' : 'Printer tidak terjangkau'}</p>
                    <p className="text-xs mt-0.5 opacity-80">{printerStatus.message}</p>
                    {printerStatus.configured && !printerStatus.connected && (
                      <p className="text-xs mt-1">Pastikan printer menyala, di jaringan yang sama, dan port tidak diblokir firewall.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={handleTestPrinter} disabled={testingPrinter}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors">
                  {testingPrinter
                    ? <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Menguji…</>
                    : <>🔌 Test Koneksi</>}
                </button>
                <span className="text-xs text-gray-400">Test menggunakan nilai yang sudah <strong>tersimpan</strong>.</span>
              </div>
            </div>

            {/* Per-cashier printer assignments */}
            <div className="bg-white rounded-xl border p-4 space-y-3 mt-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Printer per Kasir</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Jika diisi, kasir tersebut akan selalu mencetak ke printer khusus ini, mengabaikan printer global di atas.
                  Kosongkan IP untuk menggunakan printer global.
                </p>
              </div>

              {cashiers.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">Belum ada akun kasir. Tambahkan kasir di tab User &amp; Role.</p>
              ) : (
                <div className="divide-y">
                  {cashiers.map((cashier) => {
                    const assignment   = getCashierAssignment(cashier.user_id);
                    const testResult   = cashierTestStatus[cashier.user_id];
                    const isTesting    = testingUserId === cashier.user_id;
                    const hasIp        = !!assignment.printer_ip;

                    return (
                      <div key={cashier.user_id} className="py-3 space-y-2">
                        {/* Cashier name + status badge */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{cashier.display_name}</span>
                            <span className="text-xs text-gray-400 font-mono">@{cashier.username}</span>
                            {!cashier.is_active && (
                              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">nonaktif</span>
                            )}
                          </div>
                          {hasIp && (
                            <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-mono">
                              {assignment.printer_ip}:{assignment.printer_port || 9100}
                            </span>
                          )}
                        </div>

                        {/* IP + Port inputs */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <input
                              type="text"
                              placeholder="IP Printer (kosong = gunakan global)"
                              value={assignment.printer_ip || ''}
                              onChange={(e) => setCashierPrinter(cashier.user_id, 'printer_ip', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              min="1" max="65535"
                              placeholder="9100"
                              value={assignment.printer_port || 9100}
                              onChange={(e) => setCashierPrinter(cashier.user_id, 'printer_port', parseInt(e.target.value, 10) || 9100)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono"
                            />
                          </div>
                        </div>

                        {/* Test result */}
                        {testResult && testResult !== 'testing' && (
                          <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 border
                            ${testResult.connected
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-red-50 border-red-200 text-red-700'}`}>
                            <span>{testResult.connected ? '✅' : '❌'}</span>
                            <span>{testResult.message}</span>
                            {testResult.address && <span className="font-mono opacity-70">({testResult.address})</span>}
                          </div>
                        )}

                        {/* Test button */}
                        <button
                          type="button"
                          onClick={() => handleTestCashierPrinter(cashier.user_id)}
                          disabled={isTesting || !hasIp}
                          title={!hasIp ? 'Isi IP printer terlebih dahulu' : ''}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                        >
                          {isTesting
                            ? <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Menguji…</>
                            : <>🔌 Test</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ── System ───────────────────────────────────────────────────── */}
          <section>
            <SectionHeader color="rose" icon="⚠️" title="Sistem" />
            <div className="bg-white rounded-xl border p-4">
              <label className="flex items-center gap-4 cursor-pointer select-none">
                <div className="relative shrink-0">
                  <input type="checkbox" className="sr-only"
                    checked={!!config.maintenance_mode}
                    onChange={(e) => set('maintenance_mode', e.target.checked)} />
                  <div className={`w-11 h-6 rounded-full transition-colors duration-200
                    ${config.maintenance_mode ? 'bg-red-500' : 'bg-gray-300'}`} />
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200
                    ${config.maintenance_mode ? 'translate-x-5' : ''}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Maintenance Mode</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Saat aktif, sistem menampilkan halaman maintenance kepada pengguna
                  </p>
                </div>
                {config.maintenance_mode && (
                  <span className="ml-auto shrink-0 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-medium">
                    AKTIF
                  </span>
                )}
              </label>
            </div>
          </section>

          <Button
            type="submit"
            loading={saving}
            className="bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto px-8"
          >
            💾 Simpan Konfigurasi
          </Button>
        </form>
      </div>
    </>
  );
}
