import { Router } from 'express';
import type { MePort, ProfileInput } from '../../../../application/ports/in/me.port';
import { ValidationError } from '../../../../domain/errors';
import { getAuth, requireAuth } from '../middleware/auth';
import { jsonBody } from '../route-helpers';

interface PasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

interface UniformRequestBody {
  uniformId?: number;
  size?: string;
  reason?: string | null;
}

/** §7.2 · Rutas del usuario autenticado. */
export function meRoutes(me: MePort): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/me', (req, res) => {
    res.json(me.getMe(getAuth(req).userId));
  });

  router.put('/me/profile', (req, res) => {
    const body = jsonBody<ProfileInput>(req);
    res.json(me.updateProfile(getAuth(req).userId, body));
  });

  router.put('/me/password', (req, res) => {
    const body = jsonBody<PasswordBody>(req);
    if (!body.currentPassword || !body.newPassword) {
      throw new ValidationError('Debes indicar la contraseña actual y la nueva');
    }
    res.json(me.changePassword(getAuth(req).userId, body.currentPassword, body.newPassword));
  });

  router.get('/me/inscription', (req, res) => {
    res.json(me.getInscription(getAuth(req).userId));
  });

  router.get('/me/uniforms', (req, res) => {
    res.json(me.getUniforms(getAuth(req).userId));
  });

  router.post('/me/uniform-requests', (req, res) => {
    const body = jsonBody<UniformRequestBody>(req);
    if (!Number.isInteger(body.uniformId)) {
      throw new ValidationError('Debes indicar un uniforme válido');
    }
    res.json(
      me.createUniformRequest(getAuth(req).userId, {
        uniformId: body.uniformId as number,
        size: String(body.size ?? ''),
        reason: body.reason ?? null,
      }),
    );
  });

  router.get('/me/matches', (req, res) => {
    res.json(me.getMatches(getAuth(req).userId));
  });

  router.get('/me/stats', (req, res) => {
    res.json(me.getStats(getAuth(req).userId));
  });

  router.get('/me/ai', (req, res) => {
    const matchId=req.query.matchId===undefined?undefined:Number(req.query.matchId);
    if(matchId!==undefined&&(!Number.isSafeInteger(matchId)||matchId<=0))throw new ValidationError('Partido inválido');
    res.json(me.getAi(getAuth(req).userId,matchId));
  });

  return router;
}
