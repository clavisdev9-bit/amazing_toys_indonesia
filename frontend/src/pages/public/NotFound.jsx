import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
      <div className="text-6xl mb-4">🔍</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Halaman Tidak Ditemukan</h1>
      <p className="text-gray-500 mb-6">URL yang kamu akses tidak tersedia.</p>
      <Button onClick={() => navigate('/')}>Kembali ke Beranda</Button>
    </div>
  );
}
