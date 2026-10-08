import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { restoreBackup } from '../scripts/restore.mjs';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'futapp-restore-tests-'));
after(async () => { await fs.rm(directory, { recursive:true, force:true }); });
async function backupFixture(name: string) {
  const source = path.join(directory, name);
  await fs.mkdir(path.join(source,'uploads'), { recursive:true });
  const database = new Database(path.join(source,'portal.db'));
  const hash = bcrypt.hashSync('Restored account passphrase 123!', 4);
  database.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,password_hash TEXT);
    CREATE TABLE players(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id));
    CREATE TABLE tournaments(id INTEGER PRIMARY KEY,name TEXT);
    CREATE TABLE tournament_players(tournament_id INTEGER REFERENCES tournaments(id),player_id INTEGER REFERENCES players(id));
    CREATE TABLE media_assets(id TEXT PRIMARY KEY,stored_name TEXT,size INTEGER);
    INSERT INTO users VALUES(1,'restored@example.test',''); INSERT INTO players VALUES(1,1);
    INSERT INTO tournaments VALUES(1,'Copa restaurada'); INSERT INTO tournament_players VALUES(1,1);
    INSERT INTO media_assets VALUES('document','reglamento.txt',12);`);
  database.prepare('UPDATE users SET password_hash=? WHERE id=1').run(hash); database.close();
  await fs.writeFile(path.join(source,'uploads','reglamento.txt'),'Normativa F8');
  await fs.writeFile(path.join(source,'model.json'),'{"trained":true}');
  return source;
}
test('restoration preserves accounts, tournament registrations, documents and model without replacing existing data', async () => {
  const source = await backupFixture('complete'), destination = path.join(directory,'restored');
  const result = await restoreBackup({ from:source, to:destination });
  assert.equal(result.counts.tournament_players, 1); assert.equal(result.files, 1);
  const restored = new Database(result.dbPath, { readonly:true });
  try {
    assert.equal(restored.pragma('integrity_check',{simple:true}),'ok');
    assert.equal(restored.pragma('foreign_key_check').length,0);
    const user = restored.prepare('SELECT password_hash FROM users WHERE id=1').get() as any;
    assert(bcrypt.compareSync('Restored account passphrase 123!',user.password_hash));
    assert.equal((restored.prepare('SELECT name FROM tournaments').get() as any).name,'Copa restaurada');
  } finally { restored.close(); }
  assert.equal(await fs.readFile(path.join(destination,'uploads','reglamento.txt'),'utf8'),'Normativa F8');
  assert.equal(await fs.readFile(path.join(destination,'model.json'),'utf8'),'{"trained":true}');
  await assert.rejects(fs.stat(path.join(destination,'.restore-in-progress')), {code:'ENOENT'});
  const original = await fs.readFile(result.dbPath);
  await assert.rejects(restoreBackup({from:source,to:destination}), /destino ya existe/);
  assert.deepEqual(await fs.readFile(result.dbPath),original);
  await assert.rejects(restoreBackup({from:source,to:path.join(source,'nested')}), /fuera de la carpeta/);
});
test('missing or incomplete media files stop restoration before creating a destination', async () => {
  const source = await backupFixture('missing'), destination = path.join(directory,'not-created');
  await fs.unlink(path.join(source,'uploads','reglamento.txt'));
  await assert.rejects(restoreBackup({from:source,to:destination}), {code:'ENOENT'});
  await assert.rejects(fs.stat(destination), {code:'ENOENT'});
  await fs.writeFile(path.join(source,'uploads','reglamento.txt'),'truncated');
  await assert.rejects(restoreBackup({from:source,to:destination}), /Archivo incompleto/);
  await assert.rejects(fs.stat(destination), {code:'ENOENT'});
});
test('corrupt databases and broken references cannot be restored as a working installation', async () => {
  const corrupt = path.join(directory,'corrupt'); await fs.mkdir(corrupt);
  await fs.writeFile(path.join(corrupt,'portal.db'),'not a SQLite database');
  await assert.rejects(restoreBackup({from:corrupt,to:path.join(directory,'corrupt-target')}));
  const source = await backupFixture('broken-reference');
  const database = new Database(path.join(source,'portal.db'));
  database.exec('PRAGMA foreign_keys=OFF; DELETE FROM users;'); database.close();
  await assert.rejects(restoreBackup({from:source,to:path.join(directory,'broken-target')}), /integridad/);
});
