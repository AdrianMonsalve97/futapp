import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { env } from '../../../config/env';

let instance: Database.Database | null = null;

/**
 * Singleton de better-sqlite3 con los pragmas del SPEC (§3):
 * `journal_mode = WAL` y `foreign_keys = ON`.
 */
export function getDb(): Database.Database {
  if (env.databaseDriver === 'postgres') throw new Error('Esta herramienta usa SQLite; para PostgreSQL usa la ingesta o los respaldos de la nube');
  if (instance) return instance;
  const filePath = path.isAbsolute(env.dbPath) ? env.dbPath : path.resolve(process.cwd(), env.dbPath);
  if (fs.existsSync(path.join(path.dirname(filePath), '.restore-in-progress'))) throw new Error('La restauración de datos no ha finalizado. Selecciona una copia completa antes de iniciar');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  instance = db;
  return db;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
