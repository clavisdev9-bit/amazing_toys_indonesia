import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';

// Derive WS URL from current page host so tunnels (ngrok, etc.) work correctly
const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = typeof window !== 'undefined' ? window.location.host : 'localhost:5173';
const WS_URL = `${protocol}//${host}/ws`;
const MAX_RETRIES = 5;

// Global singleton so multiple components share one connection
let ws = null;
let listeners = new Map(); // eventName -> Set<callback>
let retryCount = 0;
let retryTimer = null;
let currentToken = null;

function connect(token) {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  currentToken = token;
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'AUTH', token }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.event === 'AUTH_OK') retryCount = 0;
      const cbs = listeners.get(data.event);
      if (cbs) cbs.forEach((cb) => cb(data));
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = () => {
    ws = null;
    if (retryCount < MAX_RETRIES && currentToken) {
      retryCount++;
      retryTimer = setTimeout(() => connect(currentToken), 3000);
    }
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function disconnect() {
  currentToken = null;
  clearTimeout(retryTimer);
  retryCount = MAX_RETRIES; // prevent auto-reconnect
  ws?.close();
  ws = null;
}

function subscribe(eventName, callback) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(callback);
  return () => {
    listeners.get(eventName)?.delete(callback);
  };
}

export function useWebSocket() {
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && token) {
      retryCount = 0;
      connect(token);
    } else {
      disconnect();
    }
    return () => {
      // don't disconnect on unmount — keep singleton alive
    };
  }, [isAuthenticated, token]);

  const subscribeMemo = useCallback(subscribe, []);
  return { subscribe: subscribeMemo };
}
