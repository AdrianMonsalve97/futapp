import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

async function regularFile(file) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Se esperaba un archivo regular: ${path.basename(file)}`);
}
async function copyUploads(source, destination) {
  let entries;
  try { entries = await fs.readdir(source, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  await fs.mkdir(destination);
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('uploads debe contener únicamente archivos regulares');
    await fs.copyFile(path.join(source, entry.name), path.join(destination, entry.name), fs.constants.COPYFILE_EXCL);
  }
}

/** Restore into a new directory only. Never edits a live or existing database. */
export async function restoreBackup({ from, to }) {
  if (!from || !to) throw new Error('Uso: npm run restore -- --from CARPETA_RESPALDO --to CARPETA_NUEVA');
  const source = await fs.realpath(path.resolve(from)), destination = path.resolve(to);
  const relative = path.relative(source, destination);
  if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('El destino debe estar fuera de la carpeta del respaldo');
  }
  try { await fs.lstat(destination); throw new Error('El destino ya existe. Elige una carpeta nueva para conservar la instalación anterior'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const databasePath = path.join(source, 'portal.db');
  await regularFile(databasePath);
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
      throw new Error('El respaldo no pasó las comprobaciones de integridad');
    }
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get()) throw new Error('La base no corresponde a FutApp');
    const uploadsPath = path.join(source, 'uploads');
    try { const stat = await fs.lstat(uploadsPath); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('uploads debe ser una carpeta regular'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const assets = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='media_assets'").get()
      ? db.prepare('SELECT stored_name, size FROM media_assets').all() : [];
    for (const asset of assets) {
      if (typeof asset.stored_name !== 'string' || path.basename(asset.stored_name) !== asset.stored_name || /[\\/]/.test(asset.stored_name)) throw new Error('Nombre de archivo inválido en el respaldo');
      const file = path.join(uploadsPath, asset.stored_name);
      await regularFile(file);
      if ((await fs.stat(file)).size !== asset.size) throw new Error(`Archivo incompleto: ${asset.stored_name}`);
    }
    const counts = {};
    for (const table of ['users','players','tournaments','tournament_players','matches','inscriptions','payments','payment_receipts']) {
      if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) counts[table] = db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;
    }
    await fs.mkdir(path.dirname(destination), { recursive:true });
    await fs.mkdir(destination); // Exclusive creation; refuses concurrent or accidental replacements.
    const marker = path.join(destination, '.restore-in-progress');
    await fs.writeFile(marker, 'Restauración incompleta: no usar esta carpeta hasta finalizar.\n', { flag:'wx', mode:0o600 });
    await db.backup(path.join(destination, 'portal.db'));
    await copyUploads(uploadsPath, path.join(destination, 'uploads'));
    const model = path.join(source, 'model.json');
    try { await regularFile(model); await fs.copyFile(model, path.join(destination, 'model.json'), fs.constants.COPYFILE_EXCL); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const restored = new Database(path.join(destination, 'portal.db'), { readonly:true, fileMustExist:true });
    try {
      if (restored.pragma('integrity_check', { simple:true }) !== 'ok' || restored.pragma('foreign_key_check').length) throw new Error('La base restaurada no pasó las comprobaciones');
    } finally { restored.close(); }
    await fs.writeFile(path.join(destination, 'restore-info.json'), JSON.stringify({ restoredAt:new Date().toISOString(), counts, files:assets.length }, null, 2), { flag:'wx', mode:0o600 });
    await fs.unlink(marker);
    return { dbPath:path.join(destination, 'portal.db'), counts, files:assets.length };
  } finally { db.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--from' || args[2] !== '--to') throw new Error('Uso: npm run restore -- --from CARPETA_RESPALDO --to CARPETA_NUEVA');
    console.log(JSON.stringify(await restoreBackup({ from:args[1], to:args[3] }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
