import type { Database } from "better-sqlite3";
import { AppError } from "../../../../domain/errors";
import { defaultLeague, type LeagueConfig } from "../../../../domain/standings";
import type { LeagueRepository } from "../../../../application/ports/out/league.repository";
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

export class SqliteLeagueRepository implements LeagueRepository {
  private readonly db: ApplicationDatabase;
  constructor(db: Database | ApplicationDatabase) {
    this.db = asAsyncDatabase(db);
  }
  async get(id: number): Promise<LeagueConfig> {
    const row = await this.db
      .prepare(
        "SELECT version, data FROM tournament_leagues WHERE tournament_id=?",
      )
      .get(id);
    return row
      ? { ...JSON.parse(row.data), version: Number(row.version) }
      : defaultLeague();
  }
  async save(id: number, config: LeagueConfig): Promise<void> {
    // A stale browser may not overwrite another administrator's results.
    const saved = await this.db
      .prepare(
        `INSERT INTO tournament_leagues(tournament_id,version,data) VALUES(?,1,?)
      ON CONFLICT(tournament_id) DO UPDATE SET version=tournament_leagues.version+1,data=excluded.data
      WHERE tournament_leagues.version=?`,
      )
      .run(id, JSON.stringify(config), config.version);
    if (!saved.changes)
      throw new AppError(
        "La clasificación cambió en otra sesión. Recarga antes de guardar.",
        409,
      );
  }
}
