import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LoginResponse, UsuarioStaff } from '@presente/shared';
import { api, setOnUnauthorized, tokenStore } from '../api/client';

interface AuthState {
  usuario: UsuarioStaff | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioStaff | null>(null);
  const [cargando, setCargando] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUsuario(null);
  }, []);

  // Al cargar la página, si hay un token guardado lo validamos contra la API.
  useEffect(() => {
    setOnUnauthorized(logout);
    if (!tokenStore.get()) {
      setCargando(false);
      return;
    }
    api<{ usuario: UsuarioStaff }>('/auth/me')
      .then((r) => setUsuario(r.usuario))
      .catch(() => logout())
      .finally(() => setCargando(false));
  }, [logout]);

  const login = async (email: string, password: string) => {
    const r = await api<LoginResponse>('/auth/login', { body: { email, password } });
    tokenStore.set(r.token);
    setUsuario(r.usuario);
  };

  return <AuthContext.Provider value={{ usuario, cargando, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
