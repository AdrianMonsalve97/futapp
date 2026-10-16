import type { LeagueConfig } from "../../../domain/standings";
export interface LeagueRepository {
  get(tournamentId: number): Promise<LeagueConfig>;
  save(tournamentId: number, config: LeagueConfig): Promise<void>;
}
