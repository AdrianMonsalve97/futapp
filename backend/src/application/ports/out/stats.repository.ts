import type { SquadIdentity, PerformanceEntry } from '../../../domain/squad';
import type { MatchStat } from '../../../domain/entities';

export interface StatFilter {
  matchId?: number;
  playerId?: number;
}

export type StatEntryInput = Partial<
  Omit<MatchStat, 'id' | 'matchId' | 'playerId' | 'playerName' | 'shirtNumber' | 'position'>
> & { playerId: number };

/** Puerto de salida para las estadísticas por partido. */
export interface StatsRepository {
  squadPlayers(tournamentId?: number): Promise<SquadIdentity[]>;
  playedStats(tournamentId: number | undefined, admin: boolean): Promise<PerformanceEntry[]>;
  /** Con nombre/dorsal/posición del jugador; ordenadas por fecha de partido asc. */
  list(filter?: StatFilter): Promise<MatchStat[]>;
  listAll(): Promise<MatchStat[]>;
  /** Upsert por (match_id, player_id). */
  upsert(matchId: number, entries: StatEntryInput[]): Promise<MatchStat[]>;
}
