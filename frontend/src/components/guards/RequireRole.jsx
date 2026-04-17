import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const roleHome = {
  CUSTOMER: '/katalog',
  CASHIER:  '/cashier',
  TENANT:   '/tenant',
  LEADER:   '/leader',
  ADMIN:    '/admin',
};

export default function RequireRole({ allowedRoles }) {
  const { role, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/masuk" replace />;

  if (!allowedRoles.includes(role)) {
    const home = roleHome[role] ?? '/masuk';
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}
