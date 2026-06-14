import React from 'react';
import { useTour } from '../../hooks/useTour';

export default function TourNavigationButtons({ isCard = false }) {
  const {
    currentStepIndex,
    isLastStep,
    isTransitioning,
    nextStep,
    prevStep,
    skipTour,
    finishTour,
  } = useTour();

  const isFirst = currentStepIndex === 0;

  // ── Mobile card layout (full-width row) ──────────────────────────────────────
  if (isCard) {
    return (
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          onClick={prevStep}
          disabled={isFirst || isTransitioning}
          aria-label="Langkah sebelumnya"
          style={{
            flex: '0 0 auto',
            minWidth: 80,
            height: 40,
            background: '#F3F4F6',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            color: isFirst ? '#D1D5DB' : '#6B7280',
            cursor: isFirst ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            transition: 'background 150ms',
          }}
          onMouseEnter={e => { if (!isFirst) e.currentTarget.style.background = '#E5E7EB'; }}
          onMouseLeave={e => e.currentTarget.style.background = '#F3F4F6'}
        >
          ← Kembali
        </button>

        {isLastStep ? (
          <button
            onClick={finishTour}
            aria-label="Selesai tur"
            style={{
              flex: 1,
              height: 40,
              background: 'linear-gradient(135deg, #3B5BDB, #748FFC)',
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              color: 'white',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              boxShadow: '0 4px 12px rgba(59,91,219,0.30)',
              transition: 'opacity 150ms',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Selesai ✓
          </button>
        ) : (
          <button
            onClick={nextStep}
            disabled={isTransitioning}
            aria-label="Langkah berikutnya"
            style={{
              flex: 1,
              height: 40,
              background: isTransitioning
                ? '#EEF2FF'
                : 'linear-gradient(135deg, #3B5BDB, #748FFC)',
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              color: isTransitioning ? '#748FFC' : 'white',
              cursor: isTransitioning ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: isTransitioning ? 'none' : '0 4px 12px rgba(59,91,219,0.30)',
              transition: 'background 150ms, opacity 150ms',
            }}
          >
            {isTransitioning ? (
              <>
                <svg
                  className="animate-spin"
                  style={{ width: 14, height: 14 }}
                  fill="none" viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" stroke="#748FFC" strokeWidth="4" strokeOpacity="0.25"/>
                  <path fill="#3B5BDB" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
                Memuat...
              </>
            ) : (
              <>Lanjut →</>
            )}
          </button>
        )}
      </div>
    );
  }

  // ── Desktop tooltip layout ────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 12, borderTop: '1px solid #F3F4F6', marginTop: 12,
    }}>
      <button
        onClick={prevStep}
        disabled={isFirst || isTransitioning}
        aria-label="Langkah sebelumnya"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 10px',
          background: 'transparent', border: 'none',
          fontSize: 12, fontWeight: 600,
          color: isFirst ? '#D1D5DB' : '#9CA3AF',
          cursor: isFirst ? 'not-allowed' : 'pointer',
          borderRadius: 8,
          transition: 'color 150ms, background 150ms',
        }}
        onMouseEnter={e => { if (!isFirst) { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#F9FAFB'; }}}
        onMouseLeave={e => { e.currentTarget.style.color = isFirst ? '#D1D5DB' : '#9CA3AF'; e.currentTarget.style.background = 'transparent'; }}
      >
        ← Kembali
      </button>

      {!isLastStep && (
        <button
          onClick={skipTour}
          disabled={isTransitioning}
          aria-label="Lewati tur"
          style={{
            padding: '4px 8px',
            background: 'transparent', border: 'none',
            fontSize: 11, color: '#D1D5DB',
            cursor: 'pointer', borderRadius: 6,
            transition: 'color 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#9CA3AF'}
          onMouseLeave={e => e.currentTarget.style.color = '#D1D5DB'}
        >
          Lewati
        </button>
      )}

      {isLastStep ? (
        <button
          onClick={finishTour}
          aria-label="Selesai tur"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 14px',
            background: 'linear-gradient(135deg, #3B5BDB, #748FFC)',
            border: 'none', borderRadius: 8,
            fontSize: 12, fontWeight: 700, color: 'white',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(59,91,219,0.30)',
            transition: 'opacity 150ms',
          }}
        >
          Selesai ✓
        </button>
      ) : (
        <button
          onClick={nextStep}
          disabled={isTransitioning}
          aria-label="Langkah berikutnya"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 14px',
            background: isTransitioning ? '#EEF2FF' : 'linear-gradient(135deg, #3B5BDB, #748FFC)',
            border: 'none', borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            color: isTransitioning ? '#748FFC' : 'white',
            cursor: isTransitioning ? 'not-allowed' : 'pointer',
            boxShadow: isTransitioning ? 'none' : '0 2px 8px rgba(59,91,219,0.30)',
            transition: 'background 150ms',
          }}
        >
          {isTransitioning ? (
            <>
              <svg
                className="animate-spin"
                style={{ width: 12, height: 12 }}
                fill="none" viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" stroke="#748FFC" strokeWidth="4" strokeOpacity="0.25"/>
                <path fill="#3B5BDB" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              Memuat...
            </>
          ) : (
            <>Lanjut →</>
          )}
        </button>
      )}
    </div>
  );
}
