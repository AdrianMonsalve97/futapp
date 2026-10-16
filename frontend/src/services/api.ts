// Cliente HTTP mínimo (sin dependencias): cookie de sesión, errores tipados y
// cierre de sesión global ante 401 (SPEC §10.2).

import type { ApiErrorBody } from '../types/api';

const STORED_TOKEN_KEY = 'token';
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

/** Clear credentials left in storage by earlier clients; current sessions never read them. */
export function clearStoredCredentials(): void {
  window.localStorage.removeItem(STORED_TOKEN_KEY);
}

export type ApiOptions = RequestInit & { json?: unknown };

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)||path.startsWith('//')) throw new Error('La API solo admite rutas de FutApp');
  if (path.startsWith('/api')) return path;
  return `/api${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Fetch genérico del contrato API (SPEC §7).
 * - Agrega `Content-Type: application/json` cuando hay `json`.
 * - La sesión viaja en su cookie HttpOnly; no se expone una credencial en JavaScript.
 * - `!res.ok` lanza `ApiError` con el `error.message` del cuerpo.
 * - `401` limpia credenciales almacenadas y emite `auth:expired` para cerrar la sesión.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { json, ...rest } = options;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  headers.set('X-FutApp-Client','web');

  let res: Response;
  try {
    res = await fetch(resolveUrl(path), {
      ...rest,
      credentials:'same-origin',
      headers,
      body: json !== undefined ? JSON.stringify(json) : (rest.body ?? undefined),
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verificá que el servicio esté activo.', 0);
  }

  const isLogin = path.includes('/auth/login') || path.includes('/auth/register');

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
    if(res.status===401&&!isLogin){clearStoredCredentials();window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT,{detail:{code:errBody.error?.code}}));}
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

/** Protected files use the HttpOnly session cookie; URLs contain no credentials. */
export async function apiBlob(path: string): Promise<Blob> {
  if (!path.startsWith('/api/')) throw new Error('Ruta de archivo inválida');
  const res = await fetch(path, { credentials:'same-origin',headers:{'X-FutApp-Client':'web'} });
  if (res.status === 401) {
    const body=await res.json().catch(()=>({})) as ApiErrorBody;
    clearStoredCredentials();window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT,{detail:{code:body.error?.code}}));
  }
  if (!res.ok) throw new ApiError('No se pudo descargar el archivo', res.status);
  return res.blob();
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const body = new FormData(); body.append('file', file);
  return api<T>(path, { method: 'POST', body });
}
