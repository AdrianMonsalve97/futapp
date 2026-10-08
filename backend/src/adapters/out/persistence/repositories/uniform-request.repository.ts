import type { Database } from 'better-sqlite3';
import type {
  CreateUniformRequestInput,
  UniformRequestRepository,
  UpdateUniformRequestInput,
} from '../../../../application/ports/out/uniform-request.repository';
import type { UniformRequest, UniformRequestStatus } from '../../../../domain/entities';
import { mapUniformRequest, type UniformRequestRow } from '../mappers';
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

const SELECT_REQUEST = `
  SELECT r.*, u.full_name AS player_name, f.name AS uniform_name
  FROM uniform_requests r
  JOIN players p ON p.id = r.player_id
  JOIN users u ON u.id = p.user_id
  JOIN uniforms f ON f.id = r.uniform_id
`;

export class SqliteUniformRequestRepository implements UniformRequestRepository {
  constructor(db: Database | ApplicationDatabase) {
      this.db = asAsyncDatabase(db);
  }

  async list(status?: UniformRequestStatus, playerId?: number): Promise<UniformRequest[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (playerId !== undefined) {
      conditions.push('r.player_id = ?');
      params.push(playerId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = (await this.db
          .prepare(`${SELECT_REQUEST} ${where} ORDER BY r.created_at DESC, r.id DESC`)
          .all(...params)) as UniformRequestRow[];
    return rows.map(mapUniformRequest);
  }

  async findById(id: number): Promise<UniformRequest | null> {
    const row = (await this.db.prepare(`${SELECT_REQUEST} WHERE r.id = ?`).get(id)) as
      | UniformRequestRow
      | undefined;
    return row ? mapUniformRequest(row) : null;
  }

  async create(input: CreateUniformRequestInput): Promise<UniformRequest> {
    const result = (await this.db
          .prepare(
            `INSERT INTO uniform_requests (player_id, uniform_id, size, reason, quoted_price)
         VALUES (@playerId, @uniformId, @size, @reason, (SELECT price FROM uniforms WHERE id=@uniformId))`,
          )
          .run({
            playerId: input.playerId,
            uniformId: input.uniformId,
            size: input.size,
            reason: input.reason ?? null,
          }));
    return (await this.findById(Number(result.lastInsertRowid))) as UniformRequest;
  }

  async update(id: number, input: UpdateUniformRequestInput): Promise<UniformRequest> {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };
    const set = (column: string, key: string, value: unknown) => {
      fields.push(`${column} = @${key}`);
      params[key] = value;
    };
    if (input.status !== undefined) set('status', 'status', input.status);
    if (input.issueId !== undefined) set('issue_id', 'issueId', input.issueId);
    if (input.reviewNotes !== undefined) set('review_notes', 'reviewNotes', input.reviewNotes);
    if (input.reviewedAt !== undefined) set('reviewed_at', 'reviewedAt', input.reviewedAt);
    if (fields.length > 0) {
      (await this.db.prepare(`UPDATE uniform_requests SET ${fields.join(', ')} WHERE id = @id`).run(params));
    }
    return (await this.findById(id)) as UniformRequest;
  }

    private readonly db: ApplicationDatabase;
}
