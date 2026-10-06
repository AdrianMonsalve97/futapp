import { Router } from 'express';
import type {
  CreateMatchInput,
  LineupEntryInput,
  MatchPort,
  StrategyInput,
  UpdateMatchInput,
} from '../../../../application/ports/in/match.port';
import type { MatchStat } from '../../../../domain/entities';
import { requireAuth, requireRole } from '../middleware/auth';
import { jsonBody, paramId } from '../route-helpers';

/** §7.3 · Partidos, estrategias, alineaciones y estadísticas de partido. */
export function matchRoutes(matches: MatchPort): Router {
  const router = Router();
  const admin = [requireAuth, requireRole('admin')];

  router.get('/matches', requireAuth, (_req, res) => {
    res.json(matches.list());
  });

  router.get('/matches/:id', requireAuth, (req, res) => {
    res.json(matches.get(paramId(req)));
  });

  router.post('/matches', ...admin, (req, res) => {
    const body = jsonBody<Partial<CreateMatchInput>>(req);
    res.json(
      matches.create({
        opponent: String(body.opponent ?? ''),
        competition: body.competition ? String(body.competition) : 'Amistoso',
        kickOff: String(body.kickOff ?? ''),
        venue: body.venue ?? null,
        isHome: body.isHome !== false,
        // §12.4: format y minutes son opcionales; el servicio deriva los defaults
        // (team_settings.format y profile.matchMinutes) y valida la formación.
        formation: body.formation !== undefined && body.formation !== null ? String(body.formation) : undefined,
        format: body.format,
        minutes: body.minutes,
        notes: body.notes ?? null,
      }),
    );
  });

  router.put('/matches/:id', ...admin, (req, res) => {
    const body = jsonBody<UpdateMatchInput>(req);
    res.json(matches.update(paramId(req), body));
  });

  router.delete('/matches/:id', ...admin, (req, res) => {
    res.json(matches.remove(paramId(req)));
  });

  router.put('/matches/:id/formation', ...admin, (req, res) => {
    const body = jsonBody<{ formation?: string }>(req);
    res.json(matches.setFormation(paramId(req), String(body.formation ?? '')));
  });

  router.post('/matches/:id/strategies', ...admin, (req, res) => {
    const body = jsonBody<Partial<StrategyInput>>(req);
    res.json(
      matches.addStrategy(paramId(req), {
        title: String(body.title ?? ''),
        kind: body.kind ?? 'general',
        content: String(body.content ?? ''),
      }),
    );
  });

  router.put('/strategies/:id', ...admin, (req, res) => {
    const body = jsonBody<Partial<StrategyInput>>(req);
    res.json(matches.updateStrategy(paramId(req), body));
  });

  router.delete('/strategies/:id', ...admin, (req, res) => {
    res.json(matches.removeStrategy(paramId(req)));
  });

  router.put('/matches/:id/lineup', ...admin, (req, res) => {
    const body = jsonBody<{ slots?: LineupEntryInput[] }>(req);
    res.json(matches.setLineup(paramId(req), body.slots ?? []));
  });

  router.post('/matches/:id/lineup/auto', ...admin, (req, res) => {
    const body = jsonBody<{ formation?: string }>(req);
    res.json(matches.autoLineup(paramId(req), body.formation));
  });

  router.post('/matches/:id/stats', ...admin, (req, res) => {
    const body = jsonBody<{ entries?: Array<Partial<MatchStat> & { playerId: number }> }>(req);
    res.json(matches.saveStats(paramId(req), body.entries ?? []));
  });

  router.get('/matches/:id/stats', requireAuth, (req, res) => {
    res.json(matches.getStats(paramId(req)));
  });

  return router;
}
