import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginCustomer } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAppLogo } from '../../hooks/useAppLogo';
import { useLang } from '../../context/LangContext';

export default function LoginCustomerPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const logoUrl = useAppLogo();
  const { t } = useLang();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginCustomer(phone);
      const { token, customer } = res.data.data;
      login(token, { role: 'CUSTOMER', name: customer.full_name, phone: customer.phone_number, customerId: customer.customer_id });
      navigate('/katalog');
    } catch (err) {
      const msg = err.response?.data?.message ?? t('login.error');
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
          <h1 className="text-xl font-bold text-gray-900">{t('login.title')}</h1>
          <p className="text-sm text-gray-500">{t('login.subtitle')}</p>
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
