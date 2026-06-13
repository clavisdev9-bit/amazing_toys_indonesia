import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { loginCustomer, verifyCustomerOtp } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { getDeviceInfo } from '../../utils/deviceFingerprint';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAppLogo, usePublicConfig } from '../../hooks/useAppLogo';
import { useLang } from '../../context/LangContext';

// ── Step 1: masukkan nomor telepon ────────────────────────────────────────────

function PhoneStep({ onOtpSent, onDirectLogin, logoUrl, eventName, t }) {
  const [phone,   setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const device = await getDeviceInfo();
      const res = await loginCustomer(phone.trim(), device.deviceId, {
        deviceName: device.deviceName,
        browser:    device.browser,
      });
      const data = res.data.data;

      if (data.requiresOtp) {
        onOtpSent({ tempToken: data.tempToken, maskedPhone: data.maskedPhone, deviceId: device.deviceId, device });
      } else {
        // Trusted device — langsung login
        onDirectLogin(data.token, data.customer, device.deviceId);
      }
    } catch (err) {
      setError(err.response?.data?.message ?? t('login.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="text-center mb-6">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-2" />
            : <div className="text-4xl mb-2">🧸</div>
          }
          <h1 className="text-xl font-bold text-gray-900">{t('login.title')}</h1>
          <p className="text-sm text-gray-500">{eventName}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            label={t('login.phone')}
            type="tel"
            placeholder={t('login.phonePh')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Button type="submit" size="full" loading={loading} className="mt-2">
            {t('login.submit')}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          {t('login.noAccount')}{' '}
          <Link to="/daftar" className="text-blue-600 font-medium">{t('login.register')}</Link>
        </p>

        <div className="mt-4 pt-4 border-t text-center">
          <Link to="/staff/masuk" className="text-xs text-gray-400 hover:text-gray-600">
            {t('login.staffLink')}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: masukkan kode OTP ─────────────────────────────────────────────────

function OtpStep({ tempToken, maskedPhone, deviceId, device, onSuccess, onBack, logoUrl, eventName }) {
  const [otp,     setOtp]     = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const inputRefs             = useRef([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  function handleDigit(idx, val) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowLeft'  && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) inputRefs.current[idx + 1]?.focus();
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array(6).fill('');
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
      const res = await verifyCustomerOtp({
        tempToken,
        otpCode,
        deviceId,
        deviceInfo: { deviceName: device.deviceName, browser: device.browser },
      });
      const { token, customer } = res.data.data;
      onSuccess(token, customer, deviceId);
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
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="text-center mb-6">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-2" />
            : <div className="text-4xl mb-2">📱</div>
          }
          <h1 className="text-xl font-bold text-gray-900">Verifikasi WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kode 6 digit dikirim ke WhatsApp<br />
            <span className="font-semibold text-gray-700">{maskedPhone || '****'}</span>
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

        <div className="mt-4 pt-4 border-t flex justify-between text-xs text-gray-400">
          <button type="button" onClick={onBack} className="hover:text-gray-600">
            ← Ganti Nomor
          </button>
          <span className="text-gray-300">Berlaku 5 menit</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LoginCustomerPage() {
  const { login, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const logoUrl      = useAppLogo();
  const { t }        = useLang();
  const publicConfig = usePublicConfig();
  const eventName    = publicConfig?.event_name || t('login.subtitle');

  const [otpState, setOtpState] = useState(null); // null = phone step

  if (isAuthenticated && role === 'CUSTOMER') {
    return <Navigate to="/katalog" replace />;
  }

  function handleOtpSent({ tempToken, maskedPhone, deviceId, device }) {
    setOtpState({ tempToken, maskedPhone, deviceId, device });
  }

  function handleLoginSuccess(token, customer, deviceId) {
    login(token, {
      role:       'CUSTOMER',
      name:       customer.full_name,
      phone:      customer.phone_number,
      customerId: customer.customer_id,
      deviceId,
    });
    navigate('/katalog');
  }

  if (otpState) {
    return (
      <OtpStep
        {...otpState}
        onSuccess={handleLoginSuccess}
        onBack={() => setOtpState(null)}
        logoUrl={logoUrl}
        eventName={eventName}
      />
    );
  }

  return (
    <PhoneStep
      onOtpSent={handleOtpSent}
      onDirectLogin={handleLoginSuccess}
      logoUrl={logoUrl}
      eventName={eventName}
      t={t}
    />
  );
}
