import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTour } from '../../hooks/useTour';
import TourProgressBar from './TourProgressBar';
import TourNavigationButtons from './TourNavigationButtons';

const TOOLTIP_W = 300;
const TOOLTIP_H = 220;

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
  const base = { position: 'absolute', width: 0, height: 0, borderStyle: 'solid' };
  const SIZE = 8;
  const C = 'white';
  const styles = {
    top:    { ...base, top: -SIZE * 2 + 2, left: '50%', transform: 'translateX(-50%)', borderWidth: `0 ${SIZE}px ${SIZE * 2}px ${SIZE}px`, borderColor: `transparent transparent ${C} transparent` },
    bottom: { ...base, bottom: -SIZE * 2 + 2, left: '50%', transform: 'translateX(-50%)', borderWidth: `${SIZE * 2}px ${SIZE}px 0 ${SIZE}px`, borderColor: `${C} transparent transparent transparent` },
    left:   { ...base, left: -SIZE * 2 + 2, top: '50%', transform: 'translateY(-50%)', borderWidth: `${SIZE}px ${SIZE * 2}px ${SIZE}px 0`, borderColor: `transparent ${C} transparent transparent` },
    right:  { ...base, right: -SIZE * 2 + 2, top: '50%', transform: 'translateY(-50%)', borderWidth: `${SIZE}px 0 ${SIZE}px ${SIZE * 2}px`, borderColor: `transparent transparent transparent ${C}` },
  };
  if (!styles[dir]) return null;
  return <div style={styles[dir]} />;
}

export default function TourTooltip() {
  const { isActive, currentStep, showWelcome, skipTour, getTargetElement } = useTour();
  const [pos, setPos]         = useState({ left: -9999, top: -9999, arrow: null });
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef(null);

  const updatePos = useCallback(() => {
    if (!isActive || !currentStep) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (vw < 640) {
      setPos({ isCard: true });
      return;
    }

    const el = getTargetElement();
    if (!el || currentStep.position === 'center') {
      setPos({ left: vw / 2 - TOOLTIP_W / 2, top: vh / 2 - TOOLTIP_H / 2, arrow: null });
      return;
    }

    const rect = el.getBoundingClientRect();
    setPos(calcPosition(rect, currentStep.position, vw, vh));
  }, [isActive, currentStep?.id, getTargetElement]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isActive) { setVisible(false); return; }
    setVisible(false);

    let rafId;
    function schedule() { rafId = requestAnimationFrame(updatePos); }

    const t = setTimeout(() => { updatePos(); setVisible(true); }, 60);

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

  useEffect(() => {
    if (!isActive) return;
    function handleKey(e) { if (e.key === 'Escape') skipTour(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive, skipTour]);

  useEffect(() => {
    if (isActive && visible && tooltipRef.current) tooltipRef.current.focus();
  }, [isActive, visible, currentStep?.id]);

  if (!isActive || !currentStep || showWelcome) return null;

  const isCard = !!pos.isCard;

  // ── Shared inner content ────────────────────────────────────────────────────
  const inner = (
    <>
      {/* Blue accent strip */}
      <div style={{
        height: 4,
        background: 'linear-gradient(90deg, #3B5BDB 0%, #748FFC 100%)',
        borderRadius: isCard ? '20px 20px 0 0' : '16px 16px 0 0',
        flexShrink: 0,
      }} />

      <div style={{ padding: isCard ? '14px 16px 20px' : '14px 14px 16px', position: 'relative' }}>
        {/* Drag handle — mobile only */}
        {isCard && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E7EB' }} />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={skipTour}
          aria-label="Tutup tur"
          style={{
            position: 'absolute', top: isCard ? 10 : 10, right: 12,
            width: 28, height: 28,
            background: '#F3F4F6',
            border: 'none', borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#9CA3AF',
            lineHeight: 1,
            transition: 'background 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#E5E7EB'}
          onMouseLeave={e => e.currentTarget.style.background = '#F3F4F6'}
        >
          ✕
        </button>

        <TourProgressBar />

        <h3 style={{
          fontWeight: 700,
          fontSize: isCard ? 15 : 14,
          color: '#111827',
          margin: '0 0 6px',
          paddingRight: 32,
          lineHeight: 1.4,
        }}>
          {currentStep.title}
        </h3>

        <p style={{
          fontSize: 13,
          color: '#6B7280',
          lineHeight: 1.65,
          margin: 0,
        }}>
          {currentStep.description}
        </p>

        <TourNavigationButtons isCard={isCard} />
      </div>
    </>
  );

  // ── Mobile floating card ────────────────────────────────────────────────────
  if (isCard) {
    return createPortal(
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Tur: ${currentStep.title}`}
        tabIndex={-1}
        style={{
          position: 'fixed',
          bottom: 72,
          left: 12,
          right: 12,
          zIndex: 50,
          borderRadius: 20,
          background: 'white',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 12px rgba(59,91,219,0.10)',
          border: '1px solid rgba(229,231,235,0.8)',
          overflow: 'hidden',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 250ms ease-out, transform 300ms cubic-bezier(0.34,1.56,0.64,1)',
          outline: 'none',
        }}
      >
        {inner}
      </div>,
      document.body,
    );
  }

  // ── Desktop positioned tooltip ──────────────────────────────────────────────
  return createPortal(
    <div
      ref={tooltipRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Tur: ${currentStep.title}`}
      tabIndex={-1}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        width: TOOLTIP_W,
        zIndex: 50,
        borderRadius: 16,
        background: 'white',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 200ms ease-out, transform 200ms ease-out',
        outline: 'none',
      }}
    >
      {!pos.arrow ? null : <Arrow dir={pos.arrow} />}
      {inner}
    </div>,
    document.body,
  );
}
