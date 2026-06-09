import { useState, useEffect, useRef } from 'react';
import {
  getWaGatewayConfig, saveWaGatewayConfig, testWaSend,
  getWahaStatus, startWahaSession, getWahaQr,
} from '../../../api/admin';
import Button  from '../../../components/ui/Button';
import Input   from '../../../components/ui/Input';
import Spinner from '../../../components/ui/Spinner';
import ToastContainer from '../../../components/ui/Toast';
import { useToast } from '../../../hooks/useToast';

const PROVIDERS = [
  { value: 'disabled', label: '— Tidak aktif —',    hint: 'Layer 1 dilewati; order tetap berjalan normal.' },
  { value: 'waha',     label: 'WAHA (Self-hosted)',  hint: 'WhatsApp HTTP API — deploy sendiri dengan devlikeapro/waha. X-Api-Key opsional.' },
  { value: 'wablas',   label: 'Wablas',              hint: 'API Key dari dashboard Wablas.' },
  { value: 'zenziva',  label: 'Zenziva',             hint: 'Format apiKey: userkey:passkey' },
  { value: 'twilio',   label: 'Twilio WhatsApp',     hint: 'Format apiKey: accountSid:authToken' },
];

const WAHA_STATUS_COLORS = {
  WORKING:       'bg-green-100 text-green-700',
  SCAN_QR_CODE:  'bg-orange-100 text-orange-700',
  STARTING:      'bg-blue-100 text-blue-700',
  STOPPED:       'bg-gray-100 text-gray-600',
  FAILED:        'bg-red-100 text-red-700',
};

const DEFAULT_TEMPLATE =
  'Halo! Pesanan Anda di {boothName} berhasil dibuat.\nTotal: {totalAmount}\nTunjukkan QR ke kasir: {link}\nBerlaku {expiryMinutes} menit.';

function Section({ icon, title, subtitle, children }) {
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

function Label({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-gray-600 mb-1">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function WahaStatusBadge({ status }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  const cls = WAHA_STATUS_COLORS[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status === 'WORKING' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />}
      {status}
    </span>
  );
}

export default function WaGatewayTab() {
  const [config, setConfig]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [showKey, setShowKey] = useState(false);

  // WAHA pairing panel state
  const [wahaStatus, setWahaStatus]   = useState(null);
  const [wahaQr, setWahaQr]           = useState(null);
  const [wahaChecking, setWahaChecking] = useState(false);
  const [wahaStarting, setWahaStarting] = useState(false);
  const [wahaQrLoading, setWahaQrLoading] = useState(false);
  const qrPollRef = useRef(null);

  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    getWaGatewayConfig()
      .then((r) => setConfig(r.data.data))
      .catch(() => showToast('Gagal memuat konfigurasi WA.', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Stop QR polling when unmounting or provider changes away from waha
  useEffect(() => {
    return () => { if (qrPollRef.current) clearInterval(qrPollRef.current); };
  }, []);

  function set(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await saveWaGatewayConfig(config);
      setConfig(res.data.data);
      showToast('Konfigurasi WA API disimpan.', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal menyimpan.', 'error');
    } finally { setSaving(false); }
  }

  async function handleTest() {
    if (!testPhone.trim()) { showToast('Masukkan nomor HP untuk tes.', 'error'); return; }
    setTesting(true);
    try {
      await testWaSend(testPhone.trim());
      showToast(`Pesan tes berhasil dikirim ke ${testPhone.trim()}.`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal mengirim tes.', 'error');
    } finally { setTesting(false); }
  }

  async function handleCheckWahaStatus() {
    setWahaChecking(true);
    try {
      const r = await getWahaStatus();
      const sessionData = r.data.data;
      const status = sessionData?.status || sessionData?.state || 'UNKNOWN';
      setWahaStatus(status);
      if (status === 'SCAN_QR_CODE') {
        await fetchWahaQr();
        // Poll QR refresh every 15s while in SCAN_QR_CODE
        if (qrPollRef.current) clearInterval(qrPollRef.current);
        qrPollRef.current = setInterval(async () => {
          const r2 = await getWahaStatus().catch(() => null);
          const s2 = r2?.data?.data?.status || r2?.data?.data?.state;
          setWahaStatus(s2 || status);
          if (s2 === 'WORKING') {
            clearInterval(qrPollRef.current);
            setWahaQr(null);
            showToast('WhatsApp berhasil terhubung!', 'success');
          } else if (s2 === 'SCAN_QR_CODE') {
            fetchWahaQr();
          } else {
            clearInterval(qrPollRef.current);
          }
        }, 15000);
      } else {
        if (qrPollRef.current) clearInterval(qrPollRef.current);
        setWahaQr(null);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal memeriksa status WAHA.', 'error');
    } finally { setWahaChecking(false); }
  }

  async function handleStartWahaSession() {
    setWahaStarting(true);
    try {
      await startWahaSession();
      showToast('Permintaan memulai session dikirim.', 'success');
      // Check status after short delay
      setTimeout(() => handleCheckWahaStatus(), 2000);
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal memulai session WAHA.', 'error');
    } finally { setWahaStarting(false); }
  }

  async function fetchWahaQr() {
    setWahaQrLoading(true);
    try {
      const r = await getWahaQr();
      setWahaQr(r.data.data?.qr || null);
    } catch {
      setWahaQr(null);
    } finally { setWahaQrLoading(false); }
  }

  if (loading) return <Spinner />;
  if (!config)  return null;

  const isWaha = config.provider === 'waha';
  const selectedProvider = PROVIDERS.find((p) => p.value === config.provider) || PROVIDERS[0];

  return (
    <div className="space-y-5 max-w-2xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Provider ── */}
      <Section icon="📡" title="Provider WhatsApp / SMS" subtitle="Pilih gateway yang digunakan untuk pengiriman QR order via pesan.">
        <div className="space-y-2">
          {PROVIDERS.map((p) => (
            <label
              key={p.value}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                config.provider === p.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="provider"
                value={p.value}
                checked={config.provider === p.value}
                onChange={() => { set('provider', p.value); setWahaStatus(null); setWahaQr(null); }}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{p.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </Section>

      {/* ── Credentials (hidden when disabled) ── */}
      {config.provider !== 'disabled' && (
        <Section
          icon="🔑"
          title="Kredensial API"
          subtitle={isWaha ? 'X-Api-Key opsional — kosongkan jika WAHA tidak dikonfigurasi dengan API key.' : 'Data ini disimpan terenkripsi dan tidak pernah ditampilkan utuh.'}
        >
          <div className="space-y-4">

            {/* WAHA: Session Name */}
            {isWaha && (
              <div>
                <Label required>Session Name</Label>
                <Input
                  value={config.wahaSession || 'default'}
                  onChange={(e) => set('wahaSession', e.target.value || 'default')}
                  placeholder="default"
                />
                <p className="text-xs text-gray-400 mt-1">Nama session WAHA. Default: <span className="font-mono">default</span></p>
              </div>
            )}

            {/* WAHA: Base URL (required); others: API URL (optional) */}
            <div>
              <Label required={isWaha}>{isWaha ? 'WAHA Base URL' : 'API URL (opsional — kosongkan untuk default)'}</Label>
              <Input
                value={config.apiUrl}
                onChange={(e) => set('apiUrl', e.target.value)}
                placeholder={isWaha ? 'http://localhost:3010' : 'https://console.wablas.com/api/send-message'}
              />
              {isWaha && (
                <p className="text-xs text-gray-400 mt-1">
                  URL host WAHA Anda. Gunakan <span className="font-mono">http://hybrid_waha:3000</span> jika dijalankan dalam satu stack Docker.
                </p>
              )}
            </div>

            {/* API Key */}
            <div>
              <Label>{isWaha ? 'X-Api-Key (opsional)' : 'API Key / Token'}{!isWaha && <span className="text-red-500"> *</span>}</Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(e) => set('apiKey', e.target.value)}
                  placeholder={isWaha ? 'Kosongkan jika tidak menggunakan API key' : selectedProvider.hint}
                  className="pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-blue-600"
                >
                  {showKey ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
              {!isWaha && (
                <p className="text-xs text-gray-400 mt-1">Isi ulang hanya jika ingin mengganti. Biarkan kosong untuk mempertahankan nilai sebelumnya.</p>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ── WAHA Session Management ── */}
      {isWaha && (
        <Section icon="📱" title="WAHA Session Management" subtitle="Kelola session WhatsApp dan lakukan pairing via QR code.">
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Status:</span>
                <WahaStatusBadge status={wahaStatus} />
              </div>
              <div className="flex gap-2 ml-auto">
                <Button
                  onClick={handleCheckWahaStatus}
                  loading={wahaChecking}
                  variant="secondary"
                  className="text-sm"
                >
                  Refresh Status
                </Button>
                <Button
                  onClick={handleStartWahaSession}
                  loading={wahaStarting}
                  variant="secondary"
                  className="text-sm"
                >
                  Mulai Session
                </Button>
              </div>
            </div>

            {wahaStatus === 'SCAN_QR_CODE' && (
              <div className="flex flex-col items-center gap-3 py-3">
                {wahaQrLoading && <Spinner />}
                {!wahaQrLoading && wahaQr && (
                  <>
                    <img
                      src={wahaQr}
                      alt="WhatsApp QR Code"
                      className="w-48 h-48 border border-gray-200 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 text-center">
                      Buka WhatsApp di HP → Perangkat Tertaut → Tautkan Perangkat → Scan QR
                    </p>
                    <p className="text-xs text-orange-500">QR diperbarui otomatis setiap 15 detik.</p>
                  </>
                )}
                {!wahaQrLoading && !wahaQr && (
                  <p className="text-xs text-gray-400">QR tidak tersedia — pastikan WAHA Base URL benar dan sudah tersimpan.</p>
                )}
              </div>
            )}

            {wahaStatus === 'WORKING' && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
                <span>✅</span>
                <span>WhatsApp terhubung dan siap mengirim pesan.</span>
              </div>
            )}

            {wahaStatus === 'FAILED' && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">
                <span>❌</span>
                <span>Session gagal. Klik <strong>Mulai Session</strong> untuk mencoba lagi.</span>
              </div>
            )}

            <p className="text-xs text-gray-400">
              Simpan konfigurasi terlebih dahulu sebelum mengelola session. WAHA harus dapat diakses dari backend.
            </p>
          </div>
        </Section>
      )}

      {/* ── Public Link & TTL ── */}
      <Section icon="🔗" title="URL Dasar & Masa Berlaku Token" subtitle="Digunakan untuk menyusun link publik yang dikirim via WA.">
        <div className="space-y-4">
          <div>
            <Label required>Base URL Aplikasi</Label>
            <Input
              value={config.baseUrl}
              onChange={(e) => set('baseUrl', e.target.value)}
              placeholder="https://app.amazingtoys.co.id"
            />
            <p className="text-xs text-gray-400 mt-1">
              Link yang dikirim: <span className="font-mono">{config.baseUrl}/pesanan/&lt;id&gt;?token=…</span>
            </p>
          </div>
          <div>
            <Label required>Masa Berlaku Token (menit)</Label>
            <input
              type="number"
              min={15}
              max={1440}
              value={config.ttlMinutes}
              onChange={(e) => set('ttlMinutes', parseInt(e.target.value, 10) || 120)}
              className="block w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Default 120 menit (2 jam). Min 15, maks 1440 (24 jam).</p>
          </div>
        </div>
      </Section>

      {/* ── Message Template ── */}
      <Section icon="💬" title="Template Pesan" subtitle="Variabel tersedia: {boothName}, {totalAmount}, {link}, {expiryMinutes}">
        <div>
          <Label>Template pesan WA / SMS</Label>
          <textarea
            value={config.template}
            onChange={(e) => set('template', e.target.value)}
            rows={5}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            placeholder={DEFAULT_TEMPLATE}
          />
          <button
            type="button"
            onClick={() => set('template', DEFAULT_TEMPLATE)}
            className="text-xs text-blue-500 hover:underline mt-1"
          >
            Reset ke default
          </button>
        </div>
      </Section>

      {/* ── Test Send ── */}
      {config.provider !== 'disabled' && (
        <Section icon="🧪" title="Uji Coba Kirim Pesan" subtitle="Kirim pesan tes ke nomor HP tertentu menggunakan konfigurasi yang sudah tersimpan.">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>Nomor HP</Label>
              <Input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <Button
              onClick={handleTest}
              loading={testing}
              variant="secondary"
              className="shrink-0"
            >
              Kirim Tes
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Simpan konfigurasi terlebih dahulu sebelum menguji.</p>
        </Section>
      )}

      {/* ── Save ── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} variant="primary">
          Simpan Konfigurasi
        </Button>
      </div>
    </div>
  );
}
