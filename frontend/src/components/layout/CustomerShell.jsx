import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useAppLogo } from '../../hooks/useAppLogo';
import { useLang, SUPPORTED_LANGS } from '../../context/LangContext';

import MapModal from '../ui/MapModal';

function NavItem({ to, icon, label, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium relative
        ${isActive ? 'text-blue-600' : 'text-gray-500'}`
      }
    >
      <span className="text-xl relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}

// ── Map pin SVG icon ──────────────────────────────────────────────────────────
function MapPinIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>
    </svg>
  );
}

export default function CustomerShell() {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const logoUrl = useAppLogo();
  const { lang, setLang, t } = useLang();
  const [mapOpen, setMapOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/masuk');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-3 py-2.5 flex items-center justify-between sticky top-0 z-30 gap-2">

        {/* Left — logo + brand */}
        <div className="flex items-center gap-2 shrink-0">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
            : <span className="text-2xl">🧸</span>
          }
          <span className="font-bold text-blue-700 hidden sm:block">Amazing Toys</span>
        </div>

        {/* Centre — Map + Language switcher */}
        <div className="flex items-center gap-2">

          {/* Map button */}
          <button
            onClick={() => setMapOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-300 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors text-xs font-medium shrink-0"
          >
            <MapPinIcon />
            <span className="hidden sm:inline">Map</span>
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 shrink-0" />

          {/* Language buttons */}
          <div className="flex rounded-md border border-gray-300 overflow-hidden shrink-0">
            {SUPPORTED_LANGS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`px-2 py-1 text-xs font-medium transition-colors
                  ${lang === code
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                  }
                  ${code !== SUPPORTED_LANGS[0].code ? 'border-l border-gray-300' : ''}
                `}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right — username + logout */}
        <div className="flex items-center gap-2 text-sm text-gray-600 shrink-0">
          <span className="hidden md:block text-xs">{user?.name || user?.phone}</span>
          <button onClick={handleLogout} className="text-red-500 hover:text-red-600 font-medium text-xs">
            Keluar
          </button>
        </div>
      </header>

      {/* Map modal */}
      {mapOpen && <MapModal onClose={() => setMapOpen(false)} />}

      {/* Content */}
      <main className="flex-1 pb-16">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around z-30">
        <NavItem to="/katalog" icon="🏪" label={t('nav.catalog')} />
        <NavItem to="/keranjang" icon="🛒" label={t('nav.cart')} badge={totalItems} />
        <NavItem to="/pesanan" icon="📦" label={t('nav.orders')} />
      </nav>
    </div>
  );
}
