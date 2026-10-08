import { Router } from 'express';
import type { AiPort } from '../../../../application/ports/in/ai.port';
import { ValidationError } from '../../../../domain/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { jsonBody, paramId } from '../route-helpers';
import type { TacticalStyle } from '../../../../domain/tactics';
import { researchCoaching } from '../../../../application/services/coaching-research';

interface RecommendXiBody {
  matchId?: number;
  formation?: string;
}

/** §7.10 · IA: insights, modelo y XI recomendado. */
export function aiRoutes(ai: AiPort): Router {
  const router = Router();

  router.get('/ai/insights', requireAuth, requireRole('admin'), async (_req, res) => {
    res.json((await ai.insights()));
  });

  router.get('/ai/players/:id', requireAuth, requireRole('admin'), async (req, res) => {
    res.json((await ai.playerInsight(paramId(req))));
  });

  router.get('/ai/model', requireAuth, async (_req, res) => {
    res.json((await ai.getModelInfo()));
  });

  router.post('/ai/model/train', requireAuth, requireRole('admin'), async (_req, res) => {
    res.json((await ai.train()));
  });

  router.post('/ai/recommend-xi', requireAuth, requireRole('admin'), async (req, res) => {
    const body = jsonBody<RecommendXiBody>(req);
    if (!Number.isInteger(body.matchId)) {
      throw new ValidationError('Debes indicar el partido para sugerir la alineación');
    }
    res.json((await ai.recommendXi(body.matchId as number, body.formation)));
  });

  router.post('/ai/tactical-plan',requireAuth,requireRole('admin'),async (req,res) => {
    const body = jsonBody<{matchId:number;style?:TacticalStyle;formation?:string}>(req);
    res.json((await ai.tacticalPlan(body.matchId,body.style,body.formation)));
  });
  router.post('/ai/research',requireAuth,requireRole('admin'),async(req,res) => {
    const body = jsonBody<{matchId:number;style?:TacticalStyle}>(req);
    const plan = (await ai.tacticalPlan(body.matchId,body.style));
    res.json(await researchCoaching(plan.style));
  });

  return router;
}
