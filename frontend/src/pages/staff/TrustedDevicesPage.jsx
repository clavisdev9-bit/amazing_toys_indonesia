import React, { useState, useEffect, useCallback } from 'react';
import { getDevices, revokeDevice } from '../../api/auth';

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

export default function TrustedDevicesPage() {
  const [devices, setDevices]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [revoking, setRevoking] = useState(null);

  const currentDeviceId = localStorage.getItem('sos_device_id');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getDevices();
      setDevices(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat daftar perangkat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRevoke(deviceId) {
    if (!window.confirm('Cabut akses perangkat ini? Anda perlu verifikasi OTP ulang saat login dari perangkat tersebut.')) return;
    setRevoking(deviceId);
    try {
      await revokeDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mencabut perangkat.');
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Perangkat Terpercaya</h1>
        <p className="text-sm text-gray-500 mt-1">
          Perangkat yang diizinkan login tanpa OTP selama 30 hari.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 flex items-start gap-2">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-8">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Memuat perangkat...
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-10 text-center text-gray-400 text-sm">
          Belum ada perangkat terpercaya.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {devices.map((d) => {
            const isCurrent = d.device_id === currentDeviceId;
            const expired   = new Date(d.expires_at) < new Date();
            return (
              <div
                key={d.device_id}
                className={`rounded-xl border px-4 py-4 flex items-start gap-4 ${
                  isCurrent ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
                } ${expired ? 'opacity-60' : ''}`}
              >
                <div className="text-2xl mt-0.5">🖥️</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-800 truncate">
                      {d.device_name || 'Perangkat Tidak Diketahui'}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">
                        Perangkat ini
                      </span>
                    )}
                    {expired && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-500 rounded-full">
                        Kedaluwarsa
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    <div>{d.browser || '-'} &middot; {d.ip_address || 'IP tidak tersedia'}</div>
                    <div>Login terakhir: {formatDate(d.last_login)}</div>
                    <div>Kedaluwarsa: {formatDate(d.expires_at)}</div>
                  </div>
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => handleRevoke(d.device_id)}
                    disabled={revoking === d.device_id}
                    className="shrink-0 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                  >
                    {revoking === d.device_id ? 'Mencabut...' : 'Cabut'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 text-xs text-gray-400">
        Mencabut perangkat akan membutuhkan verifikasi OTP saat login berikutnya dari perangkat tersebut.
      </div>
    </div>
  );
}
