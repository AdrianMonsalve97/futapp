import type { Database } from 'better-sqlite3';
import type {
  CreateUniformIssueInput,
  UniformIssueRepository,
  UpdateUniformIssueInput,
} from '../../../../application/ports/out/uniform-issue.repository';
import type { UniformIssue } from '../../../../domain/entities';
import { mapUniformIssue, type UniformIssueRow } from '../mappers';

const SELECT_ISSUE = `
  SELECT ui.*, u.full_name AS player_name, f.name AS uniform_name, f.kind, f.variant
  FROM uniform_issues ui
  JOIN players p ON p.id = ui.player_id
  JOIN users u ON u.id = p.user_id
  JOIN uniforms f ON f.id = ui.uniform_id
`;

export class SqliteUniformIssueRepository implements UniformIssueRepository {
  constructor(private readonly db: Database) {}

  list(playerId?: number): UniformIssue[] {
    const where = playerId !== undefined ? 'WHERE ui.player_id = ?' : '';
    const rows = this.db
      .prepare(`${SELECT_ISSUE} ${where} ORDER BY ui.issued_at DESC, ui.id DESC`)
      .all(...(playerId !== undefined ? [playerId] : [])) as UniformIssueRow[];
    return rows.map(mapUniformIssue);
  }

  findById(id: number): UniformIssue | null {
    const row = this.db.prepare(`${SELECT_ISSUE} WHERE ui.id = ?`).get(id) as
      | UniformIssueRow
      | undefined;
    return row ? mapUniformIssue(row) : null;
  }

  create(input: CreateUniformIssueInput): UniformIssue {
    const result = this.db
      .prepare(
        `INSERT INTO uniform_issues (player_id, uniform_id, size, cost, condition, notes)
         VALUES (@playerId, @uniformId, @size, @cost, @condition, @notes)`,
      )
      .run({
        playerId: input.playerId,
        uniformId: input.uniformId,
        size: input.size,
        cost: input.cost ?? 0,
        condition: input.condition ?? 'nuevo',
        notes: input.notes ?? null,
      });
    return this.findById(Number(result.lastInsertRowid)) as UniformIssue;
  }

  update(id: number, input: UpdateUniformIssueInput): UniformIssue {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };
    const set = (column: string, key: string, value: unknown) => {
      fields.push(`${column} = @${key}`);
      params[key] = value;
    };
    if (input.returned !== undefined) set('returned', 'returned', input.returned ? 1 : 0);
    if (input.condition !== undefined) set('condition', 'condition', input.condition);
    if (input.notes !== undefined) set('notes', 'notes', input.notes);
    if (fields.length > 0) {
      this.db.prepare(`UPDATE uniform_issues SET ${fields.join(', ')} WHERE id = @id`).run(params);
    }
    return this.findById(id) as UniformIssue;
  }
}
