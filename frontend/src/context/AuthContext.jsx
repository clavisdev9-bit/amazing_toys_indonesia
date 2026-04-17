import React, { createContext, useState, useCallback } from 'react';

export const AuthContext = createContext(null);

function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function loadFromStorage() {
  const token = localStorage.getItem('sos_token');
  const userStr = localStorage.getItem('sos_user');
  if (!token || !userStr) return { token: null, user: null };
  try {
    const user = JSON.parse(userStr);
    // Check token expiry
    const decoded = decodeJWT(token);
    if (decoded && decoded.exp && decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('sos_token');
      localStorage.removeItem('sos_user');
      return { token: null, user: null };
    }
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }) {
  const [{ token, user }, setAuth] = useState(loadFromStorage);

  const login = useCallback((newToken, userData) => {
    localStorage.setItem('sos_token', newToken);
    localStorage.setItem('sos_user', JSON.stringify(userData));
    setAuth({ token: newToken, user: userData });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sos_token');
    localStorage.removeItem('sos_user');
    setAuth({ token: null, user: null });
  }, []);

  return (
    <AuthContext.Provider value={{
      token,
      user,
      role: user?.role ?? null,
      isAuthenticated: !!token,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
