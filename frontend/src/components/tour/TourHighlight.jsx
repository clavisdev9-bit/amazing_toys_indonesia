import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from '../../hooks/useTour';

export default function TourHighlight() {
  const { isActive, currentStep, getTargetElement } = useTour();
  const [rect, setRect] = useState(null);

  const updateRect = useCallback(() => {
    if (!isActive) return;
    const el = getTargetElement();
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    const p = currentStep?.spotlightPadding ?? 8;
    setRect({ top: r.top - p, left: r.left - p, width: r.width + p * 2, height: r.height + p * 2 });
  }, [isActive, currentStep?.id, getTargetElement]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isActive) { setRect(null); return; }

    let rafId;
    function schedule() { rafId = requestAnimationFrame(updateRect); }

    updateRect();

    const ro = new ResizeObserver(schedule);
    ro.observe(document.documentElement);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(rafId);
    };
  }, [isActive, currentStep?.id, updateRect]);

  if (!isActive || !rect) return null;

  const ringStyle = {
    position: 'fixed',
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    borderRadius: 10,
    border: '2px solid rgba(255,255,255,0.85)',
    boxShadow: '0 0 0 1px rgba(59,130,246,0.7), 0 0 16px 2px rgba(59,130,246,0.35)',
    zIndex: 42,
    pointerEvents: 'none',
    animation: 'tour-ring-pulse 2s ease-in-out infinite',
  };

  return createPortal(<div style={ringStyle} />, document.body);
}
