import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAppLogo } from '../../hooks/useAppLogo';
import { useLang } from '../../context/LangContext';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const logoUrl = useAppLogo();
  const { t } = useLang();
  const [form, setForm] = useState({ full_name: '', phone_number: '', email: '', gender: 'MALE' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await register(form);
      const { token, customer } = res.data.data;
      login(token, { role: 'CUSTOMER', name: customer.full_name, phone: customer.phone_number, customerId: customer.customer_id });
      navigate('/katalog');
    } catch (err) {
      const msg = err.response?.data?.message ?? t('register.error');
      setError(msg);
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
          <p className="text-sm text-gray-500">{t('register.subtitle')}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            label={t('register.name')}
            name="full_name"
            placeholder={t('register.namePh')}
            value={form.full_name}
            onChange={handleChange}
            required
          />
          <Input
            label={t('register.phone')}
            name="phone_number"
            type="tel"
            placeholder={t('register.phonePh')}
            value={form.phone_number}
            onChange={handleChange}
            required
          />
          <Input
            label={t('register.email')}
            name="email"
            type="email"
            placeholder={t('register.emailPh')}
            value={form.email}
            onChange={handleChange}
          />
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

          <Button type="submit" size="full" loading={loading} className="mt-2">
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
