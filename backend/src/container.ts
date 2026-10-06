/**
 * Composition root (§2 del SPEC): único punto que instancia clases concretas
 * (repositorios → servicios → rutas vía `createHttpServer`).
 */
import { FileModelStore } from './adapters/out/persistence/model-store';
import { getDb } from './adapters/out/persistence/database';
import { SqliteInscriptionRepository } from './adapters/out/persistence/repositories/inscription.repository';
import { SqliteMatchRepository } from './adapters/out/persistence/repositories/match.repository';
import { SqlitePlayerRepository } from './adapters/out/persistence/repositories/player.repository';
import { SqliteSanctionRepository } from './adapters/out/persistence/repositories/sanction.repository';
import { SqliteSettingsRepository } from './adapters/out/persistence/repositories/settings.repository';
import { SqliteStatsRepository } from './adapters/out/persistence/repositories/stats.repository';
import { SqliteUniformIssueRepository } from './adapters/out/persistence/repositories/uniform-issue.repository';
import { SqliteUniformRequestRepository } from './adapters/out/persistence/repositories/uniform-request.repository';
import { SqliteUniformRepository } from './adapters/out/persistence/repositories/uniform.repository';
import { SqliteUserRepository } from './adapters/out/persistence/repositories/user.repository';
import { AiService } from './application/services/ai-service';
import { AuthService } from './application/services/auth-service';
import { DashboardService } from './application/services/dashboard-service';
import { InscriptionService } from './application/services/inscription-service';
import { MatchService } from './application/services/match-service';
import { MeService } from './application/services/me-service';
import { PlayerService } from './application/services/player-service';
import { SanctionService } from './application/services/sanction-service';
import { SettingsService } from './application/services/settings-service';
import { StatsService } from './application/services/stats-service';
import { UniformService } from './application/services/uniform-service';

export interface Container {
  authService: AuthService;
  meService: MeService;
  playerService: PlayerService;
  inscriptionService: InscriptionService;
  uniformService: UniformService;
  matchService: MatchService;
  sanctionService: SanctionService;
  statsService: StatsService;
  aiService: AiService;
  dashboardService: DashboardService;
  settingsService: SettingsService;
}

export function createContainer(): Container {
  const db = getDb();

  // Adaptadores de salida (repositorios)
  const users = new SqliteUserRepository(db);
  const players = new SqlitePlayerRepository(db);
  const inscriptions = new SqliteInscriptionRepository(db);
  const uniforms = new SqliteUniformRepository(db);
  const uniformIssues = new SqliteUniformIssueRepository(db);
  const uniformRequests = new SqliteUniformRequestRepository(db);
  const matches = new SqliteMatchRepository(db);
  const sanctions = new SqliteSanctionRepository(db);
  const stats = new SqliteStatsRepository(db);
  const settings = new SqliteSettingsRepository(db);
  const modelStore = new FileModelStore();

  // Servicios de casos de uso
  const statsService = new StatsService(stats);
  const settingsService = new SettingsService(settings);
  const aiService = new AiService(
    stats,
    matches,
    players,
    sanctions,
    inscriptions,
    uniforms,
    uniformRequests,
    modelStore,
    settings,
  );
  const authService = new AuthService(users, players);
  const meService = new MeService(
    users,
    players,
    inscriptions,
    uniformIssues,
    uniformRequests,
    uniforms,
    sanctions,
    stats,
    matches,
    aiService,
  );
  const playerService = new PlayerService(
    users,
    players,
    inscriptions,
    uniformIssues,
    sanctions,
    stats,
    aiService,
  );
  const inscriptionService = new InscriptionService(inscriptions, players);
  const uniformService = new UniformService(uniforms, uniformIssues, uniformRequests, players);
  const matchService = new MatchService(matches, players, stats, aiService, settings);
  const sanctionService = new SanctionService(sanctions, players);
  const dashboardService = new DashboardService(
    users,
    players,
    inscriptions,
    sanctions,
    uniforms,
    uniformRequests,
    uniformIssues,
    matches,
    stats,
    statsService,
    aiService,
  );

  return {
    authService,
    meService,
    playerService,
    inscriptionService,
    uniformService,
    matchService,
    sanctionService,
    statsService,
    aiService,
    dashboardService,
    settingsService,
  };
}
