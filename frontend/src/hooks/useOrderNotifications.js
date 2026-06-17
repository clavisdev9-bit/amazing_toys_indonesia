import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';

/* 3-tone descending chime — berbeda dari ascending di usePaymentNotifications */
function playOrderChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [1046.50, 880.00, 659.25].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.40);
    });
    setTimeout(() => ctx.close(), 1400);
  } catch (_) {}
}

// Module-level singleton — state bertahan saat navigasi dalam sesi yang sama
let _notifs = [];
let _toast  = null;
const _subs = new Set();

function _broadcast() {
  const snap = { notifs: [..._notifs], toast: _toast };
  _subs.forEach(fn => fn(snap));
}

function _addNotif(notif) {
  _notifs = [notif, ..._notifs];
  _toast  = notif;
  _broadcast();
  playOrderChime();
}

/**
 * Hook notifikasi order masuk untuk kasir.
 * Subscribe ke event ORDER_RESERVED (helper buat order baru).
 * Payload dari backend: { event, transactionId, boothId }
 */
export function useOrderNotifications() {
  const { subscribe } = useWebSocket();
  const [snap, setSnap] = useState(() => ({ notifs: [..._notifs], toast: _toast }));
  const toastTimer = useRef(null);

  useEffect(() => {
    _subs.add(setSnap);
    return () => _subs.delete(setSnap);
  }, []);

  useEffect(() => {
    return subscribe('ORDER_RESERVED', (payload) => {
      const notif = {
        id:    Date.now(),
        txn:   payload.transactionId,
        booth: payload.boothId || null,
        ts:    new Date(),
        read:  false,
      };
      _addNotif(notif);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        _toast = null;
        _broadcast();
      }, 6000);
    });
  }, [subscribe]);

  const markRead = useCallback((id) => {
    _notifs = _notifs.map(n => n.id === id ? { ...n, read: true } : n);
    _broadcast();
  }, []);

  const markAll = useCallback(() => {
    _notifs = _notifs.map(n => ({ ...n, read: true }));
    _broadcast();
  }, []);

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    _toast = null;
    _broadcast();
  }, []);

  return {
    notifs:      snap.notifs,
    toast:       snap.toast,
    unreadCount: snap.notifs.filter(n => !n.read).length,
    markRead,
    markAll,
    dismissToast,
  };
}
