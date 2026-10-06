import type { Database } from 'better-sqlite3';
import type {
  StatEntryInput,
  StatFilter,
  StatsRepository,
} from '../../../../application/ports/out/stats.repository';
import type { MatchStat } from '../../../../domain/entities';
import { mapMatchStat, type MatchStatRow } from '../mappers';

const SELECT_STAT = `
  SELECT ms.*, u.full_name AS player_name, p.shirt_number, p.position AS player_position
  FROM match_stats ms
  JOIN players p ON p.id = ms.player_id
  JOIN users u ON u.id = p.user_id
  JOIN matches m ON m.id = ms.match_id
`;

const ORDER = `ORDER BY m.kick_off ASC, m.id ASC, p.shirt_number ASC, ms.player_id ASC`;

export class SqliteStatsRepository implements StatsRepository {
  constructor(private readonly db: Database) {}

  list(filter: StatFilter = {}): MatchStat[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter.matchId !== undefined) {
      conditions.push('ms.match_id = ?');
      params.push(filter.matchId);
    }
    if (filter.playerId !== undefined) {
      conditions.push('ms.player_id = ?');
      params.push(filter.playerId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`${SELECT_STAT} ${where} ${ORDER}`)
      .all(...params) as MatchStatRow[];
    return rows.map(mapMatchStat);
  }

  listAll(): MatchStat[] {
    const rows = this.db.prepare(`${SELECT_STAT} ${ORDER}`).all() as MatchStatRow[];
    return rows.map(mapMatchStat);
  }

  upsert(matchId: number, entries: StatEntryInput[]): MatchStat[] {
    const fields = [
      'minutes',
      'goals',
      'assists',
      'shots',
      'shots_on_target',
      'passes',
      'passes_completed',
      'tackles',
      'interceptions',
      'recoveries',
      'dribbles',
      'fouls',
      'yellow_cards',
      'red_cards',
      'rating',
    ] as const;

    const tx = this.db.transaction(() => {
      for (const entry of entries) {
        const existing = this.db
          .prepare(`SELECT id FROM match_stats WHERE match_id = ? AND player_id = ?`)
          .get(matchId, entry.playerId) as { id: number } | undefined;
        const values: Record<string, unknown> = { matchId, playerId: entry.playerId };
        for (const field of fields) {
          const camel = field.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase()) as keyof StatEntryInput;
          const value = entry[camel];
          values[field] = typeof value === 'number' ? value : this.readDefault(field, existing, matchId, entry.playerId);
        }
        if (existing) {
          const setSql = fields.map((f) => `${f} = @${f}`).join(', ');
          this.db
            .prepare(`UPDATE match_stats SET ${setSql} WHERE id = @id`)
            .run({ ...values, id: existing.id });
        } else {
          const cols = ['match_id', 'player_id', ...fields].join(', ');
          const params = ['matchId', 'playerId', ...fields].map((f) => `@${f}`).join(', ');
          this.db.prepare(`INSERT INTO match_stats (${cols}) VALUES (${params})`).run(values);
        }
      }
    });
    tx();
    return this.list({ matchId });
  }

  /** Cuando el payload no trae un campo numérico: conserva el valor previo o el default del DDL. */
  private readDefault(field: string, existing: { id: number } | undefined, matchId: number, playerId: number): number {
    if (existing) {
      const row = this.db
        .prepare(`SELECT ${field} AS value FROM match_stats WHERE id = ?`)
        .get(existing.id) as { value: number };
      return row.value;
    }
    if (field === 'rating') return 6.0;
    return 0;
  }
}
