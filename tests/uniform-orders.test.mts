import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import {gzipSync,gunzipSync} from 'node:zlib';
import {testPostgres} from './postgres-helper.mts';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'futapp-uniform-orders-'));
process.env.DB_PATH=path.join(directory,'portal.db');process.env.NODE_ENV='test';
process.env.JWT_SECRET='isolated-uniform-orders-secret-12345678901234567890';
const {migrate}=await import('../backend/src/adapters/out/persistence/migrate');
const {migratePostgres}=await import('../backend/src/adapters/out/persistence/postgres-schema');
const {getDb,closeDb}=await import('../backend/src/adapters/out/persistence/database');
const {asAsyncDatabase}=await import('../backend/src/adapters/out/persistence/async-database');
const {createContainer}=await import('../backend/src/container');
const {createHttpServer}=await import('../backend/src/adapters/in/rest/http-server');
const {FileMigrationStore}=await import('../backend/src/adapters/out/persistence/migration-store');
const {PostgresMigrationStore}=await import('../backend/src/adapters/out/persistence/postgres-migration-store');
const {CloudMediaStorage}=await import('../backend/src/adapters/out/persistence/supabase-storage');
const password='Uniform test passphrase 123!';
after(()=>{closeDb();assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});});

test('SQLite extends the legacy kind constraint without losing catalogue IDs or linked orders',()=>{
  const db=new Database(':memory:');
  try {
    migrate(db);
    db.prepare("INSERT INTO users(id,email,password_hash,full_name,role) VALUES(1,'legacy@test.local','test','Legado','admin')").run();
    db.prepare("INSERT INTO players(id,user_id,position) VALUES(1,1,'MED')").run();
    db.prepare("INSERT INTO uniforms(id,name,kind,variant,price,stock,image_url) VALUES(91,'Legado','camiseta','alterna',45000,9,'/api/media/legacy')").run();
    db.prepare("INSERT INTO uniform_issues(id,player_id,uniform_id,cost) VALUES(7,1,91,45000)").run();
    db.prepare("INSERT INTO uniform_requests(player_id,uniform_id,issue_id,quoted_price,status) VALUES(1,91,7,45000,'entregada')").run();
    const previous=db.prepare('SELECT * FROM uniforms').get();
    const sql=(db.prepare("SELECT sql FROM sqlite_master WHERE name='uniforms'").get() as {sql:string}).sql;
    db.pragma('foreign_keys=OFF');
    db.exec(sql.replace(/^CREATE TABLE\s+["`]?uniforms["`]?/i,'CREATE TABLE old_uniforms').replace(/'completo',\s*/g,''));
    db.exec('INSERT INTO old_uniforms SELECT * FROM uniforms; DROP TABLE uniforms; ALTER TABLE old_uniforms RENAME TO uniforms; DROP TABLE uniform_recipients;');
    db.pragma('foreign_keys=ON');
    assert.throws(()=>db.prepare("INSERT INTO uniforms(name,kind) VALUES('Nuevo','completo')").run());
    migrate(db);migrate(db);
    assert.deepEqual(db.prepare('SELECT * FROM uniforms WHERE id=91').get(),previous);
    assert.equal(db.prepare('SELECT uniform_id FROM uniform_issues WHERE id=7').get().uniform_id,91);
    assert.deepEqual(db.pragma('foreign_key_check'),[]);
    db.prepare("INSERT INTO uniforms(name,kind) VALUES('Nuevo','completo')").run();
  } finally {db.close();}
});

for(const dialect of ['sqlite','postgres'] as const)test(`${dialect}: local/visitor kits and family shirts keep ownership, stock, payments and backups`,async t=>{
  migrate();const pg=dialect==='postgres'?await testPostgres():null;
  if(pg)await migratePostgres(pg);
  const db=pg??asAsyncDatabase(getDb()),files=new Map<string,Buffer>();
  const objects={put:async(key:string,bytes:Buffer)=>{files.set(key,Buffer.from(bytes));},get:async(key:string)=>files.get(key)!,remove:async(key:string)=>{files.delete(key);}};
  const migration=pg?new PostgresMigrationStore(pg,objects):new FileMigrationStore(getDb(),directory);
  const c=createContainer({db,media:new CloudMediaStorage(db,objects),model:{load:async()=>null,save:async()=>{}},migration});
  const adminId=Number((await db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run(`admin-${dialect}@test.local`,bcrypt.hashSync(password,4),'Administrador')).lastInsertRowid);
  const player=await c.playerService.create({email:`player-${dialect}@test.local`,password,fullName:'Jugador responsable',position:'MED'});
  const teammate=await c.playerService.create({email:`other-${dialect}@test.local`,password,fullName:'Compañero',position:'DEF'});
  const adminToken=(await c.authService.login({email:`admin-${dialect}@test.local`,password})).token;
  const playerToken=(await c.authService.login({email:player.user.email,password})).token;
  const teammateToken=(await c.authService.login({email:teammate.user.email,password})).token;
  const app=createHttpServer({notifications:c.notificationService,qrPayments:c.qrPaymentService,tournaments:c.tournamentService,media:c.mediaService,auth:c.authService,me:c.meService,players:c.playerService,inscriptions:c.inscriptionService,uniforms:c.uniformService,matches:c.matchService,sanctions:c.sanctionService,stats:c.statsService,ai:c.aiService,dashboard:c.dashboardService,settings:c.settingsService});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert(address&&typeof address!=='string');
  const request=async(method:string,url:string,body?:unknown,token=adminToken)=>{
    const response=await fetch(`http://127.0.0.1:${address.port}/api${url}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,data:await response.json() as any};
  };
  let local:any,visitor:any,family:any,backup:Buffer;
  try {
    await t.test('both variants create a direct Uniform response, including full kits',async()=>{
      const first=await request('POST','/uniforms',{name:'Local completo',kind:'completo',variant:'titular',price:110000,stock:4});
      assert.equal(first.status,200);assert(Number.isInteger(first.data.id));assert.equal(first.data.uniform,undefined);local=first.data;
      const second=await request('POST','/uniforms',{name:'Visitante camiseta',kind:'camiseta',variant:'alterna',price:45000,stock:6});
      assert.equal(second.status,200);visitor=second.data;
      assert.equal((await request('POST','/uniforms',{name:'No autorizado',kind:'camiseta',price:1},playerToken)).status,403);
      if(pg){
        const before=await db.prepare('SELECT * FROM uniforms WHERE id=?').get(visitor.id);
        await pg.execute("ALTER TABLE uniforms DROP CONSTRAINT uniforms_kind_check; ALTER TABLE uniforms ADD CONSTRAINT uniforms_kind_check CHECK(kind IN ('camiseta','pantalon','medias','buzo','entrenamiento','guantes')) NOT VALID");
        await migratePostgres(pg);await migratePostgres(pg);
        assert.deepEqual(await db.prepare('SELECT * FROM uniforms WHERE id=?').get(visitor.id),before);
        await c.uniformService.createUniform({name:'Completo después de actualizar',kind:'completo',price:1,stock:1});
      }
    });
    await t.test('family requests require a name, shirts only and the authenticated owner',async()=>{
      const before=await db.prepare('SELECT COUNT(*) AS n FROM uniform_requests').get();
      for(const extra of [{recipientType:'hijo',recipientName:''},{recipientType:'pareja',recipientName:'x'.repeat(121)},{recipientType:'hijo',recipientName:'Nombre\u0001'},{recipientType:'otro',recipientName:'Nombre'},{recipientType:'hijo',recipientName:'Nombre',playerId:teammate.player.id}]){
        assert.equal((await request('POST','/me/uniform-requests',{uniformId:visitor.id,size:'8',...extra},playerToken)).status,400);
      }
      assert.equal((await request('POST','/me/uniform-requests',{uniformId:local.id,size:'M',recipientType:'pareja',recipientName:'Familia'},playerToken)).status,400);
      assert.deepEqual(await db.prepare('SELECT COUNT(*) AS n FROM uniform_requests').get(),before);
      const response=await request('POST','/me/uniform-requests',{uniformId:visitor.id,size:'8',recipientType:'hijo',recipientName:'  Hijo prueba  ',reason:'Estampar nombre en espalda'},playerToken);
      assert.equal(response.status,200);family=response.data.request;
      assert.equal(family.playerId,player.player.id);assert.equal(family.recipientName,'Hijo prueba');assert.equal(family.recipientType,'hijo');
      assert.equal((await request('GET','/me/uniforms',undefined,playerToken)).data.requests[0].recipientName,'Hijo prueba');
      assert.equal((await request('GET','/me/uniforms',undefined,teammateToken)).data.requests.length,0);
      assert.equal((await request('GET','/uniform-requests',undefined,playerToken)).status,403);
    });
    await t.test('family metadata failure rolls back the entire request and direct delivery',async()=>{
      const counts=await db.prepare('SELECT COUNT(*) AS n FROM uniform_requests').get();
      const stock=(await c.uniformService.listUniforms()).find(row=>row.id===visitor.id)!.stock;
      if(pg)await pg.execute("CREATE FUNCTION fail_family() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated family failure'; END; $$; CREATE TRIGGER fail_family BEFORE INSERT ON uniform_recipients FOR EACH ROW EXECUTE FUNCTION fail_family();");
      else getDb().exec("CREATE TRIGGER fail_family BEFORE INSERT ON uniform_recipients BEGIN SELECT RAISE(ABORT,'Isolated family failure'); END");
      try {
        await assert.rejects(()=>c.meService.createUniformRequest(player.user.id,{uniformId:visitor.id,size:'M',recipientType:'pareja',recipientName:'Pareja prueba'}));
        await assert.rejects(()=>c.uniformService.createIssue({playerId:player.player.id,uniformId:visitor.id,size:'M',recipientType:'pareja',recipientName:'Pareja prueba'}));
      } finally {if(pg)await pg.execute('DROP TRIGGER fail_family ON uniform_recipients; DROP FUNCTION fail_family()');else getDb().exec('DROP TRIGGER fail_family');}
      assert.deepEqual(await db.prepare('SELECT COUNT(*) AS n FROM uniform_requests').get(),counts);
      assert.equal((await c.uniformService.listIssues()).length,0);
      assert.equal((await c.uniformService.listUniforms()).find(row=>row.id===visitor.id)!.stock,stock);
    });
    await t.test('delivery preserves recipient, detail, quoted price and approved QR payment without double charging',async()=>{
      const image=await sharp({create:{width:24,height:24,channels:3,background:'#d8b86a'}}).png().toBuffer();
      await c.uniformService.updateUniform(visitor.id,{price:55000});
      await assert.rejects(()=>c.uniformService.updateUniform(visitor.id,{kind:'completo'}),/familiares/i);
      const receipt=await c.qrPaymentService.submit(player.user.id,{kind:'uniform_request',targetId:family.id,amount:45000,reference:`UNIFORM-${dialect}`,paidAt:'2026-10-08',idempotencyKey:`uniform_${dialect}`},'comprobante.png',image);
      await c.qrPaymentService.review(receipt.id,adminId,'aprobado','Validado');
      await c.uniformService.updateRequest(family.id,{status:'aprobada'});
      const delivered=await c.uniformService.updateRequest(family.id,{status:'entregada'});
      await c.uniformService.updateRequest(family.id,{status:'entregada'});
      const issue=(await c.uniformService.listIssues(player.player.id)).find(row=>row.id===delivered.issueId)!;
      assert.equal(issue.recipientName,'Hijo prueba');assert.equal(issue.recipientType,'hijo');assert.equal(issue.notes,'Estampar nombre en espalda');assert.equal(issue.cost,45000);
      assert.equal((await c.uniformService.listUniforms()).find(row=>row.id===visitor.id)!.stock,5);
      const payments=await c.qrPaymentService.view(player.user.id,false);
      const debts=payments.debts;
      assert.equal(debts.filter((row:any)=>row.kind==='uniform_issue'&&row.targetId===issue.id).length,0);
      const debt=debts.find((row:any)=>row.kind==='uniform_request'&&row.targetId===family.id);
      assert.match(debt.concept,/Hijo prueba/);assert.equal(debt.amount,45000);assert.equal(debt.outstanding,0);
      await c.uniformService.updateIssue(issue.id,{returned:true});await c.uniformService.updateIssue(issue.id,{returned:true});
      assert.equal((await c.uniformService.listUniforms()).find(row=>row.id===visitor.id)!.stock,6);
      const complete=await c.meService.createUniformRequest(player.user.id,{uniformId:local.id,size:'L',reason:'Con medias'});
      const full=await c.uniformService.updateRequest(complete.request.id,{status:'entregada'});
      assert.equal(full.recipientType,'jugador');assert.equal(full.recipientName,null);
      assert.equal((await c.uniformService.listUniforms()).find(row=>row.id===local.id)!.stock,3);
      const direct=await request('POST','/uniform-issues',{playerId:player.player.id,uniformId:visitor.id,size:'S',recipientType:'pareja',recipientName:'Pareja prueba',notes:'Detalle pareja'});
      assert.equal(direct.status,200);assert.equal(direct.data.recipientName,'Pareja prueba');
    });
    await t.test('snapshots retain family metadata and old snapshots without its table remain ingestible',async()=>{
      if(!pg){fs.mkdirSync(path.join(directory,'uploads'),{recursive:true});for(const row of await db.prepare('SELECT stored_name FROM media_assets').all())fs.writeFileSync(path.join(directory,'uploads',row.stored_name),files.get(row.stored_name)!);}
      const bytes=await migration.exportData();backup=bytes;const packet=JSON.parse(gunzipSync(bytes).toString());
      assert.equal(packet.tables.uniform_recipients.rows.length,3);
      const validator=new Database(':memory:');
      try {
        migrate(validator);const store=new FileMigrationStore(validator,directory);
        assert.deepEqual(store.validateForImport(bytes).tables.uniform_recipients,packet.tables.uniform_recipients);
        delete packet.tables.uniform_recipients;
        assert.deepEqual(store.validateForImport(gzipSync(JSON.stringify(packet))).tables.uniform_recipients.rows,[]);
      }finally{validator.close();}
    });
    await t.test('removing a player erases linked family names and leaves other players intact',async()=>{
      await c.playerService.remove(player.player.id);
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM uniform_recipients').get()).n,0);
      assert.equal((await c.authService.me(teammate.user.id)).user.active,true);
      if(!pg)assert.deepEqual(getDb().pragma('foreign_key_check'),[]);
    });
    await t.test('a fresh installation ingests the backup with family names, receipts and delivery links intact',async()=>{
      const target=pg?null:new Database(':memory:');
      if(pg){await pg.execute('DROP SCHEMA futapp CASCADE');await migratePostgres(pg);}else migrate(target!);
      const destination=pg??asAsyncDatabase(target!);
      const id=Number((await destination.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES('bootstrap@test.local','test','Bootstrap','admin')").run()).lastInsertRowid);
      const store=pg?new PostgresMigrationStore(pg,objects):new FileMigrationStore(target!,path.join(directory,'destination'));
      try {
        await store.enable(true);const preview=await store.preview(id,backup!);await store.commit(id,preview.id,'IMPORTAR');
        const rows=await destination.prepare('SELECT request_id,issue_id,recipient_type,recipient_name FROM uniform_recipients ORDER BY id').all();
        assert.equal(rows.length,3);assert.equal(rows[0].request_id,family.id);assert.equal(rows[0].recipient_name,'Hijo prueba');assert.equal(rows[1].recipient_type,'hijo');assert.equal(rows[2].recipient_name,'Pareja prueba');
        assert.equal((await destination.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get()).n,1);
        assert((await destination.prepare('SELECT issue_id FROM uniform_requests WHERE id=?').get(family.id)).issue_id);
        assert.equal((await destination.prepare('SELECT COUNT(*) AS n FROM media_assets').get()).n,1);
        if(target)assert.deepEqual(target.pragma('foreign_key_check'),[]);
      } finally {target?.close();}
    });
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));if(pg){await pg.execute('DROP SCHEMA futapp CASCADE');await pg.close();}}
});
