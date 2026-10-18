export interface RefereeRepository {
  find(matchId: number): Promise<{ matchId: number; total: number; settledShares: string | null; matchdayAccessDate: string | null } | null>;
  list(): Promise<{ matchId: number; total: number; settledShares:string|null;matchdayAccessDate:string|null }[]>;
  attendance(): Promise<{
    players:{playerId:number;playerName:string}[];
    statuses:{matchId:number;playerId:number;status:string}[];
    enrollments:{tournamentId:number;playerId:number}[];
  }>;
  setMatchdayAccess(matchId: number, date: string): Promise<void>;
  create(matchId: number, total: number): Promise<void>;
  settle(matchId: number, shares: string): Promise<void>;
  transfers(): Promise<RefereeCreditTransfer[]>;
  saveTransfers(matchId:number, transfers:RefereeCreditTransfer[]): Promise<void>;
}
import type { RefereeCreditTransfer } from '../../../domain/referee-credit';
