import React, { useState, useRef, useEffect } from 'react';
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

  if (mode === 'phone') {
    if (!form.phone_number.trim())
      errors.phone_number = t('register.errPhone');
    else if (!/^\+?\d{7,15}$/.test(form.phone_number.replace(/\s/g, '')))
      errors.phone_number = t('register.errPhoneFormat');
    // email opsional di mode phone, validasi format saja jika diisi
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = t('register.errEmail');
  } else {
    if (!form.email.trim())
      errors.email = t('register.errEmailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = t('register.errEmail');
    // phone opsional di mode email, validasi format saja jika diisi
    if (form.phone_number.trim() && !/^\+?\d{7,15}$/.test(form.phone_number.replace(/\s/g, '')))
      errors.phone_number = t('register.errPhoneFormat');
  }

  return errors;
}

// ── Step 1: Formulir pendaftaran ──────────────────────────────────────────────

function FormStep({ onOtpSent, logoUrl, eventName, t }) {
  const [mode,        setMode]        = useState('phone'); // 'phone' | 'email'
  const [form,        setForm]        = useState(INITIAL_FORM);
  const [errors,      setErrors]      = useState({});
  const [serverError, setServerError] = useState('');
  const [loading,     setLoading]     = useState(false);

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
      const payload = {
        full_name: form.full_name.trim(),
        gender:    form.gender,
        ...(form.birth_date && { birth_date: form.birth_date }),
        ...(mode === 'phone'
          ? {
              phone_number: form.phone_number.trim(),
              ...(form.email.trim() && { email: form.email.trim() }),
            }
          : {
              email: form.email.trim(),
              ...(form.phone_number.trim() && { phone_number: form.phone_number.trim() }),
            }
        ),
      };
      const res  = await register(payload);
      const data = res.data.data;
      onOtpSent({
        tempToken:        data.tempToken,
        maskedIdentifier: data.maskedIdentifier || data.maskedPhone,
        identifierType:   data.identifierType   || 'phone',
      });
    } catch (err) {
      setServerError(err.response?.data?.message ?? t('register.error'));
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
          <h1 className="text-xl font-bold text-gray-900">{t('register.title')}</h1>
          <p className="text-sm text-gray-500">{eventName}</p>
        </div>

        {/* Toggle mode */}
        <div className="flex rounded-xl border border-gray-200 mb-4 overflow-hidden">
          <button
            type="button"
            onClick={() => handleModeSwitch('phone')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'phone'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {t('register.tabPhone') || 'Nomor HP'}
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('email')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'email'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {t('register.tabEmail') || 'Email'}
          </button>
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
            {serverError}
          </div>
        )}

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

          {mode === 'phone' ? (
            <>
              <Input
                label={t('register.phone')}
                name="phone_number"
                type="tel"
                placeholder={t('register.phonePh') || '+62 / +65 / +60 ...'}
                value={form.phone_number}
                onChange={handleChange}
                error={errors.phone_number}
                required
              />
              <Input
                label={`${t('register.email')} (${t('register.optional') || 'opsional'})`}
                name="email"
                type="email"
                placeholder={t('register.emailPh')}
                value={form.email}
                onChange={handleChange}
                error={errors.email}
              />
            </>
          ) : (
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
                label={`${t('register.phone')} (${t('register.optional') || 'opsional'})`}
                name="phone_number"
                type="tel"
                placeholder={t('register.phonePh') || '+62 / +65 / +60 ...'}
                value={form.phone_number}
                onChange={handleChange}
                error={errors.phone_number}
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
              <option value="PREFER_NOT_TO_SAY">{t('register.other')}</option>
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
      </div>
    </div>
  );
}

// ── Step 2: Verifikasi OTP WA ─────────────────────────────────────────────────

function OtpStep({ tempToken, maskedIdentifier, identifierType, onSuccess, onBack, logoUrl, t }) {
  const [otp,      setOtp]      = useState(['', '', '', '', '', '']);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRefs               = useRef([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

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
      const res = await verifyRegisterOtp({ tempToken, otpCode });
      const { token, customer } = res.data.data;
      onSuccess(token, customer);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Verifikasi gagal. Periksa kode OTP.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setCooldown(60);
    onBack();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">

        {/* Header */}
        <div className="text-center mb-6">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-2" />
            : <div className="text-4xl mb-2">📱</div>
          }
          <h1 className="text-xl font-bold text-gray-900">{t('register.otpTitle')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {identifierType === 'email'
              ? 'Kode dikirim ke email'
              : t('register.otpSubtitle')
            }<br />
            <span className="font-semibold text-gray-700">{maskedIdentifier}</span>
          </p>
        </div>

        {/* Info card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
          <span className="text-blue-500 text-lg leading-none mt-0.5">🔐</span>
          <p className="text-xs text-blue-700">
            {identifierType === 'email'
              ? 'Masukkan kode OTP dari email untuk mengaktifkan akun Anda.'
              : 'Masukkan kode OTP dari WhatsApp untuk mengaktifkan akun Anda.'
            }{' '}
            Kode berlaku selama 5 menit.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* OTP input boxes */}
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
            {t('register.otpVerify')}
          </Button>
        </form>

        {/* Footer actions */}
        <div className="mt-5 pt-4 border-t flex justify-between items-center text-xs">
          <button
            type="button"
            onClick={onBack}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            {t('register.otpBack')}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className={`font-medium transition-colors ${
              cooldown > 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-blue-600 hover:text-blue-800'
            }`}
          >
            {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : t('register.otpResend')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const { login, isAuthenticated, role } = useAuth();
  const navigate     = useNavigate();
  const logoUrl      = useAppLogo();
  const { t }        = useLang();
  const publicConfig = usePublicConfig();
  const eventName    = publicConfig?.event_name || t('register.subtitle');

  const [otpState, setOtpState] = useState(null);

  if (isAuthenticated && role === 'CUSTOMER') {
    return <Navigate to="/katalog" replace />;
  }

  function handleOtpSent({ tempToken, maskedIdentifier, identifierType }) {
    setOtpState({ tempToken, maskedIdentifier, identifierType });
  }

  function handleSuccess(token, customer) {
    login(token, {
      role:       'CUSTOMER',
      name:       customer.full_name,
      phone:      customer.phone_number || null,
      email:      customer.email        || null,
      customerId: customer.customer_id,
    });
    navigate('/katalog');
  }

  if (otpState) {
    return (
      <OtpStep
        {...otpState}
        onSuccess={handleSuccess}
        onBack={() => setOtpState(null)}
        logoUrl={logoUrl}
        t={t}
      />
    );
  }

  return (
    <FormStep
      onOtpSent={handleOtpSent}
      logoUrl={logoUrl}
      eventName={eventName}
      t={t}
    />
  );
}
