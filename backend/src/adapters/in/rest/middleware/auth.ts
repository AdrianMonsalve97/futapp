import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../../../config/env';
import type { Role } from '../../../../domain/entities';
import { ForbiddenError, UnauthorizedError } from '../../../../domain/errors';

export interface AuthContext {
  userId: number;
  role: Role;
  email: string;
}

/** Devuelve el contexto de autenticación fijado por `requireAuth`. */
export function getAuth(req: Request): AuthContext {
  const auth = (req as Request & { auth?: AuthContext }).auth;
  if (!auth) throw new UnauthorizedError('No autenticado');
  return auth;
}

/** Valida `Authorization: Bearer <token>` y adjunta `req.auth`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Token de autenticación ausente'));
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7).trim(), env.jwtSecret) as jwt.JwtPayload;
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      next(new UnauthorizedError('Token inválido'));
      return;
    }
    const ctx: AuthContext = {
      userId,
      role: (payload.role === 'admin' ? 'admin' : 'player') as Role,
      email: String(payload.email ?? ''),
    };
    (req as Request & { auth?: AuthContext }).auth = ctx;
    next();
  } catch {
    next(new UnauthorizedError('Token inválido o expirado'));
  }
}

/** Restringe una ruta a un rol concreto (usar después de `requireAuth`). */
export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = (req as Request & { auth?: AuthContext }).auth;
    if (!auth) {
      next(new UnauthorizedError('No autenticado'));
      return;
    }
    if (auth.role !== role) {
      next(new ForbiddenError('No tienes permiso para realizar esta acción'));
      return;
    }
    next();
  };
}
