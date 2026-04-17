import React from 'react';
import { useAppLogo } from '../../hooks/useAppLogo';

export default function MaintenancePage() {
  const logoUrl = useAppLogo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center">

      {/* Logo */}
      <div className="mb-6">
        {logoUrl
          ? <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain mx-auto opacity-90" />
          : <span className="text-6xl">🧸</span>
        }
      </div>

      {/* Wrench icon with animated pulse ring */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
        <div className="relative w-20 h-20 rounded-full bg-slate-800 border-2 border-amber-400/50 flex items-center justify-center">
          <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
          </svg>
        </div>
      </div>

      {/* Main message */}
      <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
        We'll Be Back Soon
      </h1>
      <p className="text-lg text-slate-300 mb-1">
        Kami sedang melakukan pemeliharaan sistem.
      </p>
      <p className="text-sm text-slate-400 mb-8">
        We are currently performing scheduled maintenance. Please check back shortly.
      </p>

      {/* Status card */}
      <div className="w-full max-w-sm bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-5 mb-8">
        {/* Status indicator */}
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
          </span>
          <span className="text-amber-400 text-sm font-semibold">Maintenance in progress</span>
        </div>

        <div className="space-y-2 text-left text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Database services — online</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400">⏳</span>
            <span>Application services — under maintenance</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span>Admin panel — accessible</span>
          </div>
        </div>
      </div>

      {/* Progress bar animation */}
      <div className="w-full max-w-sm mb-8">
        <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-amber-400 rounded-full animate-pulse w-3/4" />
        </div>
      </div>

      {/* Footer */}
      <p className="text-slate-500 text-xs">
        Amazing Toys Fair 2026 &bull; Sistem Manajemen Event
      </p>
    </div>
  );
}
