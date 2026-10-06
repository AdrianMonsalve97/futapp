import type { Request } from 'express';
import { ValidationError } from '../../../domain/errors';

/** Extrae y valida un parámetro de ruta numérico. */
export function paramId(req: Request, name = 'id'): number {
  const raw = req.params[name];
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`Identificador inválido: ${raw}`);
  }
  return value;
}

/** Lee un query param de texto (undefined si no viene o está vacío). */
export function queryStr(req: Request, name: string): string | undefined {
  const raw = req.query[name];
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return undefined;
}

/** Lee un query param numérico entero. */
export function queryNum(req: Request, name: string): number | undefined {
  const raw = queryStr(req, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new ValidationError(`El parámetro "${name}" debe ser un número`);
  }
  return value;
}

/** Cuerpo JSON como objeto (si no hay cuerpo, devuelve `{}`). */
export function jsonBody<T>(req: Request): T {
  const body: unknown = req.body;
  if (body === undefined || body === null) return {} as T;
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Se esperaba un objeto JSON en el cuerpo de la petición');
  }
  return body as T;
}
