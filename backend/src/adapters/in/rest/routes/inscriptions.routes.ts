import { Router } from 'express';
import type {
  AddPaymentInput,
  CreateInscriptionInput,
  InscriptionPort,
  UpdateInscriptionInput,
} from '../../../../application/ports/in/inscription.port';
import type { InscriptionStatus } from '../../../../domain/entities';
import { ValidationError } from '../../../../domain/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { jsonBody, paramId, queryStr } from '../route-helpers';

/** §7.5 · Inscripciones (solo admin). */
export function inscriptionRoutes(inscriptions: InscriptionPort): Router {
  const router = Router();
  const admin = [requireAuth, requireRole('admin')];

  router.get('/inscriptions', ...admin, (req, res) => {
    const status = queryStr(req, 'status');
    if (status && !['pendiente', 'parcial', 'pagada'].includes(status)) {
      throw new ValidationError('Estado de inscripción inválido: pendiente, parcial o pagada');
    }
    res.json(
      inscriptions.list({
        season: queryStr(req, 'season'),
        playerId: queryStr(req, 'playerId') ? Number(queryStr(req, 'playerId')) : undefined,
        status: status as InscriptionStatus | undefined,
      }),
    );
  });

  router.post('/inscriptions', ...admin, (req, res) => {
    const body = jsonBody<Partial<CreateInscriptionInput>>(req);
    res.json(
      inscriptions.create({
        playerId: Number(body.playerId),
        season: String(body.season ?? ''),
        concept: body.concept,
        amount: Number(body.amount),
        dueDate: body.dueDate ?? null,
        notes: body.notes ?? null,
      }),
    );
  });

  router.post('/inscriptions/:id/payments', ...admin, (req, res) => {
    const body = jsonBody<Partial<AddPaymentInput>>(req);
    if (!body.method || !['efectivo', 'transferencia', 'qr', 'tarjeta'].includes(body.method)) {
      throw new ValidationError('Método de pago inválido: efectivo, transferencia, qr o tarjeta');
    }
    res.json(
      inscriptions.addPayment(paramId(req), {
        amount: Number(body.amount),
        method: body.method,
        reference: body.reference ?? null,
        paidAt: body.paidAt,
        notes: body.notes ?? null,
      }),
    );
  });

  router.put('/inscriptions/:id', ...admin, (req, res) => {
    const body = jsonBody<UpdateInscriptionInput>(req);
    res.json(inscriptions.update(paramId(req), body));
  });

  router.delete('/inscriptions/:id', ...admin, (req, res) => {
    res.json(inscriptions.remove(paramId(req)));
  });

  return router;
}
