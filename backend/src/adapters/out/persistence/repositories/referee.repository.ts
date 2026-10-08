import type { Database } from 'better-sqlite3';
import type { RefereeRepository } from '../../../../application/ports/out/referee.repository';
import { asAsyncDatabase, type ApplicationDatabase } from '../async-database';
export class SqliteRefereeRepository implements RefereeRepository {
  private db: ApplicationDatabase;
  constructor(db: Database | ApplicationDatabase) { this.db=asAsyncDatabase(db); }
  async find(matchId: number) { return await this.db.prepare('SELECT match_id AS matchId,total,settled_shares AS settledShares FROM match_referee_fees WHERE match_id=?').get(matchId)??null; }
  async list() { return await this.db.prepare('SELECT match_id AS matchId,total FROM match_referee_fees ORDER BY match_id').all(); }
  async create(matchId: number,total: number) { await this.db.prepare('INSERT OR IGNORE INTO match_referee_fees(match_id,total) VALUES(?,?)').run(matchId,total); }
  async settle(matchId: number,shares: string) { await this.db.prepare('UPDATE match_referee_fees SET settled_shares=? WHERE match_id=?').run(shares,matchId); }
}
