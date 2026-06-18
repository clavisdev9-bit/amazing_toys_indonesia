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

  const [value,   setValue]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // OTP step state
  const [otpStep,     setOtpStep]     = useState(false);
  const [tempToken,   setTempToken]   = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCode,     setOtpCode]     = useState('');
  const [otpLoading,  setOtpLoading]  = useState(false);

  if (isAuthenticated && role === 'CUSTOMER') {
    return <Navigate to="/katalog" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = value.trim();
    if (!trimmed) { setError('Wajib diisi.'); return; }

    setLoading(true);
    try {
      const res  = await loginCustomer({ email: trimmed });
      const data = res.data.data;

      if (data.requiresOtp) {
        setTempToken(data.tempToken);
        setMaskedEmail(data.maskedEmail);
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
              Kode OTP telah dikirim ke <strong>{maskedEmail}</strong>. Periksa kotak masuk email Anda.
            </p>
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
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              label={t('login.email') || 'Email'}
              type="email"
              placeholder={t('login.emailPh') || 'contoh@email.com'}
              value={value}
              onChange={(e) => { setValue(e.target.value); if (error) setError(''); }}
              required
            />
            <Button type="submit" size="full" loading={loading} className="mt-2">
              {t('login.submit')}
            </Button>
          </form>
        )}

        {!otpStep && (
          <>
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
