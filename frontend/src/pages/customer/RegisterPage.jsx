import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { register } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DatePickerInput from '../../components/ui/DatePickerInput';
import { useAppLogo } from '../../hooks/useAppLogo';
import { useLang } from '../../context/LangContext';

const INITIAL_FORM = {
  full_name:    '',
  phone_number: '',
  email:        '',
  gender:       'MALE',
  birth_date:   '',   // ISO string "YYYY-MM-DD" or ""
};

function validate(form, t) {
  const errors = {};

  if (!form.full_name.trim())
    errors.full_name = t('register.errName');

  if (!form.phone_number.trim())
    errors.phone_number = t('register.errPhone');
  else if (!/^(08|\+628)\d{8,11}$/.test(form.phone_number.trim()))
    errors.phone_number = t('register.errPhoneFormat');

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = t('register.errEmail');

  return errors;
}

export default function RegisterPage() {
  // All hooks must be called unconditionally before any early return.
  const { login, isAuthenticated, role } = useAuth();
  const navigate  = useNavigate();
  const logoUrl   = useAppLogo();
  const { t }     = useLang();

  const [form,        setForm]        = useState(INITIAL_FORM);
  const [errors,      setErrors]      = useState({});
  const [serverError, setServerError] = useState('');
  const [loading,     setLoading]     = useState(false);

  // Redirect authenticated customers away from register page.
  if (isAuthenticated && role === 'CUSTOMER') {
    return <Navigate to="/katalog" replace />;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // Clear the field error on change so feedback is instant.
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');

    const validationErrors = validate(form, t);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      // Send only non-empty optional fields.
      const payload = {
        full_name:    form.full_name.trim(),
        phone_number: form.phone_number.trim(),
        gender:       form.gender,
        ...(form.email.trim()  && { email:      form.email.trim() }),
        ...(form.birth_date    && { birth_date: form.birth_date }),
      };

      const res = await register(payload);
      const { token, customer } = res.data.data;
      login(token, {
        role:       'CUSTOMER',
        name:       customer.full_name,
        phone:      customer.phone_number,
        customerId: customer.customer_id,
      });
      navigate('/katalog');
    } catch (err) {
      setServerError(err.response?.data?.message ?? t('register.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">

        {/* ── Header ── */}
        <div className="text-center mb-6">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-2" />
            : <div className="text-4xl mb-2">🧸</div>
          }
          <h1 className="text-xl font-bold text-gray-900">{t('register.title')}</h1>
          <p className="text-sm text-gray-500">{t('register.subtitle')}</p>
        </div>

        {/* ── Server error banner ── */}
        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
            {serverError}
          </div>
        )}

        {/* ── Form ── */}
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

          <Input
            label={t('register.phone')}
            name="phone_number"
            type="tel"
            placeholder={t('register.phonePh')}
            value={form.phone_number}
            onChange={handleChange}
            error={errors.phone_number}
            required
          />

          <Input
            label={t('register.email')}
            name="email"
            type="email"
            placeholder={t('register.emailPh')}
            value={form.email}
            onChange={handleChange}
            error={errors.email}
          />

          {/* Gender */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{t('register.gender')}</label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="MALE">{t('register.male')}</option>
              <option value="FEMALE">{t('register.female')}</option>
              <option value="PREFER_NOT_TO_SAY">{t('register.other')}</option>
            </select>
          </div>

          {/* Date of Birth */}
          <DatePickerInput
            label={t('register.dob')}
            name="birth_date"
            value={form.birth_date}
            onChange={handleChange}
            hint={t('register.dobHint')}
            error={errors.birth_date}
          />

          <Button
            type="submit"
            size="full"
            loading={loading}
            disabled={loading}
            className="mt-2"
          >
            {t('register.submit')}
          </Button>
        </form>

        {/* ── Footer ── */}
        <p className="text-center text-sm text-gray-500 mt-4">
          {t('register.hasAccount')}{' '}
          <Link to="/masuk" className="text-blue-600 font-medium">{t('register.login')}</Link>
        </p>

      </div>
    </div>
  );
}
