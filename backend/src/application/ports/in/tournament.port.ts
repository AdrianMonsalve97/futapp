import type { Tournament, TournamentRoster } from '../../../domain/tournament';
import type { TournamentInput } from '../out/tournament.repository';
export interface TournamentPort {
  roster(id: number, admin: boolean, userId: number): TournamentRoster;
  addPlayers(id: number, playerIds: number[]): void;
  removePlayer(id: number, playerId: number): void;
  list(admin: boolean): Tournament[];
  get(id: number, admin: boolean): Tournament;
  save(id: number | null, input: TournamentInput): Tournament;
}
