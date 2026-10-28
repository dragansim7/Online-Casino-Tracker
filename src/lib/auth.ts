/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { User } from '../types/index.ts';

const AUTH_USER_KEY = 'axhub:auth_user';
const AUTH_TOKEN_KEY = 'axhub:auth_token';

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredAuth(user: User | null, token: string | null) {
  if (user && token) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  window.dispatchEvent(new CustomEvent('axhub:auth-changed'));
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [token, setToken] = useState<string | null>(getStoredToken);

  useEffect(() => {
    const handler = () => {
      setUser(getStoredUser());
      setToken(getStoredToken());
    };

    window.addEventListener('axhub:auth-changed', handler);
    return () => window.removeEventListener('axhub:auth-changed', handler);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid email or password');
    }
    const data = await res.json();
    setStoredAuth(data.user, data.token);
    return data.user;
  };

  const logout = () => {
    setStoredAuth(null, null);
  };

  return {
    user,
    token,
    isAdmin: user?.role === 'admin',
    login,
    logout,
  };
}
