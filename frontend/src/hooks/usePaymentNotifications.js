import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';

/* Web Audio: 3-tone ascending chime G5 → B5 → E6 */
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [783.99, 987.77, 1318.51].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.start(t);
      osc.stop(t + 0.45);
    });
    setTimeout(() => ctx.close(), 1600);
  } catch (_) {}
}

// Module-level singleton — state persists across navigations (same session)
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
  playChime();
}

export function usePaymentNotifications() {
  const { subscribe } = useWebSocket();
  const [snap, setSnap] = useState(() => ({ notifs: [..._notifs], toast: _toast }));
  const toastTimer = useRef(null);

  // Sync with module-level state on mount / across re-renders
  useEffect(() => {
    _subs.add(setSnap);
    return () => _subs.delete(setSnap);
  }, []);

  // Real integration: subscribe to ORDER_PAID WebSocket event
  // Payload: { event, tenantId, transactionId, message }
  useEffect(() => {
    return subscribe('ORDER_PAID', (payload) => {
      const notif = {
        id:  Date.now(),
        txn: payload.transactionId,
        ts:  new Date(),
        read: false,
      };
      _addNotif(notif);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        _toast = null;
        _broadcast();
      }, 5000);
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

  // Dev simulator — generates a realistic TXN ID for testing
  const simulatePayment = useCallback((txn) => {
    const d    = new Date();
    const date = d.toISOString().slice(0, 10).replace(/-/g, '');
    const seq  = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
    const notif = {
      id:  Date.now(),
      txn: txn || `TXN-${date}-${seq}`,
      ts:  new Date(),
      read: false,
    };
    _addNotif(notif);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      _toast = null;
      _broadcast();
    }, 5000);
  }, []);

  return {
    notifs:          snap.notifs,
    toast:           snap.toast,
    unreadCount:     snap.notifs.filter(n => !n.read).length,
    markRead,
    markAll,
    dismissToast,
    simulatePayment,
  };
}
