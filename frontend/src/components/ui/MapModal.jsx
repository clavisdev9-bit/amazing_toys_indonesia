import React, { useEffect } from 'react';
import { useLang } from '../../context/LangContext';
import { usePublicConfig } from '../../hooks/useAppLogo';

export default function MapModal({ onClose }) {
  const { t } = useLang();
  const config = usePublicConfig();

  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const embedUrl  = config?.map_embed_url  || '';
  const imageUrl  = config?.map_image_url  || '';

  return (
    /* ── Backdrop ──────────────────────────────────────────────────────────── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      {/* ── Modal container ─────────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full"
        style={{ maxWidth: '900px', maxHeight: '85vh', height: '600px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <h2 className="font-bold text-gray-800 text-lg">{t('mapTitle')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition-colors"
            aria-label={t('mapClose')}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {embedUrl ? (
            /* Priority 1: Google Maps embed iframe */
            <iframe
              src={embedUrl}
              title={t('mapTitle')}
              className="w-full h-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : imageUrl ? (
            /* Priority 2: Uploaded map image */
            <div className="w-full h-full flex items-center justify-center bg-gray-50 p-4">
              <img
                src={imageUrl}
                alt={t('mapTitle')}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          ) : (
            /* Priority 3: Empty state */
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400 p-6">
              <span className="text-5xl">📍</span>
              <p className="text-sm text-center">{t('mapEmpty')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
