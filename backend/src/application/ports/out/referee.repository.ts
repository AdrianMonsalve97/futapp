export interface RefereeRepository {
  find(matchId: number): Promise<{ matchId: number; total: number; settledShares: string | null } | null>;
  list(): Promise<{ matchId: number; total: number }[]>;
  create(matchId: number, total: number): Promise<void>;
  settle(matchId: number, shares: string): Promise<void>;
}
