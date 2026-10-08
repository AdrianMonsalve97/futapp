import type { Database } from 'better-sqlite3';
import type {
  CreateMatchInput,
  CreateStrategyInput,
  LineupSlotInput,
  MatchRepository,
  UpdateMatchInput,
  UpdateStrategyInput,
} from '../../../../application/ports/out/match.repository';
import type { AttendanceStatus, MatchAttendance, Position, LineupSlot, Match, Strategy } from '../../../../domain/entities';
import { getFormat } from '../../../../domain/formats';
import {
  mapLineupSlot,
  mapMatch,
  mapStrategy,
  type LineupRow,
  type MatchRow,
  type StrategyRow,
} from '../mappers';
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

export class SqliteMatchRepository implements MatchRepository {
  constructor(db: Database | ApplicationDatabase) {
      this.db = asAsyncDatabase(db);
  }

  async getPublishedLineup(matchId: number): Promise<LineupSlot[]> {
    const rows = (await this.db.prepare(`SELECT l.*, p.shirt_number, p.position AS player_position, u.full_name AS player_name
      FROM published_lineups l LEFT JOIN players p ON p.id = l.player_id LEFT JOIN users u ON u.id = p.user_id
      WHERE l.match_id = ? ORDER BY l.slot_index`).all(matchId)) as LineupRow[];
    return rows.map(mapLineupSlot);
  }

  async publishLineup(matchId: number): Promise<Match> {
    (await this.db.transaction(async () => {
            (await this.db.prepare('DELETE FROM published_lineups WHERE match_id = ?').run(matchId));
            (await this.db.prepare('INSERT INTO published_lineups SELECT match_id, slot_index, player_id, x, y, role, label FROM lineups WHERE match_id = ?').run(matchId));
            (await this.db.prepare("UPDATE matches SET lineup_published_at = ?, published_formation = formation WHERE id = ?").run(new Date().toISOString(), matchId));
          })());
    return (await this.findById(matchId)) as Match;
  }

  async unpublishLineup(matchId: number): Promise<void> {
    (await this.db.prepare('DELETE FROM published_lineups WHERE match_id = ?').run(matchId));
    (await this.db.prepare('UPDATE matches SET lineup_published_at = NULL, published_formation = NULL WHERE id = ?').run(matchId));
  }

  async listAttendance(matchId: number): Promise<MatchAttendance[]> {
    const rows = (await this.db.prepare(`SELECT p.id AS playerId, u.full_name AS playerName, p.shirt_number AS shirtNumber,
      p.position, COALESCE(a.status, 'pendiente') AS status, a.updated_at AS updatedAt
      FROM players p JOIN users u ON u.id = p.user_id
      LEFT JOIN match_attendance a ON a.player_id = p.id AND a.match_id = ?
      WHERE u.active = 1 ORDER BY p.position, u.full_name`).all(matchId)) as Array<{ playerId: number; playerName: string; shirtNumber: number | null; position: Position; status: AttendanceStatus; updatedAt: string | null }>;
    return rows.map(row => ({ ...row, eligible: row.status !== 'no_disponible', reason: row.status === 'no_disponible' ? 'No disponible' : null }));
  }

  async setAttendance(matchId: number, playerId: number, status: AttendanceStatus): Promise<void> {
    (await this.db.prepare(`INSERT INTO match_attendance (match_id, player_id, status) VALUES (?, ?, ?)
      ON CONFLICT(match_id, player_id) DO UPDATE SET status = excluded.status, updated_at = datetime('now')`).run(matchId, playerId, status));
  }

  async list(): Promise<Match[]> {
    const rows = (await this.db
          .prepare(`SELECT * FROM matches ORDER BY kick_off ASC, id ASC`)
          .all()) as MatchRow[];
    return rows.map(mapMatch);
  }

  async findById(id: number): Promise<Match | null> {
    const row = (await this.db.prepare(`SELECT * FROM matches WHERE id = ?`).get(id)) as
      | MatchRow
      | undefined;
    return row ? mapMatch(row) : null;
  }

  async create(input: CreateMatchInput): Promise<Match> {
    const result = (await this.db
          .prepare(
            `INSERT INTO matches (opponent, competition, kick_off, venue, is_home, status, formation, format, minutes, goals_for, goals_against, notes, tournament_id, tournament_rules, stream_url)
         VALUES (@opponent, @competition, @kickOff, @venue, @isHome, @status, @formation, @format, @minutes, @goalsFor, @goalsAgainst, @notes, @tournamentId, @tournamentRules, @streamUrl)`,
          )
          .run({
            tournamentId: input.tournamentId ?? null, tournamentRules: input.tournamentRules ? JSON.stringify(input.tournamentRules) : null,
            opponent: input.opponent.trim(),
            competition: input.competition?.trim() || 'Amistoso',
            kickOff: input.kickOff,
            venue: input.venue ?? null,
            isHome: input.isHome === false ? 0 : 1,
            status: input.status ?? 'programado',
            formation: input.formation ?? getFormat(input.format ?? 8).defaultFormation,
            format: input.format ?? 8,
            minutes: input.minutes ?? getFormat(input.format ?? 8).matchMinutes,
            goalsFor: input.goalsFor ?? null,
            goalsAgainst: input.goalsAgainst ?? null,
            notes: input.notes ?? null,
            streamUrl: input.streamUrl ?? null,
          }));
    return (await this.findById(Number(result.lastInsertRowid))) as Match;
  }

  async update(id: number, input: UpdateMatchInput): Promise<Match> {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };
    const set = (column: string, key: string, value: unknown) => {
      fields.push(`${column} = @${key}`);
      params[key] = value;
    };
    if (input.tournamentId !== undefined) set('tournament_id', 'tournamentId', input.tournamentId);
    if(input.streamUrl!==undefined)set('stream_url','streamUrl',input.streamUrl);
    if (input.tournamentRules !== undefined) set('tournament_rules', 'tournamentRules', input.tournamentRules ? JSON.stringify(input.tournamentRules) : null);
    if (input.opponent !== undefined) set('opponent', 'opponent', input.opponent.trim());
    if (input.competition !== undefined) set('competition', 'competition', input.competition);
    if (input.kickOff !== undefined) set('kick_off', 'kickOff', input.kickOff);
    if (input.venue !== undefined) set('venue', 'venue', input.venue);
    if (input.isHome !== undefined) set('is_home', 'isHome', input.isHome ? 1 : 0);
    if (input.status !== undefined) set('status', 'status', input.status);
    if (input.formation !== undefined) set('formation', 'formation', input.formation);
    if (input.format !== undefined) set('format', 'format', input.format);
    if (input.minutes !== undefined) set('minutes', 'minutes', input.minutes);
    if (input.goalsFor !== undefined) set('goals_for', 'goalsFor', input.goalsFor);
    if (input.goalsAgainst !== undefined) set('goals_against', 'goalsAgainst', input.goalsAgainst);
    if (input.notes !== undefined) set('notes', 'notes', input.notes);
    if (fields.length > 0) {
      (await this.db.prepare(`UPDATE matches SET ${fields.join(', ')} WHERE id = @id`).run(params));
    }
    return (await this.findById(id)) as Match;
  }

  async remove(id: number): Promise<void> {
    (await this.db.prepare(`DELETE FROM matches WHERE id = ?`).run(id));
  }

  async listStrategies(matchId: number): Promise<Strategy[]> {
    const rows = (await this.db
          .prepare(`SELECT * FROM strategies WHERE match_id = ? ORDER BY created_at ASC, id ASC`)
          .all(matchId)) as StrategyRow[];
    return rows.map(mapStrategy);
  }

  async findStrategy(id: number): Promise<Strategy | null> {
    const row = (await this.db.prepare(`SELECT * FROM strategies WHERE id = ?`).get(id)) as
      | StrategyRow
      | undefined;
    return row ? mapStrategy(row) : null;
  }

  async createStrategy(input: CreateStrategyInput): Promise<Strategy> {
    const result = (await this.db
          .prepare(
            `INSERT INTO strategies (match_id, title, kind, content) VALUES (@matchId, @title, @kind, @content)`,
          )
          .run({
            matchId: input.matchId,
            title: input.title.trim(),
            kind: input.kind,
            content: input.content,
          }));
    return (await this.findStrategy(Number(result.lastInsertRowid))) as Strategy;
  }

  async updateStrategy(id: number, input: UpdateStrategyInput): Promise<Strategy> {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };
    const set = (column: string, key: string, value: unknown) => {
      fields.push(`${column} = @${key}`);
      params[key] = value;
    };
    if (input.title !== undefined) set('title', 'title', input.title.trim());
    if (input.kind !== undefined) set('kind', 'kind', input.kind);
    if (input.content !== undefined) set('content', 'content', input.content);
    if (fields.length > 0) {
      (await this.db.prepare(`UPDATE strategies SET ${fields.join(', ')} WHERE id = @id`).run(params));
    }
    return (await this.findStrategy(id)) as Strategy;
  }

  async removeStrategy(id: number): Promise<void> {
    (await this.db.prepare(`DELETE FROM strategies WHERE id = ?`).run(id));
  }

  async getLineup(matchId: number): Promise<LineupSlot[]> {
    const rows = (await this.db
          .prepare(
            `SELECT l.*, p.shirt_number, p.position AS player_position, u.full_name AS player_name
         FROM lineups l
         LEFT JOIN players p ON p.id = l.player_id
         LEFT JOIN users u ON u.id = p.user_id
         WHERE l.match_id = ?
         ORDER BY l.slot_index ASC`,
          )
          .all(matchId)) as LineupRow[];
    return rows.map(mapLineupSlot);
  }

  async replaceLineup(matchId: number, slots: LineupSlotInput[]): Promise<LineupSlot[]> {
    const insert = this.db.prepare(
      `INSERT INTO lineups (match_id, player_id, slot_index, x, y, role, label)
       VALUES (@matchId, @playerId, @slotIndex, @x, @y, @role, @label)`,
    );
    const tx = this.db.transaction(async () => {
      (await this.db.prepare(`DELETE FROM lineups WHERE match_id = ?`).run(matchId));
      for (const slot of slots) {
        (await insert.run({
                    matchId,
                    playerId: slot.playerId,
                    slotIndex: slot.slotIndex,
                    x: slot.x,
                    y: slot.y,
                    role: slot.role,
                    label: slot.label,
                  }));
      }
    });
    (await tx());
    return (await this.getLineup(matchId));
  }

    private readonly db: ApplicationDatabase;
}
