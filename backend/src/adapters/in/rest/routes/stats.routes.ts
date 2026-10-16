import { Router } from 'express';
import type { StatsPort } from '../../../../application/ports/in/stats.port';
import { getAuth, requireAuth } from '../middleware/auth';
import { queryNum } from '../route-helpers';

/** §7.8 · Estadísticas (autenticado). */
export function statsRoutes(stats: StatsPort): Router {
  const router = Router();

  router.get('/squad', requireAuth, async (req, res) => {
    res.json(await stats.squad(queryNum(req, 'tournamentId'), getAuth(req).role === 'admin'));
  });

  router.get('/stats', requireAuth, async (req, res) => {
    res.json((await stats.list({ matchId: queryNum(req, 'matchId'), playerId: queryNum(req, 'playerId') })));
  });

  router.get('/team/stats', requireAuth, async (_req, res) => {
    res.json((await stats.teamStats()));
  });

  return router;
}
