import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { usePublicConfig } from '../../hooks/useAppLogo';
import { useLang, SUPPORTED_LANGS } from '../../context/LangContext';
import { useTour } from '../../hooks/useTour';
import MapModal from '../ui/MapModal';
import QrScannerModal from '../ui/QrScannerModal';

const MESH_BG = `
  radial-gradient(ellipse 65% 55% at 15% 8%, rgba(160,190,255,0.80) 0%, transparent 68%),
  radial-gradient(ellipse 55% 50% at 88% 18%, rgba(210,170,255,0.65) 0%, transparent 65%),
  radial-gradient(ellipse 55% 50% at 8% 75%, rgba(140,215,255,0.60) 0%, transparent 65%),
  radial-gradient(ellipse 60% 55% at 82% 82%, rgba(255,180,215,0.55) 0%, transparent 68%),
  radial-gradient(ellipse 45% 40% at 50% 48%, rgba(200,215,255,0.45) 0%, transparent 60%),
  linear-gradient(155deg, #b8ccff 0%, #dcc8ff 38%, #ffc8e0 68%, #b8e8ff 100%)
`;

function NavItem({ to, label, badge, id, renderIcon }) {
  return (
    <NavLink to={to} id={id} className="flex-1 flex flex-col items-center gap-[5px] py-2 cursor-pointer">
      {({ isActive }) => (
        <>
          <div
            className="relative flex items-center justify-center w-12 h-[34px] rounded-3xl transition-all duration-200"
            style={isActive ? { background: '#EEF2FF' } : {}}
          >
            {renderIcon(isActive)}
            {badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#FF6B6B] text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-white font-extrabold px-0.5">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </div>
          <span
            className="text-[11px] font-bold tracking-[0.01em] transition-colors"
            style={{ color: isActive ? '#3B5BDB' : '#B0B8CC' }}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

function navSvg(active, children) {
  return (
    <svg
      className="w-[26px] h-[26px] transition-all duration-200"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      style={{
        stroke: active ? '#3B5BDB' : '#B0B8CC',
        transform: active ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      {children}
    </svg>
  );
}

export default function CustomerShell() {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const publicConfig = usePublicConfig();
  const logoUrl   = publicConfig?.logo_url ?? null;
  const eventName = publicConfig?.event_name ?? 'Amazing Toys Fair';
  const venue     = publicConfig?.venue ?? 'Marketplace';
  const { lang, setLang, t } = useLang();
  const { restartTour, isActive: isTourActive } = useTour();
  const [mapOpen, setMapOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/masuk');
  }

  function handleQrResult(text) {
    setScanOpen(false);
    navigate(`/product/${text}`);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: MESH_BG }}>

      {/* Fixed background blobs for depth */}
      <div style={{ position: 'fixed', top: 80, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(180,160,255,0.22)', filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '35%', left: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(130,210,255,0.18)', filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: 120, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,170,200,0.20)', filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Glass Header */}
      <header
        className="sticky top-0 z-30 h-14 px-4 flex items-center justify-between"
        style={{
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(22px) saturate(1.9)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.9)',
          borderBottom: '1px solid rgba(255,255,255,0.55)',
          boxShadow: '0 2px 16px rgba(100,130,220,0.10)',
        }}
      >
        {/* Left — logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-xl"
            style={{ background: 'linear-gradient(135deg, #3B5BDB, #748FFC)' }}
          >
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain rounded-[10px]" />
              : '🧸'
            }
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-[#3B5BDB] leading-none">{eventName}</div>
            <div className="text-[10px] text-[#868E96] font-medium">{venue}</div>
          </div>
        </div>

        {/* Centre — language switcher */}
        <div
          className="flex items-center gap-1 rounded-[20px] px-[10px] py-1"
          style={{ background: 'rgba(248,249,254,0.80)' }}
        >
          {SUPPORTED_LANGS.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className="px-2 py-[3px] rounded-xl text-xs font-semibold transition-all duration-200 border-none cursor-pointer"
              style={
                lang === code
                  ? { background: '#3B5BDB', color: '#fff' }
                  : { background: 'transparent', color: '#868E96' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right — tour + logout */}
        <div className="flex items-center gap-2 shrink-0">
          {!isTourActive && (
            <button
              onClick={restartTour}
              title="Tur Panduan"
              aria-label="Mulai ulang tur panduan"
              className="text-base text-[#ADB5BD] hover:text-[#3B5BDB] transition-colors leading-none"
            >
              🗺️
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-xs font-semibold text-[#FF6B6B] hover:text-red-600 transition-colors"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Map modal */}
      {mapOpen && <MapModal onClose={() => setMapOpen(false)} />}

      {/* QR Scanner modal (triggered from Scan nav button) */}
      {scanOpen && (
        <QrScannerModal
          title="Scan QR Produk"
          hint="Arahkan kamera ke QR code produk"
          resultParser={text => text}
          onResult={handleQrResult}
          onClose={() => setScanOpen(false)}
        />
      )}

      {/* Page content */}
      <main className="flex-1 pb-[92px]" style={{ position: 'relative', zIndex: 1 }}>
        <Outlet />
      </main>

      {/* Glass Bottom Nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around"
        style={{
          height: 82,
          background: 'rgba(255,255,255,0.60)',
          backdropFilter: 'blur(28px) saturate(2.1)',
          WebkitBackdropFilter: 'blur(28px) saturate(2.1)',
          borderTop: '1.5px solid rgba(255,255,255,0.80)',
          boxShadow: '0 -4px 24px rgba(80,100,200,0.10)',
          paddingBottom: 10,
          paddingLeft: 6,
          paddingRight: 6,
        }}
      >
        {/* Katalog */}
        <NavItem
          to="/katalog"
          label={t('nav.catalog')}
          renderIcon={a => navSvg(a,
            <>
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </>
          )}
        />

        {/* Map */}
        <button
          onClick={() => setMapOpen(true)}
          className="flex-1 flex flex-col items-center gap-[5px] py-2 border-none bg-transparent cursor-pointer"
          aria-label="Map"
        >
          <div className="flex items-center justify-center w-12 h-[34px] rounded-3xl">
            <svg className="w-[26px] h-[26px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="#B0B8CC">
              <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <span className="text-[11px] font-bold tracking-[0.01em] text-[#B0B8CC]">Map</span>
        </button>

        {/* Scan — center elevated button */}
        <div className="flex-1 relative flex flex-col items-center justify-end pb-0 h-full">
          <button
            onClick={() => setScanOpen(true)}
            aria-label="Scan QR"
            style={{
              position: 'absolute',
              top: -22,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 60,
              height: 60,
              background: 'linear-gradient(145deg, #5B7CFA, #3B5BDB)',
              borderRadius: 20,
              border: 'none',
              boxShadow: '0 6px 20px rgba(59,91,219,0.40), 0 2px 6px rgba(59,91,219,0.25), inset 0 1px 0 rgba(255,255,255,0.25)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="rgba(255,255,255,0.95)">
              <path d="M3 8V5a2 2 0 0 1 2-2h3M3 16v3a2 2 0 0 0 2 2h3M21 8V5a2 2 0 0 0-2-2h-3M21 16v3a2 2 0 0 1-2 2h-3" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          </button>
          <span className="text-[11px] font-bold text-[#3B5BDB]" style={{ marginTop: 42 }}>Scan</span>
        </div>

        {/* Keranjang */}
        <NavItem
          to="/keranjang"
          label={t('nav.cart')}
          badge={totalItems}
          id="tour-cart-nav"
          renderIcon={a => navSvg(a,
            <>
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </>
          )}
        />

        {/* Pesanan */}
        <NavItem
          to="/pesanan"
          label={t('nav.orders')}
          renderIcon={a => navSvg(a,
            <>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </>
          )}
        />
      </nav>
    </div>
  );
}
