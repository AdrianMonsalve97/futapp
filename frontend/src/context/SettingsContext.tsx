// Contexto de configuración global del equipo (SPEC §12.4): `GET/PUT /api/settings`.
// Expone el formato vigente (f5/f7/f8/f11) a toda la app para que el pitch y los
// textos ("por partido" vs "por 90'") se rendericen bien en cualquier página.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { api, errorMessage } from '../services/api';
import { getFormat } from '../data/formations';
import type { FormatProfile, TeamSettings, TeamSettingsPayload } from '../types/api';

/** Valores de respaldo mientras carga o si el endpoint no está disponible (backend legacy en f11). */
const FALLBACK_SETTINGS: TeamSettings = {
  logoUrl: '/brand/aag-logo.jpg', brandColor: '#d8b86a',
  teamName: 'Club Portal',
  format: 11,
  season: '2026',
  profile: getFormat(11),
};

/** Garantiza que la respuesta tenga `profile` aunque el backend no lo envíe todavía. */
function withProfile(settings: TeamSettings): TeamSettings {
  if (settings.profile) return settings;
  return { ...settings, profile: getFormat(settings.format) };
}

interface SettingsContextValue {
  settings: TeamSettings;
  /** Atajo del perfil de formato vigente (equipo). */
  profile: FormatProfile;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** `PUT /api/settings` y actualiza el contexto con la respuesta. */
  save: (input: TeamSettingsPayload) => Promise<TeamSettings>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [settings, setSettings] = useState<TeamSettings>(FALLBACK_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<TeamSettings>(token ? '/api/settings' : '/api/branding')
      .then((result) => {
        if (!cancelled) setSettings(withProfile({ ...FALLBACK_SETTINGS, ...result }));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, version]);

  useEffect(() => { document.documentElement.style.setProperty('--club-brand-color', settings.brandColor || '#d8b86a'); }, [settings.brandColor]);
  useEffect(() => { document.title = `${settings.teamName} · Fútbol`; }, [settings.teamName]);
  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) { const logo = settings.logoUrl || '/brand/aag-logo.jpg'; icon.href = logo.startsWith('/api/media/') ? '/api/branding/logo?v=' + logo.split('/').pop() : logo; icon.removeAttribute('type'); }
  }, [settings.logoUrl]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  const save = useCallback(async (input: TeamSettingsPayload): Promise<TeamSettings> => {
    const result = await api<TeamSettings>('/api/settings', { method: 'PUT', json: input });
    const next = withProfile(result);
    setSettings(next);
    return next;
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, profile: settings.profile, loading, error, reload, save }),
    [settings, loading, error, reload, save],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de <SettingsProvider>.');
  return ctx;
}

/**
 * Perfil de formato a usar en una vista: el del partido/entidad si existe y,
 * si no, el formato global del equipo. Ideal para pitches y textos.
 */
export function useTeamFormat(format?: number): FormatProfile {
  const { settings } = useSettings();
  return getFormat(format ?? settings.profile.format);
}
