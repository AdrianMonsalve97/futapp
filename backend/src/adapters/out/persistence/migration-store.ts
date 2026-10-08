import Database from 'better-sqlite3';
import type { Database as Sqlite } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import type { MigrationPort, MigrationPreview, MigrationStatus } from '../../../application/ports/in/migration.port';
import { ValidationError } from '../../../domain/errors';

type Cell = string | number | null;
type Table = { columns: string[]; rows: Cell[][] };
type Packet = { format: string; version: number; createdAt: string; tables: Record<string, Table>; files: { name: string; data: string; sha256: string }[] };
const LIMIT = 25 * 1024 * 1024, EXPANDED = 64 * 1024 * 1024;
const TRANSIENT = new Set(['auth_sessions', 'registration_invitation', 'notification_jobs', 'notification_match_versions']);
const counted = ['users', 'players', 'tournaments', 'tournament_players', 'matches', 'inscriptions', 'payments', 'payment_receipts', 'media_assets'];
const quote = (name: string) => { if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new ValidationError('Esquema no compatible'); return `"${name}"`; };
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');

/** Private snapshots; imports use existing schema and constraints, never uploaded SQL. */
export class FileMigrationStore implements MigrationPort {
  private previews = new Map<string, { userId: number; packet: Packet; expires: number }>();
  private working = false;
  constructor(private db: Sqlite, private directory: string, private publicUrl?: string) {}
  status(): MigrationStatus {
    const state = this.db.prepare('SELECT enabled, imported_at FROM migration_state WHERE id=1').get() as { enabled: number; imported_at: string | null };
    const occupied = this.db.prepare('SELECT count(*) n FROM users').get() as { n: number };
    const bootstrap = new Set(['users','team_settings','qr_payment_settings','notification_settings','migration_state',...TRANSIENT]);
    const hasData = this.tables().filter(name => !bootstrap.has(name)).some(name => (this.db.prepare(`SELECT count(*) n FROM ${quote(name)}`).get() as { n: number }).n > 0);
    const onlyAdmin = (this.db.prepare("SELECT count(*) n FROM users WHERE role='admin' AND active=1").get() as { n: number }).n === 1;
    const canImport = !state.imported_at && occupied.n === 1 && onlyAdmin && !hasData;
    return { enabled: !!state.enabled, canImport, importedAt: state.imported_at,
      reason: canImport ? 'Instalación nueva lista para recibir los datos del equipo.' : 'Esta instalación ya tiene datos. La ingesta solo se permite en una instalación nueva con su administrador inicial.' };
  }
  enable(enabled: boolean) {
    if (typeof enabled !== 'boolean') throw new ValidationError('Indica si deseas activar la ingesta');
    if (this.working) throw new ValidationError('Hay una migración en curso');
    if (enabled && !this.status().canImport) throw new ValidationError(this.status().reason);
    this.db.prepare('UPDATE migration_state SET enabled=? WHERE id=1').run(enabled ? 1 : 0);
    if (!enabled) this.previews.clear();
    return this.status();
  }
  private tables(db = this.db) {
    return (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(row => row.name);
  }
  private counts(packet: Packet) { return Object.fromEntries(counted.map(name => [name, packet.tables[name]?.rows.length ?? 0])); }
  async exportData() {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'futapp-export-'));
    try {
      const snapshot = path.join(temporary, 'snapshot.db');
      await this.db.backup(snapshot);
      const db = new Database(snapshot, { readonly: true });
      const tables: Record<string, Table> = {};
      try {
        for (const name of this.tables(db)) {
          const columns = (db.pragma(`table_info(${quote(name)})`) as { name: string }[]).map(row => row.name);
          const rows = TRANSIENT.has(name) ? [] : db.prepare(`SELECT * FROM ${quote(name)}`).raw().all() as Cell[][];
          tables[name] = { columns, rows };
        }
      } finally { db.close(); }
      const assets = tables.media_assets;
      const nameColumn = assets.columns.indexOf('stored_name'), sizeColumn = assets.columns.indexOf('size');
      const files: Packet['files'] = [];
      let total = 0;
      for (const row of assets.rows) {
        const name = row[nameColumn];
        if (typeof name !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(name) || name === '.' || name === '..') throw new ValidationError('Nombre de archivo inválido');
        const file = path.join(this.directory, 'uploads', name);
        if (!fs.existsSync(file) || !fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new ValidationError('Falta un archivo del equipo; revisa el respaldo');
        const data = fs.readFileSync(file); total += data.length;
        if (data.length !== row[sizeColumn] || total > EXPANDED / 2) throw new ValidationError('Archivos incompletos o demasiado grandes. Usa el respaldo por consola.');
        files.push({ name, data: data.toString('base64'), sha256: hash(data) });
      }
      const json = Buffer.from(JSON.stringify({ format: 'futapp-migration', version: 1, createdAt: new Date().toISOString(), tables, files }));
      if (json.length > EXPANDED) throw new ValidationError('El equipo supera el límite de ingesta; usa el respaldo por consola');
      const result = gzipSync(json);
      if (result.length > LIMIT) throw new ValidationError('El archivo supera 25 MB; usa el respaldo por consola');
      return result;
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  }
  private validate(file: Buffer): Packet {
    let p: Packet;
    try { if (file.length > LIMIT) throw new Error(); p = JSON.parse(gunzipSync(file, { maxOutputLength: EXPANDED }).toString('utf8')); }
    catch { throw new ValidationError('Archivo de migración inválido o demasiado grande'); }
    if (p?.format !== 'futapp-migration' || p.version !== 1 || typeof p.createdAt !== 'string' || !Number.isFinite(Date.parse(p.createdAt)) || !p.tables || Array.isArray(p.tables) || !Array.isArray(p.files) || p.files.length > 2000) throw new ValidationError('Formato de migración no compatible');
    const names = this.tables();
    if (Object.keys(p.tables).sort().join() !== names.sort().join()) throw new ValidationError('Las versiones de origen y destino deben coincidir. Actualiza ambas y vuelve a exportar.');
    let rows = 0;
    for (const name of names) {
      const t = p.tables[name], columns = (this.db.pragma(`table_info(${quote(name)})`) as { name: string }[]).map(row => row.name);
      if (!t || !Array.isArray(t.columns) || t.columns.some(c => typeof c !== 'string') || JSON.stringify([...t.columns].sort()) !== JSON.stringify([...columns].sort()) || !Array.isArray(t.rows)) throw new ValidationError('Esquema de migración no compatible');
      rows += t.rows.length;
      if (rows > 100000 || t.rows.some(row => !Array.isArray(row) || row.length !== columns.length || row.some(cell => cell !== null && typeof cell !== 'string' && (typeof cell !== 'number' || !Number.isFinite(cell))))) throw new ValidationError('Datos de migración inválidos');
    }
    const assets = p.tables.media_assets, ni = assets.columns.indexOf('stored_name'), si = assets.columns.indexOf('size');
    const files = new Map<string, Buffer>();
    for (const f of p.files) {
      if (!f || typeof f.name !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(f.name) || f.name === '.' || f.name === '..' || files.has(f.name) || typeof f.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.data)) throw new ValidationError('Archivo adjunto inválido');
      const data = Buffer.from(f.data, 'base64');
      if (hash(data) !== f.sha256) throw new ValidationError('Un archivo está incompleto o fue alterado');
      files.set(f.name, data);
    }
    if (files.size !== assets.rows.length || assets.rows.some(row => typeof row[ni] !== 'string' || !files.has(row[ni] as string) || files.get(row[ni] as string)!.length !== row[si])) throw new ValidationError('Faltan fotos o comprobantes del respaldo');
    const users = p.tables.users, ri = users.columns.indexOf('role'), ai = users.columns.indexOf('active');
    if (!users.rows.some(row => row[ri] === 'admin' && row[ai] === 1)) throw new ValidationError('El respaldo debe tener un administrador activo');
    for (const name of ['team_settings','qr_payment_settings','notification_settings']) if (p.tables[name].rows.length !== 1) throw new ValidationError('Falta la configuración del equipo');
    return p;
  }
  private apply(db: Sqlite, packet: Packet, prefix = '') {
    db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        for (const name of this.tables(db)) db.prepare(`DELETE FROM ${quote(name)}`).run();
        db.exec('DELETE FROM sqlite_sequence');
        for (const [name, table] of Object.entries(packet.tables)) {
          if (TRANSIENT.has(name) || name === 'migration_state') continue;
          const insert = db.prepare(`INSERT INTO ${quote(name)}(${table.columns.map(quote).join(',')}) VALUES(${table.columns.map(() => '?').join(',')})`);
          for (const original of table.rows) {
            const row = [...original];
            if (name === 'media_assets') { const i = table.columns.indexOf('stored_name'); row[i] = prefix + row[i]; }
            insert.run(...row);
          }
        }
        db.prepare('INSERT INTO migration_state(id,enabled,imported_at) VALUES(1,0,?)').run(new Date().toISOString());
        const notification = db.prepare('SELECT config FROM notification_settings WHERE id=1').get() as { config:string } | undefined;
        if (!notification) throw new ValidationError('Falta la configuración de notificaciones');
        const config = JSON.parse(notification.config);
        config.whatsappEnabled = false; config.emailEnabled = false;
        if (this.publicUrl) config.publicBaseUrl = this.publicUrl;
        db.prepare('UPDATE notification_settings SET config=? WHERE id=1').run(JSON.stringify(config));
        if ((db.pragma('foreign_key_check') as unknown[]).length) throw new ValidationError('El respaldo contiene referencias incompletas');
        if (db.pragma('integrity_check', { simple: true }) !== 'ok') throw new ValidationError('El respaldo no superó la verificación de integridad');
      }).immediate();
    } finally { db.pragma('foreign_keys = ON'); }
  }
  private allowed() {
    const state = this.status();
    if (!state.canImport || !state.enabled) throw new ValidationError('Activa la ingesta en una instalación nueva antes de importar');
  }
  async preview(userId: number, file: Buffer): Promise<MigrationPreview> {
    this.allowed();
    if (this.working) throw new ValidationError('Hay una migración en curso');
    for (const [id, entry] of this.previews) if (entry.expires < Date.now()) this.previews.delete(id);
    const packet = this.validate(file);
    const trial = new Database(':memory:');
    try {
      const schema = this.db.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all() as { sql: string }[];
      for (const row of schema) trial.exec(row.sql);
      this.apply(trial, packet);
    } catch (err) { if (err instanceof ValidationError) throw err; throw new ValidationError('Los datos no cumplen las reglas de la aplicación'); }
    finally { trial.close(); }
    this.previews.clear(); // One bounded preview; packages contain private personal data.
    const id = randomUUID(), expires = Date.now() + 10 * 60 * 1000;
    this.previews.set(id, { userId, packet, expires });
    setTimeout(() => this.previews.delete(id), 10 * 60 * 1000).unref();
    return { id, createdAt: packet.createdAt, counts: this.counts(packet), files: packet.files.length, expiresAt: new Date(expires).toISOString() };
  }
  async commit(userId: number, id: string, confirmation: string) {
    this.allowed();
    const entry = this.previews.get(id);
    if (!entry || entry.userId !== userId || entry.expires < Date.now() || confirmation !== 'IMPORTAR') throw new ValidationError('Previsualiza de nuevo el respaldo y escribe IMPORTAR');
    if (this.working) throw new ValidationError('Hay una migración en curso');
    this.working = true;
    const copied: string[] = [];
    try {
      const backupDir = path.join(this.directory, 'backups', `antes-de-ingesta-${randomUUID()}`);
      fs.mkdirSync(backupDir, { recursive: true });
      await this.db.backup(path.join(backupDir, 'portal.db'));
      this.allowed(); // Recheck after asynchronous backup; concurrent writes cannot be overwritten.
      const uploads = path.join(this.directory, 'uploads'), prefix = `migration-${randomUUID()}-`;
      fs.mkdirSync(uploads, { recursive: true });
      for (const f of entry.packet.files) {
        const target = path.join(uploads, prefix + f.name);
        fs.writeFileSync(target, Buffer.from(f.data, 'base64'), { flag: 'wx', mode: 0o600 }); copied.push(target);
      }
      this.apply(this.db, entry.packet, prefix);
      this.previews.clear();
      return { importedAt: this.status().importedAt!, counts: this.counts(entry.packet) };
    } catch (err) {
      for (const file of copied) fs.rmSync(file, { force: true });
      if (err instanceof ValidationError) throw err;
      throw new ValidationError('No se pudo importar. Los datos anteriores se conservaron; vuelve a exportar y revisa el espacio disponible.');
    } finally { this.working = false; }
  }
}
