import { Router } from 'express';
import type { DashboardPort } from '../../../../application/ports/in/dashboard.port';
import { getAuth, requireAuth, requireRole } from '../middleware/auth';

/** §7.9 · Dashboards de admin y jugador. */
export function dashboardRoutes(dashboard: DashboardPort): Router {
  const router = Router();

  router.get('/dashboard/admin', requireAuth, requireRole('admin'), async (_req, res) => {
    res.json((await dashboard.admin()));
  });

  router.get('/dashboard/player', requireAuth, async (req, res) => {
    res.json((await dashboard.player(getAuth(req).userId)));
  });

  return router;
}
