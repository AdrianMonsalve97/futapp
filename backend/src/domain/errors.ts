/**
 * Jerarquía de errores de dominio (§2 del SPEC).
 * El error handler central de Express los mapea a un status HTTP.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 400 — datos de entrada inválidos. */
export class ValidationError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 400, code);
  }
}

/** 401 — sin token o token inválido. */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'No autenticado', code?: string) {
    super(message, 401, code);
  }
}

/** 403 — autenticado pero sin permiso para el recurso. */
export class ForbiddenError extends AppError {
  constructor(message: string = 'No tienes permiso para realizar esta acción', code?: string) {
    super(message, 403, code);
  }
}

/** 404 — recurso inexistente. */
export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso no encontrado', code?: string) {
    super(message, 404, code);
  }
}
