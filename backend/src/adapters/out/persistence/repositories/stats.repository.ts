import type { Database } from 'better-sqlite3';
import type {
  StatEntryInput,
  StatFilter,
  StatsRepository,
} from '../../../../application/ports/out/stats.repository';
import type { SquadIdentity, PerformanceEntry } from '../../../../domain/squad';
import type { MatchStat } from '../../../../domain/entities';
import { mapMatchStat, type MatchStatRow } from '../mappers';
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

const SELECT_STAT = `
  SELECT ms.*, u.full_name AS player_name, p.shirt_number, p.position AS player_position
  FROM match_stats ms
  JOIN players p ON p.id = ms.player_id
  JOIN users u ON u.id = p.user_id
  JOIN matches m ON m.id = ms.match_id
`;

const ORDER = `ORDER BY m.kick_off ASC, m.id ASC, p.shirt_number ASC, ms.player_id ASC`;

export class SqliteStatsRepository implements StatsRepository {
  constructor(db: Database | ApplicationDatabase) {
      this.db = asAsyncDatabase(db);
  }

  async squadPlayers(tournamentId?: number): Promise<SquadIdentity[]> {
    return await this.db.prepare(`SELECT p.id AS "playerId", u.full_name AS name, p.shirt_number AS "shirtNumber",
      p.position, p.secondary_position AS "secondaryPosition", u.avatar_url AS "avatarUrl"
      FROM players p JOIN users u ON u.id=p.user_id
      WHERE u.active=1 AND NOT EXISTS(SELECT 1 FROM registration_requests r WHERE r.user_id=u.id AND r.status='pendiente')
      ${tournamentId === undefined ? '' : 'AND EXISTS(SELECT 1 FROM tournament_players tp WHERE tp.player_id=p.id AND tp.tournament_id=?)'}
      ORDER BY u.full_name, p.id`).all(...(tournamentId === undefined ? [] : [tournamentId])) as SquadIdentity[];
  }

  async playedStats(tournamentId: number | undefined, admin: boolean): Promise<PerformanceEntry[]> {
    const rows = await this.db.prepare(`${SELECT_STAT.replace('SELECT ms.*,', 'SELECT m.opponent, m.kick_off, ms.*,')}
      WHERE m.status='jugado' ${tournamentId === undefined ? '' : 'AND m.tournament_id=?'}
      ${admin ? '' : "AND (m.tournament_id IS NULL OR EXISTS(SELECT 1 FROM tournaments t WHERE t.id=m.tournament_id AND t.status!='borrador'))"}
      ${ORDER}`).all(...(tournamentId === undefined ? [] : [tournamentId])) as (MatchStatRow & {opponent:string;kick_off:string})[];
    return rows.map(row => ({...mapMatchStat(row),opponent:row.opponent,kickOff:row.kick_off}));
  }

  async list(filter: StatFilter = {}): Promise<MatchStat[]> {
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
    const rows = (await this.db
          .prepare(`${SELECT_STAT} ${where} ${ORDER}`)
          .all(...params)) as MatchStatRow[];
    return rows.map(mapMatchStat);
  }

  async listAll(): Promise<MatchStat[]> {
    const rows = (await this.db.prepare(`${SELECT_STAT} ${ORDER}`).all()) as MatchStatRow[];
    return rows.map(mapMatchStat);
  }

  async upsert(matchId: number, entries: StatEntryInput[]): Promise<MatchStat[]> {
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

    const tx = this.db.transaction(async () => {
      for (const entry of entries) {
        const existing = (await this.db
                  .prepare(`SELECT id FROM match_stats WHERE match_id = ? AND player_id = ?`)
                  .get(matchId, entry.playerId)) as { id: number } | undefined;
        const values: Record<string, unknown> = { matchId, playerId: entry.playerId };
        for (const field of fields) {
          const camel = field.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase()) as keyof StatEntryInput;
          const value = entry[camel];
          values[field] = typeof value === 'number' ? value : (await this.readDefault(field, existing, matchId, entry.playerId));
        }
        if (existing) {
          const setSql = fields.map((f) => `${f} = @${f}`).join(', ');
          (await this.db
                        .prepare(`UPDATE match_stats SET ${setSql} WHERE id = @id`)
                        .run({ ...values, id: existing.id }));
        } else {
          const cols = ['match_id', 'player_id', ...fields].join(', ');
          const params = ['matchId', 'playerId', ...fields].map((f) => `@${f}`).join(', ');
          (await this.db.prepare(`INSERT INTO match_stats (${cols}) VALUES (${params})`).run(values));
        }
      }
    });
    (await tx());
    return (await this.list({ matchId }));
  }

  /** Cuando el payload no trae un campo numérico: conserva el valor previo o el default del DDL. */
  private async readDefault(field: string, existing: { id: number } | undefined, matchId: number, playerId: number): Promise<number> {
    if (existing) {
      const row = (await this.db
              .prepare(`SELECT ${field} AS value FROM match_stats WHERE id = ?`)
              .get(existing.id)) as { value: number };
      return row.value;
    }
    if (field === 'rating') return 6.0;
    return 0;
  }

    private readonly db: ApplicationDatabase;
}
