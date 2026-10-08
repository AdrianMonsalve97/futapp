import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../../../../domain/entities';
import { ForbiddenError, UnauthorizedError } from '../../../../domain/errors';
import type { AuthPort } from '../../../../application/ports/in/auth.port';

export interface AuthContext {
  userId: number;
  role: Role;
  email: string;
}
export const SESSION_COOKIE='futapp_session';
export function requestToken(req:Request):string|null {
  const header=req.headers.authorization;
  if(header)return header.startsWith('Bearer ')?header.slice(7).trim():null;
  const value=req.headers.cookie?.split(';').map(item=>item.trim()).find(item=>item.startsWith(SESSION_COOKIE+'='));
  if(!value)return null;try{return decodeURIComponent(value.slice(SESSION_COOKIE.length+1));}catch{return null;}
}

/** Resolve identity against the database on every authenticated request. */
export function sessionMiddleware(authService: AuthPort) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token=requestToken(req);
    if (req.path === '/auth/login' || req.path === '/auth/register' || !token) {
      next();
      return;
    }
    try {
      const {user}=(await authService.verifySession(token));
      (req as Request & { auth?: AuthContext }).auth = { userId:user.id, role: user.role, email: user.email };
      next();
    } catch {
      next(new UnauthorizedError('Sesión inválida, expirada o cuenta inactiva'));
    }
  };
}

/** Devuelve el contexto de autenticación fijado por `requireAuth`. */
export function getAuth(req: Request): AuthContext {
  const auth = (req as Request & { auth?: AuthContext }).auth;
  if (!auth) throw new UnauthorizedError('No autenticado');
  return auth;
}

/** Valida `Authorization: Bearer <token>` y adjunta `req.auth`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if ((req as Request & { auth?: AuthContext }).auth) { next(); return; }
  next(new UnauthorizedError('Token de autenticación ausente o inválido'));
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
