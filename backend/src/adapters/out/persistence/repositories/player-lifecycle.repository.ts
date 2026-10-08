import type { Database } from 'better-sqlite3';
import type { PlayerLifecycleRepository } from '../../../../application/ports/out/player-lifecycle.repository';
import { parseSettledShares } from '../../../../domain/referee';
import { asAsyncDatabase, type ApplicationDatabase } from '../async-database';

export class SqlitePlayerLifecycleRepository implements PlayerLifecycleRepository {
  private readonly db: ApplicationDatabase;
  constructor(db: Database | ApplicationDatabase) { this.db = asAsyncDatabase(db); }

  async purge(playerId: number, userId: number): Promise<void> {
    // Historic charges for the other players stay unchanged; erase the departing member's share.
    const fees = await this.db.prepare('SELECT match_id,total,settled_shares FROM match_referee_fees WHERE settled_shares IS NOT NULL').all();
    for (const fee of fees) {
      const shares = parseSettledShares(fee.settled_shares, fee.total);
      const removed = shares.find(share => share.playerId === playerId);
      if (removed) await this.db.prepare('UPDATE match_referee_fees SET total=?,settled_shares=? WHERE match_id=?')
        .run(fee.total - removed.amount, JSON.stringify(shares.filter(share => share.playerId !== playerId)), fee.match_id);
    }
    await this.db.prepare('DELETE FROM payment_receipts WHERE player_id=?').run(playerId);
    await this.db.prepare('UPDATE payment_receipts SET reviewed_by=NULL WHERE reviewed_by=?').run(userId);
    await this.db.prepare('DELETE FROM uniform_requests WHERE player_id=?').run(playerId);
    // Shared club files uploaded by an administrator belong to the club, not their player profile.
    await this.db.prepare(`UPDATE media_assets SET owner_id=(SELECT id FROM users WHERE role='admin' AND active=1 AND id<>? ORDER BY id LIMIT 1)
      WHERE owner_id=? AND purpose NOT IN ('avatar','receipt')`).run(userId, userId);
    await this.db.prepare(`INSERT INTO media_deletion_jobs(asset_id,stored_name)
      SELECT id,stored_name FROM media_assets WHERE owner_id=? AND purpose IN ('avatar','receipt')
      ON CONFLICT(asset_id) DO NOTHING`).run(userId);
    await this.db.prepare("DELETE FROM media_assets WHERE owner_id=? AND purpose IN ('avatar','receipt')").run(userId);
    // The published formation keeps its geometry; the vacant slot is available for a replacement.
    await this.db.prepare('DELETE FROM users WHERE id=?').run(userId);
  }
  async pendingFiles() {
    return await this.db.prepare('SELECT asset_id AS assetId,stored_name AS storedName FROM media_deletion_jobs ORDER BY asset_id LIMIT 100').all() as {assetId:string;storedName:string}[];
  }
  async completeFile(assetId: string) { await this.db.prepare('DELETE FROM media_deletion_jobs WHERE asset_id=?').run(assetId); }
}
