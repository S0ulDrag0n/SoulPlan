'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Session } from '@/lib/types';
import * as api from '@/lib/api';

const SESSION_KEY = 'soulplan-session-token';
const SESSION_INFO_KEY = 'soulplan-session-info';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  joinAsGuest: (name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, try to restore session from localStorage
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;
    const storedInfo = typeof window !== 'undefined' ? localStorage.getItem(SESSION_INFO_KEY) : null;
    if (token && storedInfo) {
      try {
        const info = JSON.parse(storedInfo) as Session;
        setSession(info);
      } catch {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_INFO_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api.loginUser({ username, password });
    localStorage.setItem(SESSION_KEY, result.session.token);
    localStorage.setItem(SESSION_INFO_KEY, JSON.stringify(result.session));
    setSession(result.session);
  }, []);

  const register = useCallback(async (username: string, password: string, displayName?: string) => {
    const result = await api.registerUser({ username, password, displayName });
    localStorage.setItem(SESSION_KEY, result.session.token);
    localStorage.setItem(SESSION_INFO_KEY, JSON.stringify(result.session));
    setSession(result.session);
  }, []);

  const joinAsGuest = useCallback(async (name: string) => {
    const result = await api.joinAsGuest({ name });
    localStorage.setItem(SESSION_KEY, result.session.token);
    localStorage.setItem(SESSION_INFO_KEY, JSON.stringify(result.session));
    setSession(result.session);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore — token may be expired already
    }
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_INFO_KEY);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, login, register, joinAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}