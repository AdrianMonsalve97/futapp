import type { Database } from 'better-sqlite3';
import type {
  CreateSanctionInput,
  SanctionFilters,
  SanctionRepository,
  UpdateSanctionInput,
} from '../../../../application/ports/out/sanction.repository';
import type { Sanction } from '../../../../domain/entities';
import { mapSanction, type SanctionRow } from '../mappers';

const SELECT_SANCTION = `
  SELECT s.*, u.full_name AS player_name
  FROM sanctions s
  JOIN players p ON p.id = s.player_id
  JOIN users u ON u.id = p.user_id
`;

export class SqliteSanctionRepository implements SanctionRepository {
  constructor(private readonly db: Database) {}

  list(filters: SanctionFilters = {}): Sanction[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.playerId !== undefined) {
      conditions.push('s.player_id = ?');
      params.push(filters.playerId);
    }
    if (filters.status) {
      conditions.push('s.status = ?');
      params.push(filters.status);
    }
    if (filters.type) {
      conditions.push('s.type = ?');
      params.push(filters.type);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`${SELECT_SANCTION} ${where} ORDER BY s.created_at DESC, s.id DESC`)
      .all(...params) as SanctionRow[];
    return rows.map(mapSanction);
  }

  findById(id: number): Sanction | null {
    const row = this.db.prepare(`${SELECT_SANCTION} WHERE s.id = ?`).get(id) as
      | SanctionRow
      | undefined;
    return row ? mapSanction(row) : null;
  }

  create(input: CreateSanctionInput): Sanction {
    const result = this.db
      .prepare(
        `INSERT INTO sanctions (player_id, match_id, type, reason, amount, points, status, match_date)
         VALUES (@playerId, @matchId, @type, @reason, @amount, @points, 'activa', @matchDate)`,
      )
      .run({
        playerId: input.playerId,
        matchId: input.matchId ?? null,
        type: input.type,
        reason: input.reason.trim(),
        amount: input.amount ?? 0,
        points: input.points ?? 0,
        matchDate: input.matchDate ?? null,
      });
    return this.findById(Number(result.lastInsertRowid)) as Sanction;
  }

  update(id: number, input: UpdateSanctionInput): Sanction {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };
    const set = (column: string, key: string, value: unknown) => {
      fields.push(`${column} = @${key}`);
      params[key] = value;
    };
    if (input.status !== undefined) set('status', 'status', input.status);
    if (input.reason !== undefined) set('reason', 'reason', input.reason.trim());
    if (input.amount !== undefined) set('amount', 'amount', input.amount);
    if (input.points !== undefined) set('points', 'points', input.points);
    if (fields.length > 0) {
      this.db.prepare(`UPDATE sanctions SET ${fields.join(', ')} WHERE id = @id`).run(params);
    }
    return this.findById(id) as Sanction;
  }

  remove(id: number): void {
    this.db.prepare(`DELETE FROM sanctions WHERE id = ?`).run(id);
  }
}
