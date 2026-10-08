import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, 'backend/.env'), quiet: true });
if (process.env.DB_DRIVER === 'postgres' || process.env.DATABASE_URL) throw new Error('Este respaldo es para SQLite. En la nube exporta los datos desde Configuración o respalda PostgreSQL y el bucket');
const dbPath = path.resolve(root, 'backend', process.env.DB_PATH ?? 'data/portal.db');
const destination = path.join(path.dirname(dbPath), 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
await fs.mkdir(destination, { recursive: true });
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
try {
  await db.backup(path.join(destination, 'portal.db'));
  const model = path.join(path.dirname(dbPath), 'model.json');
  try { await fs.copyFile(model, path.join(destination, 'model.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await fs.cp(path.join(path.dirname(dbPath), 'uploads'), path.join(destination, 'uploads'), { recursive: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  console.log(`Copia creada: ${destination}`);
} finally { db.close(); }
