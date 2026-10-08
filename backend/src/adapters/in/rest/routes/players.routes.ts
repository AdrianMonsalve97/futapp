import { Router } from 'express';
import type {
  CreatePlayerInput,
  PlayerPort,
  UpdatePlayerInput,
} from '../../../../application/ports/in/player.port';
import { requireAuth, requireRole } from '../middleware/auth';
import { jsonBody, paramId } from '../route-helpers';

/** §7.4 · Jugadores (solo admin). */
export function playerRoutes(players: PlayerPort): Router {
  const router = Router();
  const admin = [requireAuth, requireRole('admin')];

  router.get('/players', ...admin, async (_req, res) => {
    res.json((await players.list()));
  });

  router.get('/players/:id', ...admin, async (req, res) => {
    res.json((await players.get(paramId(req))));
  });

  router.post('/players', ...admin, async (req, res) => {
    const body = jsonBody<Partial<CreatePlayerInput>>(req);
    res.json(
      (await players.create({
                email: String(body.email ?? ''),
                password: String(body.password ?? ''),
                fullName: String(body.fullName ?? ''),
                phone: body.phone ?? null,
                dni: body.dni ?? null,
                position: body.position ?? 'MED',
                secondaryPosition: body.secondaryPosition ?? null,
                shirtNumber: body.shirtNumber ?? null,
                birthDate: body.birthDate ?? null,
                heightCm: body.heightCm ?? null,
                weightKg: body.weightKg ?? null,
                foot: body.foot ?? null,
                emergencyContact: body.emergencyContact ?? null,
                eps: body.eps ?? null,
                prepaidHealth: body.prepaidHealth ?? null,
              })),
    );
  });

  router.put('/players/:id', ...admin, async (req, res) => {
    const body = jsonBody<UpdatePlayerInput>(req);
    res.json((await players.update(paramId(req), body)));
  });

  router.delete('/players/:id', ...admin, async (req, res) => {
    res.json((await players.remove(paramId(req))));
  });

  return router;
}
