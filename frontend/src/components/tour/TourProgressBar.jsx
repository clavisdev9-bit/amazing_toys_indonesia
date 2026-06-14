import React from 'react';
import { useTour } from '../../hooks/useTour';

export default function TourProgressBar() {
  const { currentStepIndex, totalSteps } = useTour();
  const stepNumber = currentStepIndex + 1;
  const pct = Math.round((stepNumber / totalSteps) * 100);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontSize: 11, fontWeight: 600, color: '#3B5BDB', letterSpacing: '0.03em' }}>
          Langkah {stepNumber}
        </span>
        <span style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF' }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 5, background: '#EEF2FF', borderRadius: 99, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #3B5BDB 0%, #748FFC 100%)',
            borderRadius: 99,
            transition: 'width 350ms cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
    </div>
  );
}
