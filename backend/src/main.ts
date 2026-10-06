import 'dotenv/config';
import { createHttpServer } from './adapters/in/rest/http-server';
import { migrate } from './adapters/out/persistence/migrate';
import { env } from './config/env';
import { createContainer } from './container';

// 1) Configuración (.env) → 2) esquema SQL → 3) wiring → 4) listen
migrate();

const container = createContainer();
const app = createHttpServer({
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

app.listen(env.port, () => {
  console.log(`⚽ API del portal de fútbol escuchando en http://localhost:${env.port}`);
});
