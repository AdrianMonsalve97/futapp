import type { Database } from 'better-sqlite3';
import type { RefereeRepository } from '../../../../application/ports/out/referee.repository';
import { asAsyncDatabase, type ApplicationDatabase } from '../async-database';
import type { RefereeCreditTransfer } from '../../../../domain/referee-credit';
export class SqliteRefereeRepository implements RefereeRepository {
  private db: ApplicationDatabase;
  constructor(db: Database | ApplicationDatabase) { this.db=asAsyncDatabase(db); }
  async find(matchId: number) { return await this.db.prepare('SELECT match_id AS matchId,total,settled_shares AS settledShares FROM match_referee_fees WHERE match_id=?').get(matchId)??null; }
  async list() { return await this.db.prepare('SELECT match_id AS matchId,total,settled_shares AS settledShares FROM match_referee_fees ORDER BY match_id').all(); }
  async attendance() {
    const players=await this.db.prepare('SELECT p.id AS playerId,u.full_name AS playerName FROM players p JOIN users u ON u.id=p.user_id WHERE u.active=1 ORDER BY p.position,u.full_name').all();
    const statuses=await this.db.prepare('SELECT match_id AS matchId,player_id AS playerId,status FROM match_attendance').all();
    const enrollments=await this.db.prepare('SELECT tournament_id AS tournamentId,player_id AS playerId FROM tournament_players').all();
    return {players,statuses,enrollments};
  }
  async create(matchId: number,total: number) { await this.db.prepare('INSERT OR IGNORE INTO match_referee_fees(match_id,total) VALUES(?,?)').run(matchId,total); }
  async settle(matchId: number,shares: string) { await this.db.prepare('UPDATE match_referee_fees SET settled_shares=? WHERE match_id=?').run(shares,matchId); }
  async transfers() {return await this.db.prepare('SELECT receipt_id AS receiptId,match_id AS matchId,amount FROM match_referee_transfers ORDER BY match_id,receipt_id').all();}
  async saveTransfers(matchId:number,transfers:RefereeCreditTransfer[]) {
    await this.db.prepare('DELETE FROM match_referee_transfers WHERE match_id=?').run(matchId);
    for(const transfer of transfers)await this.db.prepare('INSERT INTO match_referee_transfers(receipt_id,match_id,amount) VALUES(?,?,?)').run(transfer.receiptId,matchId,transfer.amount);
  }
}
