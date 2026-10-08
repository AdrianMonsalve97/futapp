import { Router } from 'express';
import type { TournamentPort } from '../../../../application/ports/in/tournament.port';
import type { TournamentInput } from '../../../../application/ports/out/tournament.repository';
import { getAuth, requireAuth, requireRole } from '../middleware/auth';
import { jsonBody, paramId } from '../route-helpers';
export function tournamentRoutes(tournaments: TournamentPort): Router {
  const router = Router();
  router.get('/tournaments', requireAuth, async (req, res) => res.json((await tournaments.list(getAuth(req).role === 'admin'))));
  router.get('/tournaments/:id', requireAuth, async (req, res) => res.json((await tournaments.get(paramId(req), getAuth(req).role === 'admin'))));
  router.get('/tournaments/:id/players', requireAuth, async (req, res) => res.json((await tournaments.roster(paramId(req), getAuth(req).role === 'admin', getAuth(req).userId))));
  router.post('/tournaments/:id/players', requireAuth, requireRole('admin'), async (req, res) => {
    (await tournaments.addPlayers(paramId(req), jsonBody<{playerIds: number[]}>(req).playerIds));
    res.json((await tournaments.roster(paramId(req), true, getAuth(req).userId)));
  });
  router.delete('/tournaments/:id/players/:playerId', requireAuth, requireRole('admin'), async (req, res) => {
    (await tournaments.removePlayer(paramId(req), paramId(req, 'playerId')));
    res.json((await tournaments.roster(paramId(req), true, getAuth(req).userId)));
  });
  router.post('/tournaments', requireAuth, requireRole('admin'), async (req, res) => res.json((await tournaments.save(null, jsonBody<TournamentInput>(req)))));
  router.put('/tournaments/:id', requireAuth, requireRole('admin'), async (req, res) => res.json((await tournaments.save(paramId(req), jsonBody<TournamentInput>(req)))));
  return router;
}
