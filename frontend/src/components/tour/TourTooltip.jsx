import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from '../../hooks/useTour';
import TourProgressBar from './TourProgressBar';
import TourNavigationButtons from './TourNavigationButtons';

const TOOLTIP_W = 300;
const TOOLTIP_H = 220; // approximate; used for initial placement

function calcPosition(targetRect, position, vw, vh) {
  if (!targetRect || position === 'center') {
    return { left: vw / 2 - TOOLTIP_W / 2, top: vh / 2 - TOOLTIP_H / 2, arrow: null };
  }

  const MARGIN = 14;
  const { top, left, right, bottom, width, height } = targetRect;
  let x, y, arrow, resolved = position;

  switch (position) {
    case 'bottom':
      x = left + width / 2 - TOOLTIP_W / 2;
      y = bottom + MARGIN;
      if (y + TOOLTIP_H > vh - 16) { y = top - TOOLTIP_H - MARGIN; resolved = 'top'; }
      arrow = resolved === 'bottom' ? 'top' : 'bottom';
      break;
    case 'top':
      x = left + width / 2 - TOOLTIP_W / 2;
      y = top - TOOLTIP_H - MARGIN;
      if (y < 16) { y = bottom + MARGIN; resolved = 'bottom'; }
      arrow = resolved === 'top' ? 'bottom' : 'top';
      break;
    case 'right':
      x = right + MARGIN;
      y = top + height / 2 - TOOLTIP_H / 2;
      if (x + TOOLTIP_W > vw - 16) { x = left - TOOLTIP_W - MARGIN; resolved = 'left'; }
      arrow = resolved === 'right' ? 'left' : 'right';
      break;
    case 'left':
      x = left - TOOLTIP_W - MARGIN;
      y = top + height / 2 - TOOLTIP_H / 2;
      if (x < 16) { x = right + MARGIN; resolved = 'right'; }
      arrow = resolved === 'left' ? 'right' : 'left';
      break;
    default:
      x = vw / 2 - TOOLTIP_W / 2;
      y = vh / 2 - TOOLTIP_H / 2;
      arrow = null;
  }

  x = Math.max(8, Math.min(x, vw - TOOLTIP_W - 8));
  y = Math.max(8, Math.min(y, vh - TOOLTIP_H - 8));

  return { left: x, top: y, arrow };
}

function Arrow({ dir }) {
  const base = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  };
  const SIZE = 8;
  const COLOR = 'white';
  const styles = {
    top:    { ...base, top: -SIZE * 2 + 2, left: '50%', transform: 'translateX(-50%)', borderWidth: `0 ${SIZE}px ${SIZE * 2}px ${SIZE}px`, borderColor: `transparent transparent ${COLOR} transparent` },
    bottom: { ...base, bottom: -SIZE * 2 + 2, left: '50%', transform: 'translateX(-50%)', borderWidth: `${SIZE * 2}px ${SIZE}px 0 ${SIZE}px`, borderColor: `${COLOR} transparent transparent transparent` },
    left:   { ...base, left: -SIZE * 2 + 2, top: '50%', transform: 'translateY(-50%)', borderWidth: `${SIZE}px ${SIZE * 2}px ${SIZE}px 0`, borderColor: `transparent ${COLOR} transparent transparent` },
    right:  { ...base, right: -SIZE * 2 + 2, top: '50%', transform: 'translateY(-50%)', borderWidth: `${SIZE}px 0 ${SIZE}px ${SIZE * 2}px`, borderColor: `transparent transparent transparent ${COLOR}` },
  };
  if (!styles[dir]) return null;
  return <div style={styles[dir]} />;
}

export default function TourTooltip() {
  const { isActive, currentStep, showWelcome, skipTour, getTargetElement } = useTour();
  const [pos, setPos] = useState({ left: -9999, top: -9999, arrow: null });
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  const updatePos = useCallback(() => {
    if (!isActive || !currentStep) return;
    const el = getTargetElement();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMob = vw < 640;

    if (isMob) {
      // Bottom sheet on mobile
      setPos({ left: 0, top: 'auto', bottom: 0, arrow: null, isBottomSheet: true });
      return;
    }

    if (!el || currentStep.position === 'center') {
      setPos({ left: vw / 2 - TOOLTIP_W / 2, top: vh / 2 - TOOLTIP_H / 2, arrow: null });
      return;
    }

    const rect = el.getBoundingClientRect();
    const p = calcPosition(rect, currentStep.position, vw, vh);
    setPos(p);
  }, [isActive, currentStep?.id, getTargetElement]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isActive) { setVisible(false); return; }
    setVisible(false);

    let rafId;
    function schedule() { rafId = requestAnimationFrame(updatePos); }

    // Small delay for animation
    const t = setTimeout(() => {
      updatePos();
      setVisible(true);
    }, 60);

    const ro = new ResizeObserver(schedule);
    ro.observe(document.documentElement);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      clearTimeout(t);
      ro.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(rafId);
    };
  }, [isActive, currentStep?.id, updatePos]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;
    function handleKey(e) {
      if (e.key === 'Escape') skipTour();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive, skipTour]);

  // Focus trap
  useEffect(() => {
    if (isActive && visible && tooltipRef.current) {
      tooltipRef.current.focus();
    }
  }, [isActive, visible, currentStep?.id]);

  // Guard: never render while welcome modal is open — prevents overlap (BUG-TOUR-001)
  if (!isActive || !currentStep || showWelcome) return null;

  const isBottomSheet = pos.isBottomSheet;

  const tooltipStyle = isBottomSheet
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderRadius: '16px 16px 0 0',
        padding: '20px 20px 32px',
        background: 'white',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        maxHeight: '55vh',
        overflowY: 'auto',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 200ms ease-out, transform 200ms ease-out',
      }
    : {
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        width: TOOLTIP_W,
        zIndex: 50,
        borderRadius: 12,
        padding: '16px',
        background: 'white',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 200ms ease-out, transform 200ms ease-out',
      };

  return createPortal(
    <div
      ref={tooltipRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Tour: ${currentStep.title}`}
      tabIndex={-1}
      style={tooltipStyle}
    >
      {/* Arrow pointer */}
      {!isBottomSheet && pos.arrow && <Arrow dir={pos.arrow} />}

      {/* Skip button */}
      <button
        onClick={skipTour}
        aria-label="Tutup tur"
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors text-xs"
      >
        ✕
      </button>

      <TourProgressBar />

      <h3 className="text-sm font-bold text-gray-900 mb-1.5 pr-6">{currentStep.title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{currentStep.description}</p>

      <TourNavigationButtons />
    </div>,
    document.body,
  );
}
