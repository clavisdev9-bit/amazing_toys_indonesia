import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { register, verifyRegisterOtp } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DatePickerInput from '../../components/ui/DatePickerInput';
import { useAppLogo, usePublicConfig } from '../../hooks/useAppLogo';
import { useLang } from '../../context/LangContext';

const INITIAL_FORM = {
  full_name:    '',
  phone_number: '',
  email:        '',
  gender:       'MALE',
  birth_date:   '',
};

function validateForm(form, mode, t) {
  const errors = {};
  if (!form.full_name.trim())
    errors.full_name = t('register.errName');

  if (mode === 'email') {
    if (!form.email.trim())
      errors.email = t('register.errEmailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = t('register.errEmail');

    if (form.phone_number.trim() && !/^\+?\d{7,15}$/.test(form.phone_number.replace(/\s/g, '')))
      errors.phone_number = t('register.errPhoneFormat');
  } else {
    if (!form.phone_number.trim())
      errors.phone_number = 'Nomor HP wajib diisi.';
    else if (!/^(08|\+628)\d{8,11}$/.test(form.phone_number.replace(/\s/g, '')))
      errors.phone_number = 'Format tidak valid. Contoh: 081234567890';

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = t('register.errEmail');
  }

  return errors;
}

export default function RegisterPage() {
  const { login, isAuthenticated, role } = useAuth();
  const navigate     = useNavigate();
  const logoUrl      = useAppLogo();
  const { t }        = useLang();
  const publicConfig = usePublicConfig();
  const eventName    = publicConfig?.event_name || t('register.subtitle');

  const [mode,        setMode]        = useState('email'); // 'email' | 'phone'
  const [form,        setForm]        = useState(INITIAL_FORM);
  const [errors,      setErrors]      = useState({});
  const [serverError, setServerError] = useState('');
  const [loading,     setLoading]     = useState(false);

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
    setForm(INITIAL_FORM);
    setErrors({});
    setServerError('');
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (serverError) setServerError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    const validationErrors = validateForm(form, mode, t);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    try {
      const base = {
        full_name:  form.full_name.trim(),
        gender:     form.gender,
        ...(form.birth_date && { birth_date: form.birth_date }),
      };

      const payload = mode === 'email'
        ? {
            ...base,
            email: form.email.trim(),
            ...(form.phone_number.trim() && { phone_number: form.phone_number.trim() }),
          }
        : {
            ...base,
            phone_number: form.phone_number.trim(),
            ...(form.email.trim() && { email: form.email.trim() }),
          };

      const res  = await register(payload);
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
      setServerError(err.response?.data?.message ?? t('register.error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    setServerError('');
    if (!otpCode.trim()) { setServerError('Kode OTP wajib diisi.'); return; }
    setOtpLoading(true);
    try {
      const res = await verifyRegisterOtp({ tempToken, otpCode: otpCode.trim() });
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
      setServerError(err.response?.data?.message ?? 'Verifikasi OTP gagal. Silakan coba lagi.');
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
          <h1 className="text-xl font-bold text-gray-900">{t('register.title')}</h1>
          <p className="text-sm text-gray-500">{eventName}</p>
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
            {serverError}
          </div>
        )}

        {otpStep ? (
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-3" noValidate>
            <p className="text-sm text-gray-600 text-center">
              {identifierType === 'phone' ? (
                <>Kode OTP telah dikirim ke WhatsApp <strong>{maskedIdentifier}</strong>. Periksa pesan WhatsApp Anda.</>
              ) : (
                <>Kode OTP telah dikirim ke <strong>{maskedIdentifier}</strong>. Periksa kotak masuk email Anda.</>
              )}
            </p>
            {identifierType === 'email' && form.phone_number.trim() && (
              <p className="text-xs text-gray-400 text-center">
                OTP juga dikirim ke WhatsApp nomor yang Anda masukkan.
              </p>
            )}
            <Input
              label="Kode OTP"
              type="text"
              inputMode="numeric"
              placeholder="Masukkan 6 digit kode OTP"
              value={otpCode}
              onChange={(e) => { setOtpCode(e.target.value); if (serverError) setServerError(''); }}
              required
            />
            <Button type="submit" size="full" loading={otpLoading} disabled={otpLoading} className="mt-2">
              Verifikasi OTP
            </Button>
            <button
              type="button"
              onClick={() => { setOtpStep(false); setOtpCode(''); setServerError(''); }}
              className="text-sm text-blue-600 text-center hover:underline"
            >
              ← Kembali ke form pendaftaran
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

            <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
              <Input
                label={t('register.name')}
                name="full_name"
                placeholder={t('register.namePh')}
                value={form.full_name}
                onChange={handleChange}
                error={errors.full_name}
                required
              />

              {mode === 'email' ? (
                <>
                  <Input
                    label={t('register.email')}
                    name="email"
                    type="email"
                    placeholder={t('register.emailPh')}
                    value={form.email}
                    onChange={handleChange}
                    error={errors.email}
                    required
                  />
                  <Input
                    label={`${t('register.phone')} (opsional — untuk notifikasi WhatsApp)`}
                    name="phone_number"
                    type="tel"
                    placeholder="081234567890"
                    value={form.phone_number}
                    onChange={handleChange}
                    error={errors.phone_number}
                  />
                </>
              ) : (
                <>
                  <Input
                    label="Nomor HP (WhatsApp)"
                    name="phone_number"
                    type="tel"
                    placeholder="081234567890"
                    value={form.phone_number}
                    onChange={handleChange}
                    error={errors.phone_number}
                    required
                  />
                  <Input
                    label={`${t('register.email')} (opsional)`}
                    name="email"
                    type="email"
                    placeholder={t('register.emailPh')}
                    value={form.email}
                    onChange={handleChange}
                    error={errors.email}
                  />
                </>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">{t('register.gender')}</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MALE">{t('register.male')}</option>
                  <option value="FEMALE">{t('register.female')}</option>
                </select>
              </div>
              <DatePickerInput
                label={t('register.dob')}
                name="birth_date"
                value={form.birth_date}
                onChange={handleChange}
                hint={t('register.dobHint')}
                error={errors.birth_date}
              />
              <Button type="submit" size="full" loading={loading} disabled={loading} className="mt-2">
                {t('register.submit')}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-4">
              {t('register.hasAccount')}{' '}
              <Link to="/masuk" className="text-blue-600 font-medium">{t('register.login')}</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
