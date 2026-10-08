/**
 * Composition root (§2 del SPEC): único punto que instancia clases concretas
 * (repositorios → servicios → rutas vía `createHttpServer`).
 */
import { FileModelStore } from './adapters/out/persistence/model-store';
import path from 'node:path';
import { env } from './config/env';
import { FileMigrationStore } from './adapters/out/persistence/migration-store';
import { SqliteUnitOfWork } from './adapters/out/persistence/unit-of-work';
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

import { FileMediaStorage } from './adapters/out/persistence/media-storage';
import { SqliteTournamentRepository } from './adapters/out/persistence/repositories/tournament.repository';
import { TournamentService } from './application/services/tournament-service';
import { MediaService } from './application/services/media-service';
import { QrPaymentService } from './application/services/qr-payment-service';
import { RefereeService } from './application/services/referee-service';
import { SqliteRefereeRepository } from './adapters/out/persistence/repositories/referee.repository';
import { SqliteQrPaymentRepository } from './adapters/out/persistence/repositories/qr-payment.repository';
import { SqliteNotificationRepository } from './adapters/out/persistence/repositories/notification.repository';
import { ProviderNotificationTransport } from './adapters/out/notifications/provider-transport';
import { NotificationService } from './application/services/notification-service';
import type { ApplicationDatabase } from './adapters/out/persistence/async-database';
import type { MediaStorage } from './application/ports/out/media.storage';
import type { ModelStore } from './application/ports/out/model-store';
import type { MigrationPort } from './application/ports/in/migration.port';

export interface Container {
  migrationService: MigrationPort;
  notificationService: NotificationService;
  qrPaymentService: QrPaymentService;
  tournamentService: TournamentService;
  mediaService: MediaService;
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

export function createContainer(cloud?: { db:ApplicationDatabase; media:MediaStorage; model:ModelStore; migration:MigrationPort }): Container {
  const db = cloud?.db ?? getDb();
  const uow = new SqliteUnitOfWork(db);

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
  const tournaments = new SqliteTournamentRepository(db);
  const tournamentService = new TournamentService(tournaments, players, matches, uow);
  const mediaStorage = cloud?.media ?? new FileMediaStorage(db);
  const mediaService = new MediaService(mediaStorage, users, uniforms, settings, tournaments, uow);
  const modelStore = cloud?.model ?? new FileModelStore();
  const qrRepository = new SqliteQrPaymentRepository(db);
  const refereeService = new RefereeService(new SqliteRefereeRepository(db),matches,qrRepository);
  const notificationService = new NotificationService(new SqliteNotificationRepository(db), new ProviderNotificationTransport(),
    matches, users, players, settings, qrRepository, uow, Date.now, tournaments);

  // Servicios de casos de uso
  const statsService = new StatsService(stats);
  const settingsService = new SettingsService(settings, tournaments);
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
    tournaments,
    refereeService,
  );
  const authService = new AuthService(users, players, uow, new SqliteSecurityRepository(db));
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
    uow,
    refereeService,
  );
  const playerService = new PlayerService(
    users,
    players,
    inscriptions,
    uniformIssues,
    sanctions,
    stats,
    aiService,
    uow,
  );
  const inscriptionService = new InscriptionService(inscriptions, players, uow);
  const qrPaymentService = new QrPaymentService(qrRepository, mediaStorage, players, inscriptionService, uow, notificationService,refereeService);
  const uniformService = new UniformService(uniforms, uniformIssues, uniformRequests, players, uow);
  const matchService = new MatchService(matches, players, stats, aiService, settings, sanctions, uow, tournaments, refereeService,notificationService);
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
    settings,
    refereeService,
  );

  return {
    migrationService: cloud?.migration ?? new FileMigrationStore(getDb(), path.dirname(path.resolve(env.dbPath)), env.publicAppUrl),
    notificationService,
    qrPaymentService,
    tournamentService, mediaService,
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
import { SqliteSecurityRepository } from './adapters/out/persistence/repositories/security.repository';
