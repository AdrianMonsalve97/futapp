// Contexto de autenticación (SPEC §10.2): sesión, login/registro y expiración.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthPayload, Player, User } from '../types/api';
import {
  AUTH_EXPIRED_EVENT,
  api,
  clearToken,
  errorMessage,
  getToken,
  setToken,
} from '../services/api';

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  position?: string;
  shirtNumber?: number;
}

interface AuthContextValue {
  user: User | null;
  player: Player | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthPayload>;
  register: (input: RegisterInput) => Promise<AuthPayload>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null);

  const applySession = useCallback((payload: AuthPayload) => {
    setToken(payload.token);
    setTokenState(payload.token);
    setUser(payload.user);
    setPlayer(payload.player);
  }, []);

  const clearSession = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
    setPlayer(null);
  }, []);

  const refresh = useCallback(async () => {
    const current = getToken();
    if (!current) {
      clearSession();
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ user: User; player: Player | null }>('/api/auth/me');
      setUser(res.user);
      setPlayer(res.player);
      setTokenState(current);
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  // Al montar: si hay token, valida la sesión contra el backend.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 401 global: el cliente de API emite este evento y acá se limpia la sesión.
  useEffect(() => {
    const onExpired = () => clearSession();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthPayload> => {
      try {
        const payload = await api<AuthPayload>('/api/auth/login', {
          method: 'POST',
          json: { email, password },
        });
        applySession(payload);
        return payload;
      } catch (err) {
        throw new Error(errorMessage(err));
      }
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<AuthPayload> => {
      try {
        const payload = await api<AuthPayload>('/api/auth/register', {
          method: 'POST',
          json: input,
        });
        applySession(payload);
        return payload;
      } catch (err) {
        throw new Error(errorMessage(err));
      }
    },
    [applySession],
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, player, token, loading, login, register, logout, refresh }),
    [user, player, token, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}
