import React from 'react';
import { useTour } from '../../hooks/useTour';

export default function TourProgressBar() {
  const { currentStepIndex, totalSteps } = useTour();
  const stepNumber = currentStepIndex + 1;
  const pct = (stepNumber / totalSteps) * 100;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-gray-400">
          Langkah {stepNumber} dari {totalSteps}
        </span>
      </div>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
