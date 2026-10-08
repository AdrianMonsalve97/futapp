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
  recipientType?:import('../../../../domain/entities').UniformRecipientType;
  recipientName?:string|null;
  uniformId?: number;
  size?: string;
  reason?: string | null;
}

/** §7.2 · Rutas del usuario autenticado. */
export function meRoutes(me: MePort): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/me', async (req, res) => {
    res.json((await me.getMe(getAuth(req).userId)));
  });

  router.put('/me/profile', async (req, res) => {
    const body = jsonBody<ProfileInput>(req);
    res.json((await me.updateProfile(getAuth(req).userId, body)));
  });

  router.put('/me/password', async (req, res) => {
    const body = jsonBody<PasswordBody>(req);
    if (!body.currentPassword || !body.newPassword) {
      throw new ValidationError('Debes indicar la contraseña actual y la nueva');
    }
    res.json((await me.changePassword(getAuth(req).userId, body.currentPassword, body.newPassword)));
  });

  router.get('/me/inscription', async (req, res) => {
    res.json((await me.getInscription(getAuth(req).userId)));
  });

  router.get('/me/uniforms', async (req, res) => {
    res.json((await me.getUniforms(getAuth(req).userId)));
  });

  router.post('/me/uniform-requests', async (req, res) => {
    const body = jsonBody<UniformRequestBody>(req);
    if (!Number.isInteger(body.uniformId)) {
      throw new ValidationError('Debes indicar un uniforme válido');
    }
    res.json(
      (await me.createUniformRequest(getAuth(req).userId, {
                uniformId: body.uniformId as number,
                size: String(body.size ?? ''),
                reason: body.reason ?? null,
                recipientType:body.recipientType,
                recipientName:body.recipientName,
              })),
    );
  });

  router.get('/me/matches', async (req, res) => {
    res.json((await me.getMatches(getAuth(req).userId)));
  });

  router.get('/me/stats', async (req, res) => {
    res.json((await me.getStats(getAuth(req).userId)));
  });

  router.get('/me/ai', async (req, res) => {
    const matchId=req.query.matchId===undefined?undefined:Number(req.query.matchId);
    if(matchId!==undefined&&(!Number.isSafeInteger(matchId)||matchId<=0))throw new ValidationError('Partido inválido');
    res.json((await me.getAi(getAuth(req).userId,matchId)));
  });

  return router;
}
