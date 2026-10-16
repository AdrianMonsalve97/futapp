import type { SquadMember } from '../../../domain/squad';
import type { MatchStat, TeamStats } from '../../../domain/entities';

/** Casos de uso de estadísticas (§7.8). */
export interface StatsPort {
  squad(tournamentId: number | undefined, admin: boolean): Promise<SquadMember[]>;
  list(filter?: { matchId?: number; playerId?: number }): Promise<MatchStat[]>;
  teamStats(): Promise<TeamStats>;
}
