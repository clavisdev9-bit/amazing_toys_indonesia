import React from 'react';
import { useTour } from '../../hooks/useTour';

// Rendered directly in the React tree (no createPortal).
// Portals rendered to document.body with backdrop-filter applied to the container
// cause iOS Safari / some mobile Chrome builds to silently swallow touch events —
// the compositor layer created by backdrop-filter intercepts the event before it
// reaches the buttons. Rendering inside #root with position:fixed + z-[9999]
// achieves the same visual result without any compositor-layer conflict.
export default function TourWelcomeModal() {
  const { showWelcome, startTour, skipTour } = useTour();

  if (!showWelcome) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Selamat datang di SOS"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/55"
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">👋</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Selamat Datang di SOS!
        </h2>
        <p className="text-sm text-gray-500 mb-1">
          Mau tur singkat untuk belajar cara memesan makanan?
        </p>
        <p className="text-xs text-gray-400 mb-6">(Hanya ~1 menit)</p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={startTour}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            Mulai Tur 🚀
          </button>
          <button
            type="button"
            onClick={skipTour}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 active:text-gray-800 transition-colors"
          >
            Lewati dulu
          </button>
        </div>
      </div>
    </div>
  );
}
