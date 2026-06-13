import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { verifyOtp } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { getDeviceInfo } from '../../utils/deviceFingerprint';
import Button from '../../components/ui/Button';

const roleHome = { CASHIER: '/cashier', TENANT: '/tenant', LEADER: '/leader', ADMIN: '/admin', HELPER: '/helper' };

export default function OTPVerificationPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  // Passed from LoginStaffPage via navigate state
  const { tempToken, maskedEmail } = location.state || {};

  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resent, setResent]     = useState(false);
  const inputRefs               = useRef([]);

  useEffect(() => {
    if (!tempToken) {
      navigate('/staff/masuk', { replace: true });
    } else {
      inputRefs.current[0]?.focus();
    }
  }, [tempToken, navigate]);

  function handleDigit(idx, val) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0)  inputRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) inputRefs.current[idx + 1]?.focus();
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setOtp(next);
    inputRefs.current[Math.min(text.length, 5)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length < 6) { setError('Masukkan 6 digit kode OTP.'); return; }

    setError('');
    setLoading(true);
    try {
      const device = await getDeviceInfo();
      const res = await verifyOtp({
        tempToken,
        otpCode,
        deviceId:        device.deviceId,
        fingerprintHash: device.fingerprintHash,
        deviceInfo: {
          deviceName: device.deviceName,
          browser:    device.browser,
        },
      });
      const { token, refreshToken, user } = res.data.data;
      if (refreshToken) localStorage.setItem('sos_refresh_token', refreshToken);
      login(token, {
        role:     user.role,
        name:     user.name,
        userId:   user.userId,
        username: user.username,
        tenantId: user.tenantId,
        deviceId: user.deviceId,
      });
      navigate(roleHome[user.role] ?? '/');
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Verifikasi gagal. Periksa kode OTP.';
      setError(msg);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-700 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">📨</div>
          <h1 className="text-xl font-bold text-gray-900">Verifikasi OTP</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kode 6 digit dikirim ke<br />
            <span className="font-semibold text-gray-700">{maskedEmail || '***'}</span>
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigit(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none transition-colors
                  ${digit ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                  focus:border-blue-500`}
              />
            ))}
          </div>

          <Button type="submit" size="full" loading={loading}>
            Verifikasi
          </Button>
        </form>

        {resent && (
          <p className="text-center text-xs text-green-600 mt-3">
            Kode OTP baru sudah dikirim ke email.
          </p>
        )}

        <div className="mt-4 pt-4 border-t flex justify-between text-xs text-gray-400">
          <button
            type="button"
            onClick={() => navigate('/staff/masuk')}
            className="hover:text-gray-600"
          >
            ← Kembali Login
          </button>
          <span className="text-gray-300">Berlaku 5 menit</span>
        </div>
      </div>
    </div>
  );
}
