import { Router } from 'express';
import type { AiPort } from '../../../../application/ports/in/ai.port';
import { ValidationError } from '../../../../domain/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { jsonBody, paramId } from '../route-helpers';

interface RecommendXiBody {
  matchId?: number;
  formation?: string;
}

/** §7.10 · IA: insights, modelo y XI recomendado. */
export function aiRoutes(ai: AiPort): Router {
  const router = Router();

  router.get('/ai/insights', requireAuth, (_req, res) => {
    res.json(ai.insights());
  });

  router.get('/ai/players/:id', requireAuth, (req, res) => {
    res.json(ai.playerInsight(paramId(req)));
  });

  router.get('/ai/model', requireAuth, (_req, res) => {
    res.json(ai.getModelInfo());
  });

  router.post('/ai/model/train', requireAuth, requireRole('admin'), (_req, res) => {
    res.json(ai.train());
  });

  router.post('/ai/recommend-xi', requireAuth, requireRole('admin'), (req, res) => {
    const body = jsonBody<RecommendXiBody>(req);
    if (!Number.isInteger(body.matchId)) {
      throw new ValidationError('Debes indicar el partido (matchId) para sugerir el XI');
    }
    res.json(ai.recommendXi(body.matchId as number, body.formation));
  });

  return router;
}
