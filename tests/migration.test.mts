import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { gzipSync, gunzipSync } from 'node:zlib';
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'futapp-ingesta-'));
process.env.NODE_ENV='test';process.env.DB_PATH=path.join(dir,'source.db');process.env.JWT_SECRET='isolated-ingesta-test-secret-123456789012345';
const { migrate } = await import('../backend/src/adapters/out/persistence/migrate');
const { getDb, closeDb } = await import('../backend/src/adapters/out/persistence/database');
const { FileMigrationStore } = await import('../backend/src/adapters/out/persistence/migration-store');
const { ensureInitialAdmin } = await import('../backend/src/adapters/out/persistence/initial-admin');
const { createContainer } = await import('../backend/src/container');
const { createHttpServer } = await import('../backend/src/adapters/in/rest/http-server');
migrate();const source=getDb(),c=createContainer(),password='Migration passphrase 123!';
ensureInitialAdmin(source,{BOOTSTRAP_ADMIN:'1',ADMIN_EMAIL:'admin@source.test',ADMIN_PASSWORD:password});
// Capture a fresh schema, before source team data is inserted.
const schema = source.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all() as {sql:string}[];
const defaults = ['team_settings','qr_payment_settings','notification_settings','migration_state'].map(name=>({name, rows:source.prepare(`SELECT * FROM ${name}`).all() as Record<string,any>[]}));
function destination(name:string) {
  const directory=path.join(dir,name);fs.mkdirSync(directory,{recursive:true});const db=new Database(path.join(directory,'portal.db'));
  for(const row of schema)db.exec(row.sql);
  for(const table of defaults)for(const row of table.rows){const keys=Object.keys(row);db.prepare(`INSERT INTO ${table.name}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]));}
  ensureInitialAdmin(db,{BOOTSTRAP_ADMIN:'1',ADMIN_EMAIL:'initial@destination.test',ADMIN_PASSWORD:password});db.pragma('foreign_keys=ON');
  return {db,directory,store:new FileMigrationStore(db,directory,'https://destination.onrender.com')};
}
const player=c.playerService.create({email:'player@source.test',password,fullName:'Portero migrado',position:'POR',shirtNumber:5,eps:'EPS privada',prepaidHealth:'Plan privado'});
source.prepare("INSERT INTO tournaments(name,league_name,season,status,rules_json,updated_at) VALUES('Liga real','NLS','2026','publicado',?,datetime('now'))").run(JSON.stringify({format:8,periods:2,minutesPerPeriod:25,rollingSubstitutions:true}));
source.prepare('INSERT INTO tournament_players(tournament_id,player_id) VALUES(1,?)').run(player.player.id);
fs.mkdirSync(path.join(dir,'uploads'));fs.writeFileSync(path.join(dir,'uploads','test.txt'),'archivo real');
source.prepare("INSERT INTO media_assets(id,owner_id,purpose,file_name,stored_name,mime_type,size) VALUES('asset',1,'tournament','norma.txt','test.txt','text/plain',12)").run();
source.prepare("INSERT INTO registration_invitation(id,digest,expires_at) VALUES(1,'old-invitation',9999999999999)").run();
const admin=c.authService.login({email:'admin@source.test',password}).token, token=c.authService.login({email:player.user.email,password}).token;
const app=createHttpServer({migration:c.migrationService,notifications:c.notificationService,qrPayments:c.qrPaymentService,tournaments:c.tournamentService,media:c.mediaService,auth:c.authService,me:c.meService,players:c.playerService,inscriptions:c.inscriptionService,uniforms:c.uniformService,matches:c.matchService,sanctions:c.sanctionService,stats:c.statsService,ai:c.aiService,dashboard:c.dashboardService,settings:c.settingsService});
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert(address&&typeof address!=='string');
const opened:Database.Database[]=[];
after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));for(const db of opened)db.close();closeDb();fs.rmSync(dir,{recursive:true,force:true});});
const exportStore=new FileMigrationStore(source,dir);
const packet=await exportStore.exportData();
const decode=()=>JSON.parse(gunzipSync(packet).toString());
const encode=(p:unknown)=>gzipSync(Buffer.from(JSON.stringify(p)));

test('migration endpoints require an administrator and never allow ingestion on existing team data',async()=>{
  for(const authorization of ['',`Bearer ${token}`])for(const method of ['GET','PUT']){
    const res=await fetch(`http://127.0.0.1:${address.port}/api/migration`,{method,headers:{Authorization:authorization,'Content-Type':'application/json'},...(method==='PUT'?{body:'{"enabled":true}'}:{})});
    assert.equal(res.status,authorization?403:401);
  }
  assert.equal(exportStore.status().canImport,false);assert.throws(()=>exportStore.enable(true));
  const res=await fetch(`http://127.0.0.1:${address.port}/api/migration/export`,{headers:{Authorization:`Bearer ${admin}`}});
  assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'private, no-store');assert.match(res.headers.get('content-disposition')!,/\.futapp/);
  assert.equal((await res.arrayBuffer()).byteLength>0,true);
  assert.equal((source.prepare('SELECT count(*) n FROM players').get() as any).n,1);
});
test('preview and one-time import preserve accounts, health, rosters and files; invalidate sessions and pause sends',async()=>{
  const {db,store,directory}=destination('happy');opened.push(db);
  assert.equal(store.status().canImport,true);
  await assert.rejects(store.preview(1,packet));store.enable(true);
  const preview=await store.preview(1,packet);assert.equal(preview.counts.players,1);assert.equal(preview.counts.tournament_players,1);assert.equal(preview.files,1);
  await assert.rejects(store.commit(2,preview.id,'IMPORTAR'));await assert.rejects(store.commit(1,preview.id,'SI'));
  const beforeHash=(source.prepare('SELECT password_hash FROM users WHERE id=1').get() as any).password_hash;
  const result=await store.commit(1,preview.id,'IMPORTAR');assert(result.importedAt);
  assert.equal((db.prepare('SELECT password_hash FROM users WHERE id=1').get() as any).password_hash,beforeHash);
  assert.equal((db.prepare('SELECT email FROM users WHERE id=1').get() as any).email,'admin@source.test');
  assert.equal((db.prepare('SELECT eps,prepaid_health FROM players').get() as any).prepaid_health,'Plan privado');
  assert.equal((db.prepare('SELECT count(*) n FROM tournament_players').get() as any).n,1);
  for(const name of ['auth_sessions','registration_invitation','notification_jobs'])assert.equal((db.prepare(`SELECT count(*) n FROM ${name}`).get() as any).n,0);
  const config=JSON.parse((db.prepare('SELECT config FROM notification_settings').get() as any).config);
  assert.equal(config.whatsappEnabled,false);assert.equal(config.emailEnabled,false);assert.equal(config.publicBaseUrl,'https://destination.onrender.com');
  const asset=db.prepare('SELECT stored_name FROM media_assets').get() as any;
  assert.match(asset.stored_name,/^migration-/);assert.equal(fs.readFileSync(path.join(directory,'uploads',asset.stored_name),'utf8'),'archivo real');
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok');assert.deepEqual(db.pragma('foreign_key_check'),[]);
  assert.equal(store.status().enabled,false);assert.equal(store.status().canImport,false);assert.throws(()=>store.enable(true));
  assert(fs.readdirSync(path.join(directory,'backups')).length===1);
  assert.equal(ensureInitialAdmin(db,{BOOTSTRAP_ADMIN:'1',ADMIN_EMAIL:'wrong@test.test',ADMIN_PASSWORD:'New password should never replace!'}),false);
  assert.equal((db.prepare('SELECT email FROM users WHERE id=1').get() as any).email,'admin@source.test');
});
test('corrupt files, missing references, duplicate numbers and unsupported schemas are rejected without writes',async()=>{
  const {db,store}=destination('bad');opened.push(db);store.enable(true);
  await assert.rejects(store.preview(1,Buffer.from('not a package')));
  for(const mutate of [
    (p:any)=>{p.files[0].name='../test.txt';},
    (p:any)=>{p.files[0].data=Buffer.from('corrupt').toString('base64');},
    (p:any)=>{p.files=[];},
    (p:any)=>{p.tables.evil={columns:[],rows:[]};},
    (p:any)=>{const t=p.tables.tournament_players;t.rows[0][t.columns.indexOf('player_id')]=999;},
    (p:any)=>{const t=p.tables.players;const row=[...t.rows[0]];row[t.columns.indexOf('id')]=2;row[t.columns.indexOf('user_id')]=1;t.rows.push(row);},
  ]){const p=decode();mutate(p);await assert.rejects(store.preview(1,encode(p)));}
  assert.equal((db.prepare('SELECT count(*) n FROM players').get() as any).n,0);assert.equal(store.status().canImport,true);
});
test('schema column order differences and concurrent new team data are handled safely',async()=>{
  const {db,store}=destination('concurrent');opened.push(db);store.enable(true);
  const p=decode(),t=p.tables.players;t.columns.reverse();t.rows.forEach((row:any[])=>row.reverse());
  const preview=await store.preview(1,encode(p));
  db.prepare("INSERT INTO uniforms(name,kind) VALUES('No sobrescribir','camiseta')").run();
  await assert.rejects(store.commit(1,preview.id,'IMPORTAR'));
  assert.equal((db.prepare('SELECT name FROM uniforms').get() as any).name,'No sobrescribir');
});
test('multipart preview and confirmed import work through HTTP, with transactional rollback on a database failure',async()=>{
  const {db,store,directory}=destination('http');opened.push(db);
  const instance=createHttpServer({migration:store,notifications:c.notificationService,qrPayments:c.qrPaymentService,tournaments:c.tournamentService,media:c.mediaService,auth:c.authService,me:c.meService,players:c.playerService,inscriptions:c.inscriptionService,uniforms:c.uniformService,matches:c.matchService,sanctions:c.sanctionService,stats:c.statsService,ai:c.aiService,dashboard:c.dashboardService,settings:c.settingsService});
  const http=instance.listen(0,'127.0.0.1');await new Promise<void>(resolve=>http.once('listening',resolve));const a=http.address();assert(a&&typeof a!=='string');
  const base=`http://127.0.0.1:${a.port}/api/migration`,headers={Authorization:`Bearer ${admin}`,'Content-Type':'application/json'};
  try{
    assert.equal((await fetch(base,{method:'PUT',headers,body:'{"enabled":true}'})).status,200);
    const file=new FormData();file.append('file',new Blob([packet]),'team.futapp');
    const response=await fetch(base+'/preview',{method:'POST',headers:{Authorization:`Bearer ${admin}`},body:file});
    assert.equal(response.status,200,await response.clone().text());const preview=await response.json();
    db.exec("CREATE TRIGGER reject_import BEFORE INSERT ON players BEGIN SELECT RAISE(ABORT,'Test interrupted import'); END;");
    await assert.rejects(store.commit(1,preview.id,'IMPORTAR'));
    assert.equal((db.prepare('SELECT email FROM users WHERE id=1').get() as any).email,'initial@destination.test');
    assert.equal((db.prepare('SELECT count(*) n FROM players').get() as any).n,0);assert.equal(store.status().enabled,true);
    assert.equal(fs.readdirSync(path.join(directory,'uploads')).length,0);assert.equal(db.pragma('foreign_keys',{simple:true}),1);
    db.exec('DROP TRIGGER reject_import');
    const imported=await fetch(base+'/import',{method:'POST',headers,body:JSON.stringify({id:preview.id,confirmation:'IMPORTAR'})});
    assert.equal(imported.status,200,await imported.clone().text());assert.equal((await imported.json()).counts.players,1);
  }finally{await new Promise<void>(resolve=>http.close(()=>resolve()));}
});
