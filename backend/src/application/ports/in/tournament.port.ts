import type { Tournament, TournamentRoster } from '../../../domain/tournament';
import type { TournamentInput } from '../out/tournament.repository';
export interface TournamentPort {
  standings(id: number, admin: boolean): Promise<import('../../../domain/standings').LeagueView>;
  saveStandings(id: number, input: import('../../../domain/standings').LeagueConfig): Promise<import('../../../domain/standings').LeagueView>;
  roster(id: number, admin: boolean, userId: number): Promise<TournamentRoster>;
  addPlayers(id: number, playerIds: number[]): Promise<void>;
  removePlayer(id: number, playerId: number): Promise<void>;
  list(admin: boolean): Promise<Tournament[]>;
  get(id: number, admin: boolean): Promise<Tournament>;
  save(id: number | null, input: TournamentInput): Promise<Tournament>;
}
