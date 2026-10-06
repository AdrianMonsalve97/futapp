import { Router } from 'express';
import type {
  SettingsPort,
  SettingsUpdateInput,
} from '../../../../application/ports/in/settings.port';
import { requireAuth, requireRole } from '../middleware/auth';
import { jsonBody } from '../route-helpers';

/** §12.4 · Configuración global del equipo y catálogo de formatos/formaciones. */
export function settingsRoutes(settings: SettingsPort): Router {
  const router = Router();

  // GET /api/settings (auth) → TeamSettings con el perfil del formato
  router.get('/settings', requireAuth, (_req, res) => {
    res.json(settings.get());
  });

  // PUT /api/settings (admin) → valida format ∈ {5,7,8,11}
  router.put('/settings', requireAuth, requireRole('admin'), (req, res) => {
    const body = jsonBody<SettingsUpdateInput>(req);
    res.json(settings.update(body));
  });

  // GET /api/formations (auth) → catálogo completo (4 formatos, 14 formaciones)
  router.get('/formations', requireAuth, (_req, res) => {
    res.json(settings.catalog());
  });

  return router;
}
