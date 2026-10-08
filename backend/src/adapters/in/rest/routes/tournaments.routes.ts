import { Router } from 'express';
import type { TournamentPort } from '../../../../application/ports/in/tournament.port';
import type { TournamentInput } from '../../../../application/ports/out/tournament.repository';
import { getAuth, requireAuth, requireRole } from '../middleware/auth';
import { jsonBody, paramId } from '../route-helpers';
export function tournamentRoutes(tournaments: TournamentPort): Router {
  const router = Router();
  router.get('/tournaments', requireAuth, (req, res) => res.json(tournaments.list(getAuth(req).role === 'admin')));
  router.get('/tournaments/:id', requireAuth, (req, res) => res.json(tournaments.get(paramId(req), getAuth(req).role === 'admin')));
  router.get('/tournaments/:id/players', requireAuth, (req, res) => res.json(tournaments.roster(paramId(req), getAuth(req).role === 'admin', getAuth(req).userId)));
  router.post('/tournaments/:id/players', requireAuth, requireRole('admin'), (req, res) => {
    tournaments.addPlayers(paramId(req), jsonBody<{playerIds: number[]}>(req).playerIds);
    res.json(tournaments.roster(paramId(req), true, getAuth(req).userId));
  });
  router.delete('/tournaments/:id/players/:playerId', requireAuth, requireRole('admin'), (req, res) => {
    tournaments.removePlayer(paramId(req), paramId(req, 'playerId'));
    res.json(tournaments.roster(paramId(req), true, getAuth(req).userId));
  });
  router.post('/tournaments', requireAuth, requireRole('admin'), (req, res) => res.json(tournaments.save(null, jsonBody<TournamentInput>(req))));
  router.put('/tournaments/:id', requireAuth, requireRole('admin'), (req, res) => res.json(tournaments.save(paramId(req), jsonBody<TournamentInput>(req))));
  return router;
}
