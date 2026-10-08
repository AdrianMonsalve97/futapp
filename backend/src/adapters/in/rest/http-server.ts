import express from 'express';
import type { MigrationPort } from '../../../application/ports/in/migration.port';
import { migrationRoutes } from './routes/migration.routes';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
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
import { sessionMiddleware } from './middleware/auth';
import { loginLimit,requestLimit } from './middleware/login-limit';
import { allowedOrigin,browserSecurity } from './middleware/browser-security';

import type { TournamentPort } from '../../../application/ports/in/tournament.port';
import type { MediaService } from '../../../application/services/media-service';
import { tournamentRoutes } from './routes/tournaments.routes';
import { mediaRoutes, brandingRoutes } from './routes/media.routes';
import type { QrPaymentService } from '../../../application/services/qr-payment-service';
import { qrPaymentRoutes } from './routes/qr-payments.routes';
import type { NotificationService } from '../../../application/services/notification-service';
import { notificationRoutes } from './routes/notifications.routes';

export interface HttpServerDeps {
  migration?: MigrationPort;
  notifications: NotificationService;
  qrPayments: QrPaymentService;
  tournaments: TournamentPort;
  media: MediaService;
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
  if (env.production) app.set('trust proxy', 1);
  app.use(helmet({contentSecurityPolicy:{directives:{frameSrc:["'self'",'https://www.youtube-nocookie.com'],objectSrc:["'none'"],baseUri:["'self'"],formAction:["'self'"]}}}));
  app.use(cors((req,callback)=>callback(null,{origin:typeof req.headers.origin==='string'&&allowedOrigin(req as express.Request,req.headers.origin),credentials:true})));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api',browserSecurity);
  app.use('/api',requestLimit(600,60000));
  app.use('/api/auth/register',requestLimit(15,3600000));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth/login', loginLimit());
  app.use('/api/auth/register', loginLimit());
  app.use('/api/auth/invitation', loginLimit());
  app.use('/api/me/password',loginLimit());
  app.use('/api', brandingRoutes(deps.media));
  app.use('/api', sessionMiddleware(deps.auth));

  app.use('/api', authRoutes(deps.auth));
  app.use('/api', tournamentRoutes(deps.tournaments));
  app.use('/api', mediaRoutes(deps.media));
  app.use('/api', qrPaymentRoutes(deps.qrPayments));
  app.use('/api', notificationRoutes(deps.notifications));
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
  if (deps.migration) { app.use('/api/migration', requestLimit(10,60000)); app.use('/api', migrationRoutes(deps.migration)); }

  // One origin in production: compiled React assets and API share a service.
  if (env.production) {
    const webDirectory = path.resolve(process.cwd(), '../frontend/dist');
    if (fs.existsSync(path.join(webDirectory, 'index.html'))) {
      app.use(express.static(webDirectory, { index: false }));
      app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api') && !path.extname(req.path) && req.accepts('html')) {
          res.sendFile(path.join(webDirectory, 'index.html'));
        } else next();
      });
    }
  }

  // 404 (middleware, no app.get('*'): Express 5 ya no soporta '*')
  app.use(notFoundHandler);
  // Único manejador de errores, registrado al final.
  app.use(errorHandler);

  return app;
}
