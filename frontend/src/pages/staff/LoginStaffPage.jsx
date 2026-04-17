import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginStaff } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const roleHome = { CASHIER: '/cashier', TENANT: '/tenant', LEADER: '/leader', ADMIN: '/leader' };

export default function LoginStaffPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
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
      const res = await loginStaff(form.username, form.password);
      const { token, user } = res.data.data;
      login(token, { role: user.role, name: user.name, userId: user.userId, username: user.username, tenantId: user.tenantId });
      navigate(roleHome[user.role] ?? '/');
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Login gagal. Periksa username dan password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-700 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="text-xl font-bold text-gray-900">Login Staff</h1>
          <p className="text-sm text-gray-500">Kasir · Tenant · Leader</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            label="Username"
            name="username"
            placeholder="Masukkan username"
            value={form.username}
            onChange={handleChange}
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="Masukkan password"
            value={form.password}
            onChange={handleChange}
            required
          />
          <Button type="submit" size="full" loading={loading} className="mt-2">
            Masuk
          </Button>
        </form>

        <div className="mt-4 pt-4 border-t text-center">
          <Link to="/masuk" className="text-xs text-gray-400 hover:text-gray-600">
            ← Login sebagai Pelanggan
          </Link>
        </div>
      </div>
    </div>
  );
}
