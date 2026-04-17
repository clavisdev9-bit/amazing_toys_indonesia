import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAppLogo } from '../../hooks/useAppLogo';
import { useLang, SUPPORTED_LANGS } from '../../context/LangContext';
import MapModal from '../ui/MapModal';

function MapPinIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>
    </svg>
  );
}

function SideNavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
        ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
      }
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function StaffShell({ navItems = [], title = '' }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const logoUrl = useAppLogo();
  const { lang, setLang } = useLang();

  function handleLogout() {
    logout();
    navigate('/staff/masuk');
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-56 bg-white border-r flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
              : <span className="text-2xl">🧸</span>
            }
            <div>
              <div className="font-bold text-blue-700 text-sm">Amazing Toys</div>
              <div className="text-xs text-gray-500">{title}</div>
            </div>
          </div>

          {/* Map + Language switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMapOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-300 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors text-xs font-medium"
            >
              <MapPinIcon />
              <span>Map</span>
            </button>

            <div className="w-px h-5 bg-gray-200" />

            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              {SUPPORTED_LANGS.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={`px-2 py-1 text-xs font-medium transition-colors
                    ${lang === code ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}
                    ${code !== SUPPORTED_LANGS[0].code ? 'border-l border-gray-300' : ''}
                  `}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => (
            <SideNavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="p-4 border-t">
          <div className="text-sm text-gray-600 mb-2">
            <div className="font-medium">{user?.name || user?.username}</div>
            <div className="text-xs text-gray-400">{role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-red-500 hover:text-red-600 font-medium"
          >
            Keluar
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden bg-white border-b px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-gray-800 flex-1">{title}</span>

          {/* Map button */}
          <button
            onClick={() => setMapOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-full border border-gray-300 text-red-500 hover:bg-red-50 transition-colors text-xs font-medium shrink-0"
          >
            <MapPinIcon />
          </button>

          <div className="w-px h-5 bg-gray-200 shrink-0" />

          {/* Language buttons */}
          <div className="flex rounded-md border border-gray-300 overflow-hidden shrink-0">
            {SUPPORTED_LANGS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`px-2 py-1 text-xs font-medium transition-colors
                  ${lang === code ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}
                  ${code !== SUPPORTED_LANGS[0].code ? 'border-l border-gray-300' : ''}
                `}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Map modal */}
      {mapOpen && <MapModal onClose={() => setMapOpen(false)} />}
    </div>
  );
}
