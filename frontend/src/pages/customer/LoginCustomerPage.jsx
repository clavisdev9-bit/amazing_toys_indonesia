import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { loginCustomer, verifyCustomerOtp } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAppLogo, usePublicConfig } from '../../hooks/useAppLogo';
import { useLang } from '../../context/LangContext';

export default function LoginCustomerPage() {
  const { login, isAuthenticated, role } = useAuth();
  const navigate     = useNavigate();
  const logoUrl      = useAppLogo();
  const { t }        = useLang();
  const publicConfig = usePublicConfig();
  const eventName    = publicConfig?.event_name || t('login.subtitle');

  const [mode,    setMode]    = useState('email'); // 'email' | 'phone'
  const [value,   setValue]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // OTP step state
  const [otpStep,          setOtpStep]          = useState(false);
  const [tempToken,        setTempToken]        = useState('');
  const [maskedIdentifier, setMaskedIdentifier] = useState('');
  const [identifierType,   setIdentifierType]   = useState('email');
  const [otpCode,          setOtpCode]          = useState('');
  const [otpLoading,       setOtpLoading]       = useState(false);

  if (isAuthenticated && role === 'CUSTOMER') {
    return <Navigate to="/katalog" replace />;
  }

  function handleModeSwitch(newMode) {
    setMode(newMode);
    setValue('');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = value.trim();
    if (!trimmed) { setError('Wajib diisi.'); return; }

    if (mode === 'phone') {
      const phoneRegex = /^(08|\+628)\d{8,11}$/;
      if (!phoneRegex.test(trimmed.replace(/\s/g, ''))) {
        setError('Format nomor HP tidak valid. Contoh: 081234567890');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = mode === 'email'
        ? { email: trimmed }
        : { phone_number: trimmed };

      const res  = await loginCustomer(payload);
      const data = res.data.data;

      if (data.requiresOtp) {
        setTempToken(data.tempToken);
        setMaskedIdentifier(data.maskedEmail || data.maskedPhone || '');
        setIdentifierType(data.identifierType || 'email');
        setOtpStep(true);
      } else {
        const { token, customer } = data;
        login(token, {
          role:       'CUSTOMER',
          name:       customer.full_name,
          phone:      customer.phone_number || null,
          email:      customer.email        || null,
          customerId: customer.customer_id,
        });
        navigate('/katalog');
      }
    } catch (err) {
      setError(err.response?.data?.message ?? t('login.error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    setError('');
    if (!otpCode.trim()) { setError('Kode OTP wajib diisi.'); return; }
    setOtpLoading(true);
    try {
      const res = await verifyCustomerOtp({ tempToken, otpCode: otpCode.trim() });
      const { token, customer } = res.data.data;
      login(token, {
        role:       'CUSTOMER',
        name:       customer.full_name,
        phone:      customer.phone_number || null,
        email:      customer.email        || null,
        customerId: customer.customer_id,
      });
      navigate('/katalog');
    } catch (err) {
      setError(err.response?.data?.message ?? 'Verifikasi OTP gagal. Silakan coba lagi.');
    } finally {
      setOtpLoading(false);
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

        {otpStep ? (
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-3">
            <p className="text-sm text-gray-600 text-center">
              {identifierType === 'phone' ? (
                <>Kode OTP telah dikirim ke WhatsApp <strong>{maskedIdentifier}</strong>. Periksa pesan WhatsApp Anda.</>
              ) : (
                <>Kode OTP telah dikirim ke <strong>{maskedIdentifier}</strong>. Periksa kotak masuk email Anda.</>
              )}
            </p>
            {identifierType === 'email' && (
              <p className="text-xs text-gray-400 text-center">
                Jika Anda mendaftarkan nomor HP, OTP juga dikirim via WhatsApp.
              </p>
            )}
            <Input
              label="Kode OTP"
              type="text"
              inputMode="numeric"
              placeholder="Masukkan 6 digit kode OTP"
              value={otpCode}
              onChange={(e) => { setOtpCode(e.target.value); if (error) setError(''); }}
              required
            />
            <Button type="submit" size="full" loading={otpLoading} disabled={otpLoading} className="mt-2">
              Verifikasi OTP
            </Button>
            <button
              type="button"
              onClick={() => { setOtpStep(false); setOtpCode(''); setError(''); }}
              className="text-sm text-blue-600 text-center hover:underline"
            >
              ← Kembali ke halaman login
            </button>
          </form>
        ) : (
          <>
            {/* Mode tab switcher */}
            <div className="flex rounded-xl border border-gray-200 mb-4 overflow-hidden">
              <button
                type="button"
                onClick={() => handleModeSwitch('email')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === 'email'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('phone')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === 'phone'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                No. HP (WhatsApp)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {mode === 'email' ? (
                <Input
                  label={t('login.email')}
                  type="email"
                  value={value}
                  onChange={(e) => { setValue(e.target.value); if (error) setError(''); }}
                  required
                />
              ) : (
                <Input
                  label="Nomor HP (WhatsApp)"
                  type="tel"
                  placeholder="081234567890"
                  value={value}
                  onChange={(e) => { setValue(e.target.value); if (error) setError(''); }}
                  required
                />
              )}
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
          </>
        )}
      </div>
    </div>
  );
}
