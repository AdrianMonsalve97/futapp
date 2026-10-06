import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, NotFoundError, ValidationError } from '../../../../domain/errors';

/** 404: cualquier ruta no registrada bajo /api (y el resto de la app). */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

/**
 * Único manejador central de errores (§7): AppError → status del error;
 * errores de parseo de JSON → 400; cualquier otro → 500 con log del stack.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const body: { error: { message: string; code?: string } } = {
      error: { message: err.message },
    };
    if (err.code) body.error.code = err.code;
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { message: 'El cuerpo de la petición no es JSON válido' } });
    return;
  }

  if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: { message: 'El cuerpo de la petición es demasiado grande' } });
    return;
  }

  console.error('[error] Error interno no controlado:', err instanceof Error ? err.stack : err);
  res.status(500).json({ error: { message: 'Error interno del servidor' } });
};

/** Convierte errores de validación de la ruta en `ValidationError`. */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}
