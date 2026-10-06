import { Router } from 'express';
import type { AuthPort, LoginInput, RegisterInput } from '../../../../application/ports/in/auth.port';
import { getAuth, requireAuth } from '../middleware/auth';
import { jsonBody } from '../route-helpers';

/** §7.1 · Autenticación (público salvo `/auth/me`). */
export function authRoutes(auth: AuthPort): Router {
  const router = Router();

  router.post('/auth/login', (req, res) => {
    const body = jsonBody<Partial<LoginInput>>(req);
    res.json(
      auth.login({
        email: String(body.email ?? ''),
        password: String(body.password ?? ''),
      }),
    );
  });

  router.post('/auth/register', (req, res) => {
    const body = jsonBody<Partial<RegisterInput>>(req);
    res.json(
      auth.register({
        email: String(body.email ?? ''),
        password: String(body.password ?? ''),
        fullName: String(body.fullName ?? ''),
        phone: body.phone ?? null,
        position: body.position,
        shirtNumber: body.shirtNumber ?? null,
      }),
    );
  });

  router.get('/auth/me', requireAuth, (req, res) => {
    res.json(auth.me(getAuth(req).userId));
  });

  return router;
}
