import { Router } from 'express';
import type { StatsPort } from '../../../../application/ports/in/stats.port';
import { requireAuth } from '../middleware/auth';
import { queryNum } from '../route-helpers';

/** §7.8 · Estadísticas (autenticado). */
export function statsRoutes(stats: StatsPort): Router {
  const router = Router();

  router.get('/stats', requireAuth, (req, res) => {
    res.json(stats.list({ matchId: queryNum(req, 'matchId'), playerId: queryNum(req, 'playerId') }));
  });

  router.get('/team/stats', requireAuth, (_req, res) => {
    res.json(stats.teamStats());
  });

  return router;
}
