import { Router } from 'express';
import type {
  CreateSanctionInput,
  SanctionPort,
  UpdateSanctionInput,
} from '../../../../application/ports/in/sanction.port';
import type { SanctionStatus, SanctionType } from '../../../../domain/entities';
import { ValidationError } from '../../../../domain/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { jsonBody, paramId, queryStr } from '../route-helpers';

/** §7.7 · Sanciones (solo admin). */
export function sanctionRoutes(sanctions: SanctionPort): Router {
  const router = Router();
  const admin = [requireAuth, requireRole('admin')];

  router.get('/sanctions', ...admin, (req, res) => {
    const status = queryStr(req, 'status');
    const type = queryStr(req, 'type');
    if (status && !['activa', 'cumplida', 'anulada'].includes(status)) {
      throw new ValidationError('Estado de sanción inválido: activa, cumplida o anulada');
    }
    if (type && !['tarjeta_amarilla', 'tarjeta_roja', 'suspension', 'multa', 'amonestacion'].includes(type)) {
      throw new ValidationError('Tipo de sanción inválido');
    }
    const playerId = queryStr(req, 'playerId');
    res.json(
      sanctions.list({
        playerId: playerId ? Number(playerId) : undefined,
        status: status as SanctionStatus | undefined,
        type: type as SanctionType | undefined,
      }),
    );
  });

  router.post('/sanctions', ...admin, (req, res) => {
    const body = jsonBody<Partial<CreateSanctionInput>>(req);
    res.json(
      sanctions.create({
        playerId: Number(body.playerId),
        matchId: body.matchId ?? null,
        type: body.type ?? 'amonestacion',
        reason: String(body.reason ?? ''),
        amount: body.amount !== undefined ? Number(body.amount) : 0,
        points: body.points !== undefined ? Number(body.points) : 0,
        matchDate: body.matchDate ?? null,
      }),
    );
  });

  router.put('/sanctions/:id', ...admin, (req, res) => {
    const body = jsonBody<UpdateSanctionInput>(req);
    res.json(sanctions.update(paramId(req), body));
  });

  router.delete('/sanctions/:id', ...admin, (req, res) => {
    res.json(sanctions.remove(paramId(req)));
  });

  return router;
}
