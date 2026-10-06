import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../../../config/env';
import type { AiPort } from '../../../application/ports/in/ai.port';
import type { AuthPort } from '../../../application/ports/in/auth.port';
import type { DashboardPort } from '../../../application/ports/in/dashboard.port';
import type { InscriptionPort } from '../../../application/ports/in/inscription.port';
import type { MatchPort } from '../../../application/ports/in/match.port';
import type { MePort } from '../../../application/ports/in/me.port';
import type { PlayerPort } from '../../../application/ports/in/player.port';
import type { SanctionPort } from '../../../application/ports/in/sanction.port';
import type { SettingsPort } from '../../../application/ports/in/settings.port';
import type { StatsPort } from '../../../application/ports/in/stats.port';
import type { UniformPort } from '../../../application/ports/in/uniform.port';
import { errorHandler, notFoundHandler } from './middleware/error';
import { aiRoutes } from './routes/ai.routes';
import { authRoutes } from './routes/auth.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { inscriptionRoutes } from './routes/inscriptions.routes';
import { matchRoutes } from './routes/matches.routes';
import { meRoutes } from './routes/me.routes';
import { playerRoutes } from './routes/players.routes';
import { sanctionRoutes } from './routes/sanctions.routes';
import { settingsRoutes } from './routes/settings.routes';
import { statsRoutes } from './routes/stats.routes';
import { uniformRoutes } from './routes/uniforms.routes';

export interface HttpServerDeps {
  auth: AuthPort;
  me: MePort;
  players: PlayerPort;
  inscriptions: InscriptionPort;
  uniforms: UniformPort;
  matches: MatchPort;
  sanctions: SanctionPort;
  stats: StatsPort;
  ai: AiPort;
  dashboard: DashboardPort;
  settings: SettingsPort;
}

/**
 * Crea la app Express 5: helmet + cors + json + rutas bajo /api +
 * 404 + único error handler central (§2 y §7 del SPEC).
 */
export function createHttpServer(deps: HttpServerDeps): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', authRoutes(deps.auth));
  app.use('/api', meRoutes(deps.me));
  app.use('/api', matchRoutes(deps.matches));
  app.use('/api', playerRoutes(deps.players));
  app.use('/api', inscriptionRoutes(deps.inscriptions));
  app.use('/api', uniformRoutes(deps.uniforms));
  app.use('/api', sanctionRoutes(deps.sanctions));
  app.use('/api', statsRoutes(deps.stats));
  app.use('/api', dashboardRoutes(deps.dashboard));
  app.use('/api', aiRoutes(deps.ai));
  app.use('/api', settingsRoutes(deps.settings));

  // 404 (middleware, no app.get('*'): Express 5 ya no soporta '*')
  app.use(notFoundHandler);
  // Único manejador de errores, registrado al final.
  app.use(errorHandler);

  return app;
}
