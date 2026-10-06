import type { AiPort } from '../ports/in/ai.port';
import type { DashboardPort } from '../ports/in/dashboard.port';
import type { StatsPort } from '../ports/in/stats.port';
import type { InscriptionRepository } from '../ports/out/inscription.repository';
import type { MatchRepository } from '../ports/out/match.repository';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { SanctionRepository } from '../ports/out/sanction.repository';
import type { StatsRepository } from '../ports/out/stats.repository';
import type { UniformIssueRepository } from '../ports/out/uniform-issue.repository';
import type { UniformRequestRepository } from '../ports/out/uniform-request.repository';
import type { UniformRepository } from '../ports/out/uniform.repository';
import type { UserRepository } from '../ports/out/user.repository';
import type { DashboardAdmin, DashboardPlayer, Inscription } from '../../domain/entities';
import { NotFoundError } from '../../domain/errors';
import { deriveInscriptionStatus, emptyStatsSummary, summarizeStats } from './shared';

const UPCOMING = new Set(['programado', 'pospuesto']);

export class DashboardService implements DashboardPort {
  constructor(
    private readonly users: UserRepository,
    private readonly players: PlayerRepository,
    private readonly inscriptions: InscriptionRepository,
    private readonly sanctions: SanctionRepository,
    private readonly uniforms: UniformRepository,
    private readonly uniformRequests: UniformRequestRepository,
    private readonly uniformIssues: UniformIssueRepository,
    private readonly matches: MatchRepository,
    private readonly stats: StatsRepository,
    private readonly teamStatsService: StatsPort,
    private readonly ai: AiPort,
  ) {}

  admin(): DashboardAdmin {
    const playerRows = this.players.list();
    const allInscriptions = this.inscriptions.list();
    const derived = allInscriptions.map((i) => ({
      ...i,
      status: deriveInscriptionStatus(i.paid, i.amount),
    }));

    const season = this.currentSeason(derived);
    const seasonRows = derived.filter((i) => i.season === season);

    const upcoming = this.nextMatch();
    const seen = new Set<number>();
    const pendingInscriptionPlayers = derived
      .filter((i) => i.status !== 'pagada')
      .filter((i) => {
        if (seen.has(i.playerId)) return false;
        seen.add(i.playerId);
        return true;
      })
      .map((i) => ({
        playerId: i.playerId,
        playerName: i.playerName ?? `Jugador ${i.playerId}`,
        amount: i.amount,
        paid: i.paid,
        dueDate: i.dueDate,
      }));

    return {
      playersCount: playerRows.length,
      activePlayers: playerRows.filter((r) => r.user.active).length,
      inscriptions: {
        season,
        total: seasonRows.reduce((acc, i) => acc + i.amount, 0),
        collected: seasonRows.reduce((acc, i) => acc + i.paid, 0),
        pending: seasonRows.reduce((acc, i) => acc + Math.max(0, i.amount - i.paid), 0),
        paidCount: seasonRows.filter((i) => i.status === 'pagada').length,
        pendingCount: seasonRows.filter((i) => i.status !== 'pagada').length,
      },
      nextMatch: upcoming,
      recentSanctions: this.sanctions.list().slice(0, 5),
      pendingUniformRequests: this.uniformRequests.list('pendiente').length,
      lowStockUniforms: this.uniforms.list().filter((u) => u.stock <= u.minStock),
      teamStats: this.teamStatsService.teamStats(),
      pendingInscriptionPlayers,
    };
  }

  player(userId: number): DashboardPlayer {
    const user = this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');
    const player = this.players.findByUserId(userId);

    if (!player) {
      return {
        inscription: null,
        upcomingMatch: this.upcomingMatchWithSlot(null),
        myStats: emptyStatsSummary(),
        myRecentStats: [],
        mySanctions: [],
        uniforms: { issued: [], pendingRequests: 0 },
        forecast: null,
      };
    }

    const stats = this.stats.list({ playerId: player.id });
    const inscription = this.inscriptions.findByPlayer(player.id)[0] ?? null;
    const insight = this.ai.playerInsight(player.id);

    return {
      inscription: inscription
        ? { ...inscription, status: deriveInscriptionStatus(inscription.paid, inscription.amount) }
        : null,
      upcomingMatch: this.upcomingMatchWithSlot(player.id),
      myStats: summarizeStats(stats),
      myRecentStats: stats.slice(-5),
      mySanctions: this.sanctions.list({ playerId: player.id }),
      uniforms: {
        issued: this.uniformIssues.list(player.id),
        pendingRequests: this.uniformRequests.list('pendiente', player.id).length,
      },
      forecast:
        insight.forecast.history.length > 0
          ? {
              nextRating: insight.forecast.nextRating,
              confidence: insight.forecast.confidence,
              trend: insight.forecast.trend,
            }
          : null,
    };
  }

  private nextMatch() {
    return (
      this.matches
        .list()
        .filter((m) => UPCOMING.has(m.status))
        .sort((a, b) => a.kickOff.localeCompare(b.kickOff))[0] ?? null
    );
  }

  private upcomingMatchWithSlot(playerId: number | null) {
    const match = this.nextMatch();
    if (!match) return null;
    const lineup = this.matches.getLineup(match.id);
    const lineupSlot = playerId !== null ? lineup.find((s) => s.playerId === playerId) ?? null : null;
    return { ...match, lineupSlot };
  }

  private currentSeason(rows: Inscription[]): string {
    const currentYear = String(new Date().getFullYear());
    const seasons = [...new Set(rows.map((r) => r.season))].sort();
    if (seasons.includes(currentYear)) return currentYear;
    return seasons.length > 0 ? (seasons[seasons.length - 1] as string) : currentYear;
  }
}
