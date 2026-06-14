import React from 'react';
import { useTour } from '../../hooks/useTour';
import { usePublicConfig } from '../../hooks/useAppLogo';

// Rendered directly in the React tree (no createPortal).
// Portals rendered to document.body with backdrop-filter applied to the container
// cause iOS Safari / some mobile Chrome builds to silently swallow touch events —
// the compositor layer created by backdrop-filter intercepts the event before it
// reaches the buttons. Rendering inside #root with position:fixed + z-[9999]
// achieves the same visual result without any compositor-layer conflict.
export default function TourWelcomeModal() {
  const { showWelcome, startTour, skipTour } = useTour();
  const config    = usePublicConfig();
  const eventName = config?.event_name || 'SOS';

  if (!showWelcome) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Selamat datang di SOS"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-5"
      style={{ background: 'rgba(15,23,42,0.60)' }}
    >
      <div
        className="w-full max-w-sm text-center overflow-hidden"
        style={{
          background: 'white',
          borderRadius: 24,
          boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
        }}
      >
        {/* Gradient header */}
        <div style={{
          background: 'linear-gradient(135deg, #3B5BDB 0%, #748FFC 100%)',
          padding: '28px 24px 24px',
        }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: 20,
              background: 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, margin: '0 auto 12px',
              border: '1.5px solid rgba(255,255,255,0.35)',
            }}
          >
            🎪
          </div>
          <h2 style={{
            fontSize: 20, fontWeight: 800, color: 'white',
            margin: '0 0 6px', lineHeight: 1.3,
          }}>
            Selamat Datang di SOS!
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.80)', margin: 0, lineHeight: 1.5 }}>
            {eventName}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px' }}>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 4px', lineHeight: 1.6 }}>
            Mau tur singkat untuk belajar cara memesan produk di sini?
          </p>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 20px' }}>
            Hanya ~1 menit
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={startTour}
              style={{
                width: '100%', padding: '13px 16px',
                background: 'linear-gradient(135deg, #3B5BDB, #748FFC)',
                border: 'none', borderRadius: 14,
                fontSize: 14, fontWeight: 700, color: 'white',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59,91,219,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'opacity 150ms',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Mulai Tur 🚀
            </button>
            <button
              type="button"
              onClick={skipTour}
              style={{
                width: '100%', padding: '10px 16px',
                background: 'transparent', border: 'none',
                fontSize: 13, color: '#9CA3AF',
                cursor: 'pointer', borderRadius: 10,
                transition: 'color 150ms',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#374151'}
              onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
            >
              Lewati dulu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
