import type { Tournament, TournamentDocument, TournamentPlayer } from '../../../domain/tournament';
export type TournamentInput = Omit<Tournament, 'id' | 'updatedAt' | 'documents' | 'imageUrl'>;
export interface TournamentRepository {
  roster(id: number): Promise<TournamentPlayer[]>;
  playerIds(id: number): Promise<number[]>;
  hasPlayer(id: number, playerId: number): Promise<boolean>;
  addPlayers(id: number, playerIds: number[]): Promise<void>;
  removePlayer(id: number, playerId: number): Promise<void>;
  list(): Promise<Tournament[]>;
  find(id: number): Promise<Tournament | null>;
  setImage(id: number, assetId: string | null): Promise<void>;
  tournamentForImage(assetId: string): Promise<Tournament | null>;
  save(id: number | null, input: TournamentInput): Promise<Tournament>;
  documents(id: number): Promise<TournamentDocument[]>;
  addDocument(input: Omit<TournamentDocument, 'id' | 'createdAt'>): Promise<TournamentDocument>;
  documentForAsset(assetId: string): Promise<TournamentDocument | null>;
  findDocument(id: number): Promise<TournamentDocument | null>;
}
