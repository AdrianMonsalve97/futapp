// Cliente HTTP mínimo (sin dependencias): token Bearer, errores tipados y
// cierre de sesión global ante 401 (SPEC §10.2).

import type { ApiErrorBody } from '../types/api';

export const TOKEN_KEY = 'token';
export const AUTH_EXPIRED_EVENT = 'auth:expired';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export type ApiOptions = RequestInit & { json?: unknown };

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/api')) return path;
  return `/api${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Fetch genérico del contrato API (SPEC §7).
 * - Agrega `Content-Type: application/json` cuando hay `json`.
 * - Adjunta `Authorization: Bearer <token>` si existe token.
 * - `!res.ok` lanza `ApiError` con el `error.message` del cuerpo.
 * - `401` borra el token y emite `auth:expired` (lo escucha `AuthContext`).
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { json, ...rest } = options;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(resolveUrl(path), {
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : (rest.body ?? undefined),
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verificá que el servicio esté activo.', 0);
  }

  const isLogin = path.includes('/auth/login') || path.includes('/auth/register');
  if (res.status === 401 && !isLogin) {
    clearToken();
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const errBody = (body ?? {}) as ApiErrorBody;
    const message = errBody.error?.message ?? `Ocurrió un error (HTTP ${res.status}).`;
    throw new ApiError(message, res.status, errBody.error?.code);
  }

  return body as T;
}

/** Mensaje legible para cualquier error lanzado por `api`. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}
