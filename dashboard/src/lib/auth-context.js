'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { isAuthenticated, getUser, logout as apiLogout } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth status on mount
    if (isAuthenticated()) {
      setUser(getUser());
    }
    setLoading(false);
  }, []);

  const handleLogout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const handleLogin = useCallback((userData) => {
    setUser(userData);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout: handleLogout, onLogin: handleLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
