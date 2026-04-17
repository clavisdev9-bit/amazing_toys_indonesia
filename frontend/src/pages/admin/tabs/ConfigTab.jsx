import { useState, useEffect } from 'react';
import { getConfig, saveConfig, uploadLogo } from '../../../api/admin';
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
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    getConfig()
      .then((r) => setConfig(r.data.data))
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
            <div className="bg-white rounded-xl border p-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Timeout Pending (menit)" type="number" min="1" max="1440"
                  value={config.pending_timeout_minutes ?? 30}
                  onChange={(e) => set('pending_timeout_minutes', parseInt(e.target.value, 10))} />
                <Input label="Maks Item per Order" type="number" min="1" max="100"
                  value={config.max_items_per_order ?? 20}
                  onChange={(e) => set('max_items_per_order', parseInt(e.target.value, 10))} />
              </div>
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
