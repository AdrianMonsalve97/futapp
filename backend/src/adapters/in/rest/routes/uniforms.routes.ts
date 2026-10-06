import { Router } from 'express';
import type {
  CreateIssueInput,
  CreateUniformInput,
  UniformPort,
  UpdateIssueInput,
  UpdateRequestInput,
  UpdateUniformInput,
} from '../../../../application/ports/in/uniform.port';
import type { UniformRequestStatus } from '../../../../domain/entities';
import { ValidationError } from '../../../../domain/errors';
import { requireAuth, requireRole } from '../middleware/auth';
import { jsonBody, paramId, queryStr } from '../route-helpers';

/** §7.6 · Uniformes: catálogo, entregas y solicitudes (solo admin). */
export function uniformRoutes(uniforms: UniformPort): Router {
  const router = Router();
  const admin = [requireAuth, requireRole('admin')];

  router.get('/uniforms', ...admin, (_req, res) => {
    res.json(uniforms.listUniforms());
  });

  router.post('/uniforms', ...admin, (req, res) => {
    const body = jsonBody<Partial<CreateUniformInput>>(req);
    res.json(
      uniforms.createUniform({
        name: String(body.name ?? ''),
        kind: body.kind ?? 'camiseta',
        variant: body.variant,
        price: Number(body.price ?? 0),
        stock: body.stock !== undefined ? Number(body.stock) : undefined,
        minStock: body.minStock !== undefined ? Number(body.minStock) : undefined,
      }),
    );
  });

  router.put('/uniforms/:id', ...admin, (req, res) => {
    const body = jsonBody<UpdateUniformInput>(req);
    res.json(uniforms.updateUniform(paramId(req), body));
  });

  router.delete('/uniforms/:id', ...admin, (req, res) => {
    res.json(uniforms.removeUniform(paramId(req)));
  });

  router.get('/uniform-issues', ...admin, (req, res) => {
    const playerId = queryStr(req, 'playerId');
    res.json(uniforms.listIssues(playerId ? Number(playerId) : undefined));
  });

  router.post('/uniform-issues', ...admin, (req, res) => {
    const body = jsonBody<Partial<CreateIssueInput>>(req);
    res.json(
      uniforms.createIssue({
        playerId: Number(body.playerId),
        uniformId: Number(body.uniformId),
        size: String(body.size ?? 'M'),
        cost: body.cost !== undefined ? Number(body.cost) : undefined,
        condition: body.condition,
        notes: body.notes ?? null,
      }),
    );
  });

  router.put('/uniform-issues/:id', ...admin, (req, res) => {
    const body = jsonBody<UpdateIssueInput>(req);
    res.json(uniforms.updateIssue(paramId(req), body));
  });

  router.get('/uniform-requests', ...admin, (req, res) => {
    const status = queryStr(req, 'status');
    if (status && !['pendiente', 'aprobada', 'rechazada', 'entregada'].includes(status)) {
      throw new ValidationError('Estado de solicitud inválido');
    }
    res.json(uniforms.listRequests(status as UniformRequestStatus | undefined));
  });

  router.put('/uniform-requests/:id', ...admin, (req, res) => {
    const body = jsonBody<Partial<UpdateRequestInput>>(req);
    if (!body.status) throw new ValidationError('Debes indicar el nuevo estado de la solicitud');
    res.json(
      uniforms.updateRequest(paramId(req), {
        status: body.status,
        reviewNotes: body.reviewNotes ?? null,
      }),
    );
  });

  return router;
}
