import type { Database } from 'better-sqlite3';
import type { Tournament, TournamentDocument, TournamentPlayer } from '../../../../domain/tournament';
import type { TournamentInput, TournamentRepository } from '../../../../application/ports/out/tournament.repository';
type Row = { id: number; name: string; league_name: string; season: string; status: Tournament['status']; rules_json: string; notes: string; updated_at: string; image_asset_id: string | null };
const map = (row: Row): Tournament => ({ imageUrl: row.image_asset_id ? '/api/media/' + row.image_asset_id : null, id: row.id, name: row.name, leagueName: row.league_name, season: row.season, status: row.status, rules: JSON.parse(row.rules_json), notes: row.notes, updatedAt: row.updated_at });
type DocRow = { id: number; tournament_id: number; title: string; asset_id: string; file_name: string; mime_type: string; extracted_text: string; extraction_status: TournamentDocument['extractionStatus']; created_at: string };
const doc = (row: DocRow): TournamentDocument => ({ id: row.id, tournamentId: row.tournament_id, title: row.title, assetId: row.asset_id, fileName: row.file_name, mimeType: row.mime_type, extractedText: row.extracted_text, extractionStatus: row.extraction_status, createdAt: row.created_at });
export class SqliteTournamentRepository implements TournamentRepository {
  constructor(private readonly db: Database) {}
  roster(id: number): TournamentPlayer[] {
    const rows = this.db.prepare(`SELECT p.id AS playerId, u.full_name AS playerName,
      p.shirt_number AS shirtNumber, p.position, p.secondary_position AS secondaryPosition,
      u.active, tp.registered_at AS registeredAt FROM tournament_players tp
      JOIN players p ON p.id=tp.player_id JOIN users u ON u.id=p.user_id
      WHERE tp.tournament_id=? ORDER BY u.full_name COLLATE NOCASE, p.id`).all(id) as Array<Omit<TournamentPlayer, 'active'> & { active: number }>;
    return rows.map(row => ({ ...row, active: Boolean(row.active) }));
  }
  playerIds(id: number): number[] {
    return (this.db.prepare('SELECT player_id FROM tournament_players WHERE tournament_id=?').all(id) as { player_id: number }[]).map(row => row.player_id);
  }
  hasPlayer(id: number, playerId: number): boolean {
    return Boolean(this.db.prepare('SELECT 1 FROM tournament_players WHERE tournament_id=? AND player_id=?').get(id, playerId));
  }
  addPlayers(id: number, playerIds: number[]): void {
    const insert = this.db.prepare('INSERT INTO tournament_players(tournament_id,player_id) VALUES (?,?) ON CONFLICT(tournament_id,player_id) DO NOTHING');
    for (const playerId of playerIds) insert.run(id, playerId);
  }
  removePlayer(id: number, playerId: number): void {
    this.db.prepare('DELETE FROM tournament_players WHERE tournament_id=? AND player_id=?').run(id, playerId);
  }
  list(): Tournament[] { return (this.db.prepare('SELECT * FROM tournaments ORDER BY updated_at DESC, id DESC').all() as Row[]).map(map); }
  setImage(id: number, assetId: string | null): void {
    this.db.prepare('UPDATE tournaments SET image_asset_id=?, updated_at=? WHERE id=?').run(assetId, new Date().toISOString(), id);
  }
  tournamentForImage(assetId: string): Tournament | null {
    const row = this.db.prepare('SELECT * FROM tournaments WHERE image_asset_id=?').get(assetId) as Row | undefined;
    return row ? map(row) : null;
  }
  find(id: number): Tournament | null {
    const row = this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id) as Row | undefined;
    return row ? { ...map(row), documents: this.documents(id) } : null;
  }
  save(id: number | null, input: TournamentInput): Tournament {
    const params = { name: input.name.trim(), league: input.leagueName.trim(), season: input.season.trim(), status: input.status, rules: JSON.stringify(input.rules), notes: input.notes.trim(), updated: new Date().toISOString() };
    if (id !== null) this.db.prepare('UPDATE tournaments SET name=@name, league_name=@league, season=@season, status=@status, rules_json=@rules, notes=@notes, updated_at=@updated WHERE id=@id').run({ ...params, id });
    else id = Number(this.db.prepare('INSERT INTO tournaments(name,league_name,season,status,rules_json,notes,updated_at) VALUES (@name,@league,@season,@status,@rules,@notes,@updated)').run(params).lastInsertRowid);
    return this.find(id)!;
  }
  documents(id: number): TournamentDocument[] { return (this.db.prepare('SELECT * FROM tournament_documents WHERE tournament_id=? ORDER BY id DESC').all(id) as DocRow[]).map(doc); }
  addDocument(input: Omit<TournamentDocument, 'id' | 'createdAt'>): TournamentDocument {
    const result = this.db.prepare('INSERT INTO tournament_documents(tournament_id,title,asset_id,file_name,mime_type,extracted_text,extraction_status) VALUES (@tournamentId,@title,@assetId,@fileName,@mimeType,@extractedText,@extractionStatus)').run(input);
    return this.findDocument(Number(result.lastInsertRowid))!;
  }
  documentForAsset(assetId: string): TournamentDocument | null { const row = this.db.prepare('SELECT * FROM tournament_documents WHERE asset_id=?').get(assetId) as DocRow | undefined; return row ? doc(row) : null; }
  findDocument(id: number): TournamentDocument | null { const row = this.db.prepare('SELECT * FROM tournament_documents WHERE id=?').get(id) as DocRow | undefined; return row ? doc(row) : null; }
}
