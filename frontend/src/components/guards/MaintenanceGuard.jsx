import React, { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { getPublicConfig } from '../../api/admin';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import MaintenancePage from '../../pages/public/MaintenancePage';

const POLL_INTERVAL_MS = 5 * 60_000; // re-check every 5 minutes (WS handles instant updates)

export default function MaintenanceGuard() {
  const { role } = useAuth();
  const { subscribe } = useWebSocket();
  // null = still loading, true/false = resolved
  const [maintenance, setMaintenance] = useState(null);

  const fetchStatus = useCallback(() => {
    getPublicConfig()
      .then((r) => setMaintenance(r.data.data.maintenance_mode ?? false))
      .catch(() => setMaintenance(false)); // on error, allow through
  }, []);

  // Initial fetch (fresh — bypasses module-level logo cache)
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll every 30 s so sessions stay in sync without WS
  useEffect(() => {
    const id = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // Real-time update via WebSocket when admin toggles maintenance
  useEffect(() => {
    return subscribe('MAINTENANCE_CHANGED', (payload) => {
      setMaintenance(payload.maintenance_mode ?? false);
    });
  }, [subscribe]);

  // Brief loading state — render nothing to avoid flicker
  if (maintenance === null) return null;

  // ADMIN always bypasses maintenance mode
  if (role === 'ADMIN') return <Outlet />;

  // All other visitors see the maintenance page when mode is ON
  if (maintenance) return <MaintenancePage />;

  return <Outlet />;
}
