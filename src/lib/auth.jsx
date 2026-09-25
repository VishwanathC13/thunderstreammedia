import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiPost, apiGet } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ah_token');
    if (!token) {
      setReady(true);
      return;
    }
    apiGet('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem('ah_token'))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiPost('/api/auth/login', { email, password }, { auth: false });
    localStorage.setItem('ah_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ah_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
