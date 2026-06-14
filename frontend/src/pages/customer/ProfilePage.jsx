import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import client from '../../api/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

const GENDER_LABEL = {
  MALE:              'Laki-laki',
  FEMALE:            'Perempuan',
  PREFER_NOT_TO_SAY: 'Tidak disebutkan',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Data field card ───────────────────────────────────────────────────────────

function DataCard({ icon, label, value, isSensitive, onEdit }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-800 truncate">{value || '—'}</p>
          {isSensitive && value && (
            <span className="shrink-0 text-[10px] font-semibold text-blue-500 bg-blue-50 rounded-full px-2 py-0.5 border border-blue-100">
              🔒 Disensor
            </span>
          )}
        </div>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className="shrink-0 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl px-3 py-1.5 transition-colors"
        >
          Ubah
        </button>
      )}
    </div>
  );
}

// ── Edit email modal ──────────────────────────────────────────────────────────

function EditEmailModal({ currentMasked, onClose, onSaved }) {
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Format email tidak valid.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await client.patch('/customer/me/email', { email: email.trim() });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Gagal memperbarui email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
        <h3 className="text-base font-bold text-gray-900 mb-1">Perbarui Email</h3>
        <p className="text-xs text-gray-400 mb-4">
          Email saat ini: <span className="font-semibold text-gray-600">{currentMasked || '—'}</span>
        </p>

        <input
          type="email"
          placeholder="email@contoh.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          autoFocus
        />
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: loading ? '#A5B4FC' : 'linear-gradient(135deg, #3B5BDB, #748FFC)' }}
          >
            {loading ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  const [profile,       setProfile]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [showEditEmail, setShowEditEmail] = useState(false);

  async function fetchProfile() {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/customer/me');
      setProfile(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Gagal memuat profil.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchProfile(); }, []);

  function handleLogout() {
    logout();
    navigate('/masuk');
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div
        className="px-4 pt-8 pb-16 text-white text-center relative"
        style={{ background: 'linear-gradient(135deg, #3B5BDB 0%, #748FFC 100%)' }}
      >
        <div
          className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-4xl shadow-lg border-4 border-white/30"
          style={{ background: 'rgba(255,255,255,0.2)' }}
        >
          🧸
        </div>
        <h1 className="text-xl font-extrabold tracking-tight">
          {profile?.full_name ?? user?.name ?? '—'}
        </h1>
        <p className="text-sm text-white/75 mt-1">
          Pelanggan Amazing Toys Fair 2026
        </p>
      </div>

      {/* Card content — overlaps header */}
      <div className="px-4 -mt-8 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl p-5 mb-4">
          {/* Security badge */}
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-2.5 mb-5">
            <span className="text-green-500 text-base">🛡️</span>
            <p className="text-xs font-semibold text-green-700">
              Data pribadi Anda terproteksi dan disensor untuk keamanan.
            </p>
          </div>

          {loading && (
            <div className="flex flex-col gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3 text-center">
              {error}
              <button onClick={fetchProfile} className="block mt-2 text-xs text-red-500 underline mx-auto">
                Coba lagi
              </button>
            </div>
          )}

          {profile && !loading && (
            <div className="flex flex-col gap-3">
              <DataCard icon="👤" label="Nama Lengkap"  value={profile.full_name} />
              <DataCard icon="📱" label="Nomor WhatsApp" value={profile.phone_number} isSensitive />
              <DataCard
                icon="✉️"
                label="Email"
                value={profile.email ?? 'Belum diisi'}
                isSensitive={!!profile.email}
                onEdit={() => setShowEditEmail(true)}
              />
              <DataCard icon="⚧" label="Jenis Kelamin"  value={GENDER_LABEL[profile.gender] ?? profile.gender} />
              <DataCard icon="🎂" label="Tanggal Lahir"  value={formatDate(profile.birth_date)} />
              <DataCard icon="📅" label="Terdaftar Sejak" value={formatDate(profile.registered_at)} />
            </div>
          )}
        </div>

        {/* Info keamanan */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4 mb-4">
          <p className="text-xs font-bold text-blue-700 mb-1.5">Mengapa data disensor?</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            Nomor HP dan email Anda ditampilkan sebagian untuk melindungi privasi Anda.
            Data lengkap tersimpan aman dan hanya digunakan untuk keperluan notifikasi order.
          </p>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3.5 rounded-2xl text-sm font-bold text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
        >
          Keluar dari Akun
        </button>
      </div>

      {/* Edit email modal */}
      {showEditEmail && (
        <EditEmailModal
          currentMasked={profile?.email}
          onClose={() => setShowEditEmail(false)}
          onSaved={() => {
            setShowEditEmail(false);
            fetchProfile();
          }}
        />
      )}
    </div>
  );
}
