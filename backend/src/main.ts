import 'dotenv/config';
import { createHttpServer } from './adapters/in/rest/http-server';
import { migrate } from './adapters/out/persistence/migrate';
import { closeDb, getDb } from './adapters/out/persistence/database';
import { ensureInitialAdmin } from './adapters/out/persistence/initial-admin';
import { env } from './config/env';
import { createContainer } from './container';

// 1) Configuración (.env) → 2) esquema SQL → 3) wiring → 4) listen
migrate();
ensureInitialAdmin(getDb());

const container = createContainer();
const app = createHttpServer({
  migration: container.migrationService,
  notifications: container.notificationService,
  qrPayments: container.qrPaymentService,
  tournaments: container.tournamentService, media: container.mediaService,
  auth: container.authService,
  me: container.meService,
  players: container.playerService,
  inscriptions: container.inscriptionService,
  uniforms: container.uniformService,
  matches: container.matchService,
  sanctions: container.sanctionService,
  stats: container.statsService,
  ai: container.aiService,
  dashboard: container.dashboardService,
  settings: container.settingsService,
});

const server = app.listen(env.port, () => {
  console.log(`⚽ API del portal de fútbol escuchando en http://localhost:${env.port}`);
});
const stopNotifications = container.notificationService.start();

const shutdown = () => { stopNotifications(); server.close(() => {
  closeDb();
  process.exit(0);
}); };
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
