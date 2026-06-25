import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('classmanager_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [checkingSession, setCheckingSession] = useState(Boolean(localStorage.getItem('classmanager_token')));

  useEffect(() => {
    let active = true;
    if (!localStorage.getItem('classmanager_token')) {
      setCheckingSession(false);
      return undefined;
    }
    api.get('/auth/me')
      .then((response) => {
        if (!active) return;
        setUser(response.data);
        localStorage.setItem('classmanager_user', JSON.stringify(response.data));
      })
      .catch(() => {
        if (!active) return;
        localStorage.removeItem('classmanager_token');
        localStorage.removeItem('classmanager_user');
        setUser(null);
      })
      .finally(() => active && setCheckingSession(false));
    return () => { active = false; };
  }, []);

  const login = useCallback(async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    localStorage.setItem('classmanager_token', response.data.token);
    localStorage.setItem('classmanager_user', JSON.stringify(response.data.user));
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const register = useCallback(async (details) => {
    const response = await api.post('/auth/register', details);
    return response.data;
  }, []);

  const updateProfile = useCallback(async (details) => {
    const response = await api.put('/auth/me', details);
    localStorage.setItem('classmanager_user', JSON.stringify(response.data));
    setUser(response.data);
    return response.data;
  }, []);

  const logout = useCallback(async () => {
    const logoutRequest = api.post('/auth/logout', {}).catch(() => undefined);
    localStorage.removeItem('classmanager_token');
    localStorage.removeItem('classmanager_user');
    setUser(null);
    await logoutRequest;
  }, []);

  const value = useMemo(
    () => ({ user, login, register, updateProfile, logout, checkingSession }),
    [user, login, register, updateProfile, logout, checkingSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
