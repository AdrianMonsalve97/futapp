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
      .prepare(`SELECT team_name, format, season, logo_url, brand_color, default_tournament_id FROM team_settings WHERE id = 1`)
      .get() as { team_name: string; format: number; season: string; logo_url: string | null; brand_color: string; default_tournament_id: number | null } | undefined;
    if (!row) {
      // Fila ausente: la crea con los defaults del SPEC (formato 8, §12.6).
      this.db
        .prepare(
          `INSERT OR IGNORE INTO team_settings (id, team_name, format, season) VALUES (1, 'Club Portal', 8, '2026')`,
        )
        .run();
      return this.get();
    }
    return {
      logoUrl: row.logo_url, brandColor: row.brand_color, defaultTournamentId: row.default_tournament_id,
      teamName: row.team_name,
      format: isTeamFormat(row.format) ? row.format : 11,
      season: row.season,
    };
  }

  update(patch: Partial<TeamSettingsData>): TeamSettingsData {
    const current = this.get();
    const next: TeamSettingsData = {
      logoUrl: patch.logoUrl !== undefined ? patch.logoUrl : current.logoUrl,
      brandColor: patch.brandColor ?? current.brandColor,
      defaultTournamentId: patch.defaultTournamentId !== undefined ? patch.defaultTournamentId : current.defaultTournamentId,
      teamName: patch.teamName ?? current.teamName,
      format: patch.format ?? current.format,
      season: patch.season ?? current.season,
    };
    this.db
      .prepare(
        `UPDATE team_settings
            SET logo_url = @logoUrl, brand_color = @brandColor, default_tournament_id = @defaultTournamentId, team_name = @teamName, format = @format, season = @season,
                updated_at = datetime('now')
          WHERE id = 1`,
      )
      .run(next);
    return next;
  }
}
