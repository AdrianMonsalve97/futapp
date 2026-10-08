import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {testPostgres} from './postgres-helper.mts';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'futapp-cloud-tests-'));
process.env.DB_PATH=path.join(directory,'portal.db');process.env.NODE_ENV='test';process.env.JWT_SECRET='isolated-cloud-tests-secret-12345678901234567890';
const {migrate}=await import('../backend/src/adapters/out/persistence/migrate');
const {getDb,closeDb}=await import('../backend/src/adapters/out/persistence/database');
const {ensureInitialAdmin}=await import('../backend/src/adapters/out/persistence/initial-admin');
const {createContainer}=await import('../backend/src/container');
const {createHttpServer}=await import('../backend/src/adapters/in/rest/http-server');
const {migratePostgres}=await import('../backend/src/adapters/out/persistence/postgres-schema');
const {PostgresMigrationStore}=await import('../backend/src/adapters/out/persistence/postgres-migration-store');
const {CloudMediaStorage}=await import('../backend/src/adapters/out/persistence/supabase-storage');
const {PostgresModelStore}=await import('../backend/src/adapters/out/persistence/postgres-model-store');
const {SqliteNotificationRepository}=await import('../backend/src/adapters/out/persistence/repositories/notification.repository');

test('SQLite → PostgreSQL: verified ingestion, private assets, atomic payments and durable application state',async t=>{
  const db=await testPostgres(),files=new Map<string,Buffer>();
  const objects={put:async(key:string,bytes:Buffer)=>{assert(!files.has(key));files.set(key,Buffer.from(bytes));},get:async(key:string)=>{assert(files.has(key));return files.get(key)!;},remove:async(key:string)=>{files.delete(key);}};
  let server:ReturnType<ReturnType<typeof createHttpServer>['listen']>|undefined;
  try{
    migrate();ensureInitialAdmin(getDb(),{BOOTSTRAP_ADMIN:'1',ADMIN_EMAIL:'admin@source.test',ADMIN_PASSWORD:'Source passphrase 123456!'});
    const source=createContainer(),password='Player passphrase 123456!';
    const players=[];for(const [i,position]of ['POR','DEF','DEF','DEF','MED','MED','MED','DEL'].entries())players.push(await source.playerService.create({email:`player${i}@source.test`,password,fullName:`Jugador ${i}`,position:position as any,shirtNumber:i+1,eps:'EPS privada',prepaidHealth:'Plan privado'}));
    const tournament=await source.tournamentService.save(null,{name:'Copa F8',leagueName:'Liga de prueba',season:'2026',status:'publicado',notes:'Normativa del equipo',rules:{format:8,periods:2,minutesPerPeriod:25,breakMinutes:5,maxSquad:22,maxSubstitutions:null,rollingSubstitutions:true,allowedFormations:['1-3-3-1'],tacticalStyle:'equilibrado'}});
    await source.tournamentService.addPlayers(tournament.id,players.map(player=>player.player.id));
    const image=await sharp({create:{width:12,height:12,channels:3,background:'#d8b86a'}}).png().toBuffer();
    await source.mediaService.upload(1,'logo',null,'escudo.png',image);
    await source.mediaService.upload(players[0].user.id,'avatar',null,'foto.png',image);
    await source.mediaService.upload(1,'tournament',tournament.id,'reglamento.txt',Buffer.from('F8: 2 tiempos de 25 minutos y cambios ilimitados.'));
    const debt=await source.inscriptionService.create({playerId:players[0].player.id,season:'2026',amount:100});
    const receipt=await source.qrPaymentService.submit(players[0].user.id,{kind:'inscription',targetId:debt.id,amount:100,reference:'CLOUD-REFERENCE',paidAt:'2026-10-07',idempotencyKey:'cloud_receipt_test'},'comprobante.png',image);
    const packet=await source.migrationService.exportData(),original=JSON.parse(gunzipSync(packet).toString());
    await migratePostgres(db);
    await db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run('initial@destination.test',bcrypt.hashSync('Initial passphrase 123456!',4),'Initial');
    const store=new PostgresMigrationStore(db,objects,'https://futapp-test.onrender.com');await store.enable(true);
    const preview=await store.preview(1,packet);
    await t.test('database failure rolls back bootstrap data and cleans uploaded objects',async()=>{
      await db.execute(`CREATE FUNCTION reject_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Test import failure'; END; $$;
        CREATE TRIGGER reject_import BEFORE INSERT ON players FOR EACH ROW EXECUTE FUNCTION reject_import();`);
      await assert.rejects(()=>store.commit(1,preview.id,'IMPORTAR'));
      assert.equal((await db.query('SELECT email FROM users'))[0].email,'initial@destination.test');assert.equal(files.size,0);assert.equal((await store.status()).canImport,true);
      await db.execute('DROP TRIGGER reject_import ON players; DROP FUNCTION reject_import()');
    });
    await store.commit(1,preview.id,'IMPORTAR');
    const cloud={db,media:new CloudMediaStorage(db,objects),model:new PostgresModelStore(db),migration:store};
    const c=createContainer(cloud);
    await t.test('all records, account hashes and file bytes survive ingestion',async()=>{
      for(const [name,count]of Object.entries(preview.counts))assert.equal((await db.query(`SELECT count(*) AS total FROM "${name}"`))[0].total,count);
      const originalHash=original.tables.users.rows[0][original.tables.users.columns.indexOf('password_hash')];assert.equal((await db.query('SELECT password_hash FROM users WHERE id=1'))[0].password_hash,originalHash);
      for(const file of original.files)assert([...files].some(([key,bytes])=>key.endsWith(file.name)&&createHash('sha256').update(bytes).digest('hex')===file.sha256));
      assert.equal((await c.playerService.get(players[0].player.id)).player.prepaidHealth,'Plan privado');assert.equal((await c.tournamentService.roster(tournament.id,true,1)).players.length,8);
      await assert.rejects(()=>c.authService.login({email:'initial@destination.test',password:'Initial passphrase 123456!'}));
      await c.authService.login({email:'admin@source.test',password:'Source passphrase 123456!'});
      assert.equal((await store.status()).canImport,false);await assert.rejects(()=>store.commit(1,preview.id,'IMPORTAR'));
    });
    server=createHttpServer({migration:store,notifications:c.notificationService,qrPayments:c.qrPaymentService,tournaments:c.tournamentService,media:c.mediaService,auth:c.authService,me:c.meService,players:c.playerService,inscriptions:c.inscriptionService,uniforms:c.uniformService,matches:c.matchService,sanctions:c.sanctionService,stats:c.statsService,ai:c.aiService,dashboard:c.dashboardService,settings:c.settingsService}).listen(0,'127.0.0.1');
    await new Promise<void>(resolve=>server!.once('listening',resolve));const address=server.address();assert(address&&typeof address!=='string');
    const base=`http://127.0.0.1:${address.port}/api`,playerToken=(await c.authService.login({email:players[0].user.email,password})).token,otherToken=(await c.authService.login({email:players[1].user.email,password})).token;
    await t.test('private receipts and avatars require ownership; only the team crest is public',async()=>{
      assert.equal((await fetch(base+'/media/'+receipt.assetId)).status,401);
      assert.equal((await fetch(base+'/media/'+receipt.assetId,{headers:{Authorization:'Bearer '+otherToken}})).status,404);
      const response=await fetch(base+'/media/'+receipt.assetId,{headers:{Authorization:'Bearer '+playerToken}});assert.equal(response.status,200);assert((await response.arrayBuffer()).byteLength>0);
      assert.equal((await fetch(base+'/branding/logo')).status,200);
      assert.equal((await fetch(base+'/migration',{headers:{Authorization:'Bearer '+playerToken}})).status,403);
    });
    await t.test('PostgreSQL payments roll back failed reviews and concurrent approval credits once',async()=>{
      await db.execute(`CREATE FUNCTION reject_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Test review failure'; END; $$;
        CREATE TRIGGER reject_review BEFORE UPDATE OF status ON payment_receipts FOR EACH ROW EXECUTE FUNCTION reject_review();`);
      await assert.rejects(()=>c.qrPaymentService.review(receipt.id,1,'aprobado',''));
      assert.equal((await c.inscriptionService.list()).find(row=>row.id===debt.id)!.paid,0);
      await db.execute('DROP TRIGGER reject_review ON payment_receipts; DROP FUNCTION reject_review()');
      await Promise.allSettled([c.qrPaymentService.review(receipt.id,1,'aprobado',''),c.qrPaymentService.review(receipt.id,1,'aprobado','')]);
      const updated=(await c.inscriptionService.list()).find(row=>row.id===debt.id)!;assert.equal(updated.paid,100);assert.equal(updated.payments.length,1);
    });
    await t.test('unique numbers and concurrent creation cannot leave orphaned accounts',async()=>{
      const make=(email:string)=>c.playerService.create({email,password,fullName:'Nuevo jugador',position:'DEF',shirtNumber:20});
      const results=await Promise.allSettled([make('new1@source.test'),make('new2@source.test')]);assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
      assert.equal((await db.query('SELECT count(*) AS total FROM users'))[0].total,10);assert.equal((await c.playerService.list()).length,9);
    });
    await t.test('F8, AI, sessions, documents and model persist through rebuilding the application',async()=>{
      const match=await c.matchService.create({opponent:'Rival',competition:'Liga',kickOff:'2099-01-01T18:00',isHome:true,tournamentId:tournament.id,format:8});
      assert.equal(match.minutes,50);const plan=await c.aiService.tacticalPlan(match.id,'ofensivo');assert.equal(plan.recommendation.lineup.length,8);
      const notifications=new SqliteNotificationRepository(db);assert.notEqual(await notifications.revisionKey(match.id,'first'),await notifications.revisionKey(match.id,'second'));
      await c.aiService.train();assert.equal((await db.query('SELECT count(*) AS total FROM model_artifacts'))[0].total,1);
      await migratePostgres(db);const rebuilt=createContainer(cloud);assert.equal((await rebuilt.authService.verifySession(playerToken)).user.id,players[0].user.id);
      assert.equal((await rebuilt.matchService.get(match.id)).match.minutes,50);assert((await rebuilt.tournamentService.get(tournament.id,true)).documents.length===1);
      assert((await cloud.model.load())!==null);await rebuilt.dashboardService.admin();await rebuilt.aiService.playerInsight(players[0].player.id);
      const exported=await store.exportData();new (await import('../backend/src/adapters/out/persistence/migration-store')).FileMigrationStore(getDb(),directory).validateForImport(exported);
    });
  }finally{
    if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));
    if(process.env.TEST_DATABASE_URL)await db.execute('DROP SCHEMA futapp CASCADE');
    await db.close();closeDb();assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});
  }
});
