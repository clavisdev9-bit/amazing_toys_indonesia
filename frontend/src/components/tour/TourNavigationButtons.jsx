import React from 'react';
import { useTour } from '../../hooks/useTour';

export default function TourNavigationButtons() {
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

  return (
    <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
      {/* Back */}
      <button
        onClick={prevStep}
        disabled={isFirst || isTransitioning}
        aria-label="Langkah sebelumnya"
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-50 transition-colors"
      >
        ← Kembali
      </button>

      {/* Skip (hidden on last step) */}
      {!isLastStep && (
        <button
          onClick={skipTour}
          disabled={isTransitioning}
          aria-label="Lewati tur"
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors"
        >
          Lewati
        </button>
      )}

      {/* Next / Finish */}
      {isLastStep ? (
        <button
          onClick={finishTour}
          aria-label="Selesai"
          className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Selesai ✓
        </button>
      ) : (
        <button
          onClick={nextStep}
          disabled={isTransitioning}
          aria-label="Langkah berikutnya"
          className="flex items-center gap-1 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isTransitioning ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              Navigating...
            </>
          ) : (
            <>Lanjut →</>
          )}
        </button>
      )}
    </div>
  );
}
