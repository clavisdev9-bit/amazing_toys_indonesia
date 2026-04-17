import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function RequireAuth({ staffOnly = false }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const to = staffOnly ? '/staff/masuk' : '/masuk';
    return <Navigate to={to} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
