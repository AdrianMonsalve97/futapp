import type { Tournament, TournamentDocument, TournamentPlayer } from '../../../domain/tournament';
export type TournamentInput = Omit<Tournament, 'id' | 'updatedAt' | 'documents' | 'imageUrl'>;
export interface TournamentRepository {
  roster(id: number): TournamentPlayer[];
  playerIds(id: number): number[];
  hasPlayer(id: number, playerId: number): boolean;
  addPlayers(id: number, playerIds: number[]): void;
  removePlayer(id: number, playerId: number): void;
  list(): Tournament[];
  find(id: number): Tournament | null;
  setImage(id: number, assetId: string | null): void;
  tournamentForImage(assetId: string): Tournament | null;
  save(id: number | null, input: TournamentInput): Tournament;
  documents(id: number): TournamentDocument[];
  addDocument(input: Omit<TournamentDocument, 'id' | 'createdAt'>): TournamentDocument;
  documentForAsset(assetId: string): TournamentDocument | null;
  findDocument(id: number): TournamentDocument | null;
}
