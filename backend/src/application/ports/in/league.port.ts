import type { LeagueConfig, LeagueView } from "../../../domain/standings";
export interface LeaguePort {
  get(tournamentId: number, admin: boolean): Promise<LeagueView>;
  save(tournamentId: number, config: LeagueConfig): Promise<LeagueView>;
}
