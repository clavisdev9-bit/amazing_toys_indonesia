import React, { useState, useEffect } from 'react';
import { getIntegration, saveIntegration } from '../../../api/admin';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Spinner from '../../../components/ui/Spinner';
import ToastContainer from '../../../components/ui/Toast';
import { useToast } from '../../../hooks/useToast';

const GATEWAYS = ['', 'midtrans', 'xendit', 'doku', 'custom'];

export default function IntegrationTab() {
  const { toasts, addToast, removeToast } = useToast();
  const [config, setConfig]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    getIntegration()
      .then((r) => setConfig(r.data.data))
      .catch(() => addToast('Gagal memuat konfigurasi integrasi.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, value) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await saveIntegration(config);
      setConfig(r.data.data);
      addToast('Konfigurasi integrasi disimpan.', 'success');
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

      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white mb-6">
        <span className="text-base">🔌</span>
        <h2 className="text-sm font-semibold flex-1">Konfigurasi Integrasi</h2>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.is_active ? 'bg-white/20 text-white' : 'bg-white/10 text-teal-200'}`}>
          {config.is_active ? '● Aktif' : '○ Nonaktif'}
        </span>
      </div>

      <form onSubmit={handleSave} className="max-w-xl space-y-6">

        {/* Status toggle */}
        <div className={`flex items-center justify-between p-4 rounded-xl border-2
          ${config.is_active ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
          <div>
            <p className="font-medium text-gray-800 text-sm">Status Integrasi</p>
            <p className={`text-xs mt-0.5 ${config.is_active ? 'text-green-600' : 'text-gray-400'}`}>
              {config.is_active ? 'Terhubung & Aktif' : 'Tidak Aktif'}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" className="sr-only"
                checked={!!config.is_active}
                onChange={(e) => set('is_active', e.target.checked)} />
              <div className={`w-10 h-6 rounded-full transition-colors ${config.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                ${config.is_active ? 'translate-x-4' : ''}`} />
            </div>
          </label>
        </div>

        {/* Payment Gateway */}
        <section>
          <h2 className="text-sm font-semibold text-teal-700 mb-3 pb-1 border-b border-teal-200">💳 Payment Gateway</h2>
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Provider</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={config.payment_gateway || ''}
                onChange={(e) => set('payment_gateway', e.target.value)}>
                <option value="">-- Pilih Provider --</option>
                {GATEWAYS.filter(Boolean).map((g) => (
                  <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                ))}
              </select>
            </div>
            <Input label="API Key / Client Key"
              type={showKey ? 'text' : 'password'}
              value={config.api_key || ''}
              onChange={(e) => set('api_key', e.target.value)}
              placeholder="Masukkan API key..." />
            <div className="relative">
              <Input label="Secret Key"
                type={showKey ? 'text' : 'password'}
                value={config.secret_key || ''}
                onChange={(e) => set('secret_key', e.target.value)}
                placeholder="Masukkan secret key..." />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} className="rounded" />
              Tampilkan API keys
            </label>
            <Input label="Webhook URL"
              value={config.webhook_url || ''}
              onChange={(e) => set('webhook_url', e.target.value)}
              placeholder="https://yourdomain.com/api/v1/payments/webhook" />
          </div>
        </section>

        {/* POS Integration */}
        <section>
          <h2 className="text-sm font-semibold text-teal-700 mb-3 pb-1 border-b border-teal-200">🖥️ Integrasi POS</h2>
          <div className="space-y-3">
            <Input label="POS Base URL"
              value={config.pos_url || ''}
              onChange={(e) => set('pos_url', e.target.value)}
              placeholder="http://pos-system.local/api" />
            <Input label="POS API Key"
              type={showKey ? 'text' : 'password'}
              value={config.pos_api_key || ''}
              onChange={(e) => set('pos_api_key', e.target.value)}
              placeholder="Masukkan POS API key..." />
          </div>
        </section>

        {/* Notes */}
        <section>
          <h2 className="text-sm font-semibold text-teal-700 mb-3 pb-1 border-b border-teal-200">📝 Catatan</h2>
          <textarea
            rows={3}
            value={config.notes || ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Catatan konfigurasi integrasi..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white px-8">
            💾 Simpan Integrasi
          </Button>
          {config.is_active && config.api_key && (
            <span className="text-xs text-green-600 font-medium">Koneksi terkonfigurasi</span>
          )}
        </div>
      </form>
    </>
  );
}
