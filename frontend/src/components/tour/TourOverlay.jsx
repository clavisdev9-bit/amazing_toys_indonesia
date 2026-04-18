import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from '../../hooks/useTour';

function computeClipPath(rect, padding = 8) {
  const p = padding;
  const x1 = Math.max(0, rect.left - p);
  const y1 = Math.max(0, rect.top - p);
  const x2 = Math.min(window.innerWidth, rect.right + p);
  const y2 = Math.min(window.innerHeight, rect.bottom + p);
  const W = window.innerWidth;
  const H = window.innerHeight;

  // Polygon with a rectangular hole at (x1,y1)→(x2,y2)
  return `polygon(
    0px 0px, 0px ${H}px,
    ${x1}px ${H}px, ${x1}px ${y1}px,
    ${x2}px ${y1}px, ${x2}px ${y2}px,
    ${x1}px ${y2}px, ${x1}px ${H}px,
    ${W}px ${H}px, ${W}px 0px
  )`;
}

export default function TourOverlay() {
  const { isActive, currentStep, getTargetElement } = useTour();
  const [clipPath, setClipPath] = useState(null);

  const updateClip = useCallback(() => {
    if (!isActive) return;
    const el = getTargetElement();
    if (!el) { setClipPath(null); return; }
    const rect = el.getBoundingClientRect();
    setClipPath(computeClipPath(rect, currentStep?.spotlightPadding ?? 8));
  }, [isActive, currentStep?.id, getTargetElement]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isActive) { setClipPath(null); return; }

    let rafId;
    function schedule() { rafId = requestAnimationFrame(updateClip); }

    updateClip();

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
  }, [isActive, currentStep?.id, updateClip]);

  if (!isActive) return null;

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 40,
    background: 'rgba(0,0,0,0.55)',
    pointerEvents: 'none',
    transition: 'clip-path 300ms ease',
    ...(clipPath ? { clipPath } : {}),
  };

  return createPortal(<div style={overlayStyle} />, document.body);
}
