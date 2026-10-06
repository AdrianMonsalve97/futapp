import type { Database } from 'better-sqlite3';
import type { SettingsRepository, TeamSettingsData } from '../../../../application/ports/out/settings.repository';
import { isTeamFormat } from '../../../../domain/formats';

/**
 * Repositorio SQLite de `team_settings` (fila única id = 1, §12.3).
 * La migración defensiva de `migrate.ts` crea la tabla y la fila por defecto;
 * aquí se garantiza igualmente que exista por robustez.
 */
export class SqliteSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Database) {}

  get(): TeamSettingsData {
    const row = this.db
      .prepare(`SELECT team_name, format, season FROM team_settings WHERE id = 1`)
      .get() as { team_name: string; format: number; season: string } | undefined;
    if (!row) {
      // Fila ausente: la crea con los defaults del SPEC (formato 8, §12.6).
      this.db
        .prepare(
          `INSERT OR IGNORE INTO team_settings (id, team_name, format, season) VALUES (1, 'Club Portal', 8, '2026')`,
        )
        .run();
      return { teamName: 'Club Portal', format: 8, season: '2026' };
    }
    return {
      teamName: row.team_name,
      format: isTeamFormat(row.format) ? row.format : 11,
      season: row.season,
    };
  }

  update(patch: Partial<TeamSettingsData>): TeamSettingsData {
    const current = this.get();
    const next: TeamSettingsData = {
      teamName: patch.teamName ?? current.teamName,
      format: patch.format ?? current.format,
      season: patch.season ?? current.season,
    };
    this.db
      .prepare(
        `UPDATE team_settings
            SET team_name = @teamName, format = @format, season = @season,
                updated_at = datetime('now')
          WHERE id = 1`,
      )
      .run({ teamName: next.teamName, format: next.format, season: next.season });
    return next;
  }
}
