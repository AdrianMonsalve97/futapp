import { Router } from 'express';
import type {
  CreateMatchInput,
  LineupEntryInput,
  MatchPort,
  StrategyInput,
  UpdateMatchInput,
} from '../../../../application/ports/in/match.port';
import type { MatchStat } from '../../../../domain/entities';
import { getAuth, requireAuth, requireRole } from '../middleware/auth';
import type { AttendanceStatus } from '../../../../domain/entities';
import { jsonBody, paramId } from '../route-helpers';

/** §7.3 · Partidos, estrategias, alineaciones y estadísticas de partido. */
export function matchRoutes(matches: MatchPort): Router {
  const router = Router();
  const admin = [requireAuth, requireRole('admin')];

  router.get('/matches', requireAuth, async (_req, res) => {
    res.json((await matches.list()));
  });

  router.get('/matches/:id', requireAuth, async (req, res) => {
    res.json((await matches.get(paramId(req), getAuth(req).role === 'player')));
  });

  router.get('/matches/:id/attendance', ...admin, async (req, res) => res.json((await matches.attendance(paramId(req)))));
  router.get('/me/matches/:id/attendance', requireAuth, async (req, res) => res.json((await matches.attendance(paramId(req), getAuth(req).userId))));
  router.put('/me/matches/:id/attendance', requireAuth, async (req, res) => {
    const body = jsonBody<{ status: AttendanceStatus }>(req);
    res.json((await matches.setAttendance(paramId(req), getAuth(req).userId, body.status)));
  });
  router.post('/matches/:id/lineup/publish', ...admin, async (req, res) => {
    jsonBody(req);
    res.json((await matches.publishLineup(paramId(req))));
  });

  router.post('/matches', ...admin, async (req, res) => {
    const body = jsonBody<Partial<CreateMatchInput>>(req);
    res.json(
      (await matches.create({
                opponent: String(body.opponent ?? ''),
                competition: body.competition ? String(body.competition) : 'Amistoso',
                kickOff: String(body.kickOff ?? ''),
                venue: body.venue ?? null,
                isHome: body.isHome !== false,
                // §12.4: format y minutes son opcionales; el servicio deriva los defaults
                // (team_settings.format y profile.matchMinutes) y valida la formación.
                formation: body.formation !== undefined && body.formation !== null ? String(body.formation) : undefined,
                tournamentId: body.tournamentId,
                format: body.format,
                minutes: body.minutes,
                notes: body.notes ?? null,
                streamUrl: body.streamUrl,
              })),
    );
  });

  router.put('/matches/:id', ...admin, async (req, res) => {
    const body = jsonBody<UpdateMatchInput>(req);
    res.json((await matches.update(paramId(req), body)));
  });

  router.delete('/matches/:id', ...admin, async (req, res) => {
    res.json((await matches.remove(paramId(req))));
  });

  router.put('/matches/:id/formation', ...admin, async (req, res) => {
    const body = jsonBody<{ formation?: string }>(req);
    res.json((await matches.setFormation(paramId(req), String(body.formation ?? ''))));
  });

  router.post('/matches/:id/strategies', ...admin, async (req, res) => {
    const body = jsonBody<Partial<StrategyInput>>(req);
    res.json(
      (await matches.addStrategy(paramId(req), {
                title: String(body.title ?? ''),
                kind: body.kind ?? 'general',
                content: String(body.content ?? ''),
              })),
    );
  });

  router.put('/strategies/:id', ...admin, async (req, res) => {
    const body = jsonBody<Partial<StrategyInput>>(req);
    res.json((await matches.updateStrategy(paramId(req), body)));
  });

  router.delete('/strategies/:id', ...admin, async (req, res) => {
    res.json((await matches.removeStrategy(paramId(req))));
  });

  router.put('/matches/:id/lineup', ...admin, async (req, res) => {
    const body = jsonBody<{ slots?: LineupEntryInput[] }>(req);
    res.json((await matches.setLineup(paramId(req), body.slots ?? [])));
  });

  router.post('/matches/:id/lineup/auto', ...admin, async (req, res) => {
    const body = jsonBody<{ formation?: string }>(req);
    res.json((await matches.autoLineup(paramId(req), body.formation)));
  });

  router.post('/matches/:id/stats', ...admin, async (req, res) => {
    const body = jsonBody<{ entries?: Array<Partial<MatchStat> & { playerId: number }> }>(req);
    res.json((await matches.saveStats(paramId(req), body.entries ?? [])));
  });

  router.get('/matches/:id/stats', requireAuth, async (req, res) => {
    res.json((await matches.getStats(paramId(req))));
  });

  return router;
}
