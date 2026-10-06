import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { FORMATION_LIST } from '../../../domain/formations';
import { getFormat } from '../../../domain/formats';
import { getDb } from './database';

/** Rutas candidatas para `schema.sql` (funciona con tsx desde src/ y con node desde dist/). */
function resolveSchemaPath(): string {
  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../../../src/adapters/out/persistence/schema.sql'),
    path.resolve(process.cwd(), 'src/adapters/out/persistence/schema.sql'),
    path.resolve(process.cwd(), 'dist/adapters/out/persistence/schema.sql'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `No se encontró schema.sql. Rutas probadas:\n${candidates.map((c) => ` - ${c}`).join('\n')}`,
    );
  }
  return found;
}

function hasTable(db: Database, table: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table);
  return Boolean(row);
}

/** true si la tabla tiene la columna (via `pragma_table_info`, §12.3). */
function hasColumn(db: Database, table: string, column: string): boolean {
  if (!hasTable(db, table)) return false;
  const rows = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

/**
 * Migración defensiva de BDs existentes (§12.3):
 * `ALTER TABLE ... ADD COLUMN` para `matches.format` / `matches.minutes`,
 * creación de `team_settings` si falta e `INSERT OR IGNORE` con formato 8.
 */
function ensureFormatSupport(db: Database): void {
  if (hasTable(db, 'matches')) {
    let addedFormat = false;
    if (!hasColumn(db, 'matches', 'format')) {
      db.exec(`ALTER TABLE matches ADD COLUMN format INTEGER NOT NULL DEFAULT 8 CHECK (format IN (5,7,8,11))`);
      addedFormat = true;
    }
    if (!hasColumn(db, 'matches', 'minutes')) {
      db.exec(`ALTER TABLE matches ADD COLUMN minutes INTEGER NOT NULL DEFAULT 60`);
    }

    // BD legada (los partidos existentes eran de fútbol 11): se deriva el
    // formato y la duración a partir de la formación, que es única por formato
    // en el catálogo (§12.2), para que los datos sigan siendo coherentes.
    if (addedFormat) {
      const update = db.prepare(`UPDATE matches SET format = ?, minutes = ? WHERE formation = ?`);
      for (const formation of FORMATION_LIST) {
        update.run(formation.format, getFormat(formation.format).matchMinutes, formation.key);
      }
    }
  }

  if (!hasTable(db, 'team_settings')) {
    db.exec(`CREATE TABLE IF NOT EXISTS team_settings (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      team_name  TEXT    NOT NULL DEFAULT 'Club Portal',
      format     INTEGER NOT NULL DEFAULT 8 CHECK (format IN (5,7,8,11)),
      season     TEXT    NOT NULL DEFAULT '2026',
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )`);
  }
  db.prepare(
    `INSERT OR IGNORE INTO team_settings (id, team_name, format, season) VALUES (1, 'Club Portal', 8, '2026')`,
  ).run();
}

/**
 * Crea `backend/data/` si no existe, abre la BD, ejecuta `schema.sql` cuando
 * la tabla `users` no existe (§4) y aplica la migración de formatos (§12.3)
 * tanto en BDs nuevas como en existentes.
 */
export function migrate(): void {
  const db = getDb();
  const table = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
    .get();
  if (!table) {
    const script = fs.readFileSync(resolveSchemaPath(), 'utf8');
    db.exec(script);
  }
  ensureFormatSupport(db);
}
