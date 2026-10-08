import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import {gzipSync,gunzipSync} from 'node:zlib';
import {testPostgres} from './postgres-helper.mts';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'futapp-lifecycle-'));
process.env.DB_PATH=path.join(directory,'portal.db');process.env.NODE_ENV='test';
process.env.JWT_SECRET='isolated-lifecycle-tests-secret-12345678901234567890';
const {migrate}=await import('../backend/src/adapters/out/persistence/migrate');
const {migratePostgres}=await import('../backend/src/adapters/out/persistence/postgres-schema');
const {getDb,closeDb}=await import('../backend/src/adapters/out/persistence/database');
const {asAsyncDatabase}=await import('../backend/src/adapters/out/persistence/async-database');
const {createContainer}=await import('../backend/src/container');
const {FileMigrationStore}=await import('../backend/src/adapters/out/persistence/migration-store');
const {PostgresMigrationStore}=await import('../backend/src/adapters/out/persistence/postgres-migration-store');
const {CloudMediaStorage}=await import('../backend/src/adapters/out/persistence/supabase-storage');
const {SqliteUserRepository}=await import('../backend/src/adapters/out/persistence/repositories/user.repository');
const {getFormation}=await import('../backend/src/domain/formations');
const password='Lifecycle test passphrase 123!';
after(()=>{closeDb();assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});});

for(const dialect of ['sqlite','postgres'] as const) test(`${dialect}: complete player departure, administrator approval and team portraits`,async t=>{
  migrate();
  const pg=dialect==='postgres'?await testPostgres():null;
  if(pg)await migratePostgres(pg);
  const db=pg??asAsyncDatabase(getDb()),files=new Map<string,Buffer>();
  let failRemoval=false;
  const objects={put:async(key:string,bytes:Buffer)=>{files.set(key,Buffer.from(bytes));},get:async(key:string)=>files.get(key)!,remove:async(key:string)=>{if(failRemoval)throw new Error('Isolated storage outage');files.delete(key);}};
  const migration=pg?new PostgresMigrationStore(pg,objects):new FileMigrationStore(getDb(),directory);
  // SQLite's cloud adapter makes storage failures deterministic without touching real services.
  const c=createContainer({db,media:new CloudMediaStorage(db,objects),model:{load:async()=>null,save:async()=>{}},migration});
  const adminId=Number((await db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run(`admin-${dialect}@test.local`,bcrypt.hashSync(password,4),'Administrador')).lastInsertRowid);
  const squad=[];
  for(const [i,position] of ['POR','DEF','DEF','DEF','MED','MED','MED','DEL'].entries()) squad.push(await c.playerService.create({email:`${dialect}-${i}@test.local`,password,fullName:`Integrante ${dialect} ${i}`,position:position as any,shirtNumber:i+1,eps:'EPS personal',prepaidHealth:'Plan personal'}));
  const departing=squad[0],other=squad[1],image=await sharp({create:{width:24,height:24,channels:3,background:'#d8b86a'}}).png().toBuffer();
  const media=new CloudMediaStorage(db,objects);
  const photo=await c.mediaService.upload(departing.user.id,'avatar',null,'retrato.png',image) as {url:string};
  const asset=await media.find(photo.url.split('/').at(-1)!)!;assert(asset);
  await c.mediaService.upload(departing.user.id,'avatar',null,'foto-anterior.png',image);
  let token=(await c.authService.login({email:departing.user.email,password})).token;
  const tournament=await c.tournamentService.save(null,{name:'Copa F8',leagueName:'Liga',season:'2099',status:'publicado',notes:'',rules:{format:8,periods:2,minutesPerPeriod:25,breakMinutes:5,maxSquad:null,maxSubstitutions:null,rollingSubstitutions:true,allowedFormations:['1-3-3-1'],tacticalStyle:'equilibrado'}});
  await c.tournamentService.addPlayers(tournament.id,squad.map(row=>row.player.id));
  const match=await c.matchService.create({opponent:'Equipo rival',competition:'Liga',kickOff:'2099-01-01T18:00',isHome:true,tournamentId:tournament.id});
  await db.prepare('UPDATE match_referee_fees SET total=0 WHERE match_id=?').run(match.id);
  const slots=getFormation('1-3-3-1',8).slots.map((slot,i)=>({...slot,playerId:squad[i].player.id}));
  await c.matchService.setLineup(match.id,slots);await c.matchService.publishLineup(match.id);
  const inscription=await c.inscriptionService.create({playerId:departing.player.id,season:'2099',amount:120000});
  const receipt=await c.qrPaymentService.submit(departing.user.id,{kind:'inscription',targetId:inscription.id,amount:120000,reference:`DEPARTURE-${dialect}`,paidAt:'2026-10-07',idempotencyKey:`departure_${dialect}`},'soporte.png',image);
  await c.qrPaymentService.review(receipt.id,adminId,'aprobado','Validado');
  const uniformId=Number((await db.prepare("INSERT INTO uniforms(name,kind,price,stock) VALUES('Camiseta','camiseta',80000,4)").run()).lastInsertRowid);
  const issueId=Number((await db.prepare('INSERT INTO uniform_issues(player_id,uniform_id,cost) VALUES(?,?,80000)').run(departing.player.id,uniformId)).lastInsertRowid);
  await db.prepare("INSERT INTO uniform_requests(player_id,uniform_id,status,issue_id) VALUES(?,?,'entregada',?)").run(departing.player.id,uniformId,issueId);
  await db.prepare("INSERT INTO sanctions(player_id,type,reason) VALUES(?,'multa','Prueba')").run(departing.player.id);
  await db.prepare('INSERT INTO match_stats(match_id,player_id,minutes) VALUES(?,?,50)').run(match.id,departing.player.id);
  await db.prepare("INSERT INTO match_attendance(match_id,player_id,status) VALUES(?,?,'confirmado')").run(match.id,departing.player.id);
  await db.prepare("INSERT INTO notification_preferences(user_id,preferences) VALUES(?,'{}')").run(departing.user.id);
  const historical=await c.matchService.create({opponent:'Anterior',competition:'Liga',kickOff:'2020-01-01T18:00',isHome:true});
  await db.prepare("UPDATE matches SET status='jugado' WHERE id=?").run(historical.id);
  await db.prepare('UPDATE match_referee_fees SET total=120000,settled_shares=? WHERE match_id=?').run(JSON.stringify([{playerId:departing.player.id,playerName:departing.user.fullName,amount:60000},{playerId:other.player.id,playerName:other.user.fullName,amount:60000}]),historical.id);
  const creditMatch=await c.matchService.create({opponent:'Fecha con saldo',competition:'Liga',kickOff:'2020-02-01T18:00',isHome:true});
  await db.prepare("UPDATE matches SET status='jugado' WHERE id=?").run(creditMatch.id);
  await db.prepare('UPDATE match_referee_fees SET total=120000,settled_shares=? WHERE match_id=?').run(JSON.stringify([{playerId:departing.player.id,playerName:departing.user.fullName,amount:30000},{playerId:other.player.id,playerName:other.user.fullName,amount:90000}]),creditMatch.id);
  const creditReceipts=[];
  for (const row of [departing,other]) {
    const proof=await media.store(row.user.id,'receipt','arbitraje.png',image);
    const id=Number((await db.prepare(`INSERT INTO payment_receipts(player_id,kind,target_id,asset_id,amount,reference,paid_at,status,idempotency_key,file_hash)
      VALUES(?,'referee',?,?,120000,?,'2020-01-01T12:00:00Z','aprobado',?,'test_hash')`).run(row.player.id,historical.id,proof.id,`CREDIT-${dialect}-${row.player.id}`,`credit_${dialect}_${row.player.id}`)).lastInsertRowid);
    creditReceipts.push(id);
    await db.prepare('INSERT INTO match_referee_transfers(receipt_id,match_id,amount) VALUES(?,?,?)').run(id,creditMatch.id,row===departing?30000:60000);
  }
  await db.prepare(`INSERT INTO notification_jobs(event_key,kind,channel,recipient,receipt_id,message,next_attempt_at,created_at,updated_at)
    VALUES(?,'receipt_uploaded','email','admin@test.local',?,?,0,0,0)`).run(`departure_${dialect}`,receipt.id,JSON.stringify({detail:departing.user.fullName}));
  const departingFiles=(await db.prepare('SELECT stored_name FROM media_assets WHERE owner_id=?').all(departing.user.id)).map(row=>row.stored_name);

  try {
    await t.test('published maps include all eight companions and authenticated photos; receipts remain private',async()=>{
      const lineup=(await c.matchService.get(match.id,true)).lineup;
      assert.equal(lineup.length,8);assert(lineup.every(slot=>slot.playerId));
      assert.equal(lineup[0].avatarUrl,(await c.authService.me(departing.user.id)).user.avatarUrl);
      assert.equal((await c.dashboardService.player(departing.user.id)).upcomingMatch?.lineup.length,8);
      assert.equal((await c.aiService.playerInsight(departing.player.id,match.id)).preparation.lineup.length,8);
      assert.equal((await c.mediaService.read(asset.id,other.user.id,false)).id,asset.id);
      await assert.rejects(()=>c.mediaService.read(receipt.assetId,other.user.id,false),/no encontrado/i);
      const users=new SqliteUserRepository(db);await users.update(departing.user.id,{active:false});
      await assert.rejects(()=>c.mediaService.read(asset.id,other.user.id,false),/no encontrado/i);
      await users.update(departing.user.id,{active:true});
      token=(await c.authService.login({email:departing.user.email,password})).token;
    });
    await t.test('a failed departure rolls back every linked record and does not delete storage objects',async()=>{
      if(pg)await pg.execute("CREATE FUNCTION fail_departure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated failure'; END; $$; CREATE TRIGGER fail_departure BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION fail_departure();");
      else getDb().exec("CREATE TRIGGER fail_departure BEFORE DELETE ON users BEGIN SELECT RAISE(ABORT,'Isolated failure'); END");
      try {await assert.rejects(()=>c.playerService.remove(departing.player.id));}
      finally {if(pg)await pg.execute('DROP TRIGGER fail_departure ON users; DROP FUNCTION fail_departure()');else getDb().exec('DROP TRIGGER fail_departure');}
      assert(await db.prepare('SELECT id FROM users WHERE id=?').get(departing.user.id));
      assert(await db.prepare('SELECT id FROM payment_receipts WHERE id=?').get(receipt.id));
      assert(await db.prepare('SELECT id FROM media_assets WHERE id=?').get(asset.id));
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM media_deletion_jobs').get()).n,0);
      assert(files.has(asset.storedName));
    });
    await t.test('departure erases all player data, preserves teammates and club data, and retries storage cleanup',async()=>{
      failRemoval=true;
      const removed=await c.playerService.remove(departing.player.id);assert.equal(removed.filesPending,true);
      await assert.rejects(()=>c.authService.me(departing.user.id),/no encontrado/i);
      await assert.rejects(()=>c.authService.verifySession(token));
      for(const table of ['inscriptions','uniform_issues','uniform_requests','sanctions','match_stats','match_attendance','tournament_players','payment_receipts'])assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE player_id=?`).get(departing.player.id)).n,0,table);
      for(const table of ['auth_sessions','notification_preferences','registration_requests'])assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`).get(departing.user.id)).n,0,table);
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM media_assets WHERE owner_id=?').get(departing.user.id)).n,0);
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM payments WHERE inscription_id=?').get(inscription.id)).n,0);
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM match_referee_transfers WHERE receipt_id=?').get(creditReceipts[0])).n,0);
      assert.equal((await db.prepare('SELECT amount FROM match_referee_transfers WHERE receipt_id=?').get(creditReceipts[1])).amount,60000);
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM notification_jobs WHERE receipt_id=?').get(receipt.id)).n,0);
      assert.equal((await c.authService.me(other.user.id)).user.active,true);
      assert.equal((await c.tournamentService.get(tournament.id,true)).id,tournament.id);
      assert.equal((await c.matchService.get(match.id)).lineup.filter(slot=>slot.playerId===departing.player.id).length,0);
      const history=await db.prepare('SELECT total,settled_shares FROM match_referee_fees WHERE match_id=?').get(historical.id);
      assert.equal(history.total,60000);assert.deepEqual(JSON.parse(history.settled_shares),[{playerId:other.player.id,playerName:other.user.fullName,amount:60000}]);
      assert.equal((await db.prepare('SELECT stock FROM uniforms WHERE id=?').get(uniformId)).stock,4,'An account departure is not a physical uniform return');
      await assert.rejects(()=>c.mediaService.read(asset.id,adminId,true));
      failRemoval=false;await c.playerService.cleanupFiles();assert(departingFiles.every(key=>!files.has(key)));assert.equal(files.size,1);
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM media_deletion_jobs').get()).n,0);
      if(!pg)assert.deepEqual(getDb().pragma('foreign_key_check'),[]);
    });
    await t.test('the same email and dorsal can register again but no session exists before administrator approval',async()=>{
      const registered=await c.authService.register({email:departing.user.email,password,fullName:'Nuevo ingreso',position:'POR',shirtNumber:1,invitationCode:(await c.authService.createInvitation()).code});
      assert.equal(registered.pendingApproval,true);assert.equal(registered.user.active,false);assert(!('token' in registered));
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM auth_sessions WHERE user_id=?').get(registered.user.id)).n,0);
      await assert.rejects(()=>c.authService.login({email:registered.user.email,password}),/aval/i);
      assert((await c.playerService.list()).find(row=>row.user.id===registered.user.id)?.pendingApproval);
      await assert.rejects(()=>c.playerService.update(registered.player!.id,{active:true}),/solicitud/i);
      if(pg)await pg.execute(`CREATE FUNCTION fail_approval() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated approval failure'; END; $$; CREATE TRIGGER fail_approval BEFORE UPDATE OF active ON users FOR EACH ROW EXECUTE FUNCTION fail_approval();`);
      else getDb().exec("CREATE TRIGGER fail_approval BEFORE UPDATE OF active ON users BEGIN SELECT RAISE(ABORT,'Isolated approval failure'); END");
      try {await assert.rejects(()=>c.playerService.approve(registered.player!.id,adminId));}
      finally {if(pg)await pg.execute('DROP TRIGGER fail_approval ON users; DROP FUNCTION fail_approval()');else getDb().exec('DROP TRIGGER fail_approval');}
      assert.equal((await db.prepare('SELECT status FROM registration_requests WHERE user_id=?').get(registered.user.id)).status,'pendiente');
      assert.equal((await c.authService.me(registered.user.id)).user.active,false);
      await c.playerService.approve(registered.player!.id,adminId);
      assert.equal((await c.authService.login({email:registered.user.email,password})).user.active,true);
      await assert.rejects(()=>c.playerService.approve(registered.player!.id,adminId),/pendiente/i);
      await c.playerService.remove(registered.player!.id);
    });
    await t.test('shared club files survive the departure of an administrator with a player profile; the last administrator is protected',async()=>{
      const clubAdmin=await c.playerService.create({email:`club-admin-${dialect}@test.local`,password,fullName:'Admin del plantel',position:'MED'});
      await c.playerService.update(clubAdmin.player.id,{role:'admin'});
      const crest=await c.mediaService.upload(clubAdmin.user.id,'logo',null,'escudo.png',image) as {url:string};
      await c.playerService.remove(clubAdmin.player.id);
      const logo=await media.find(crest.url.split('/').at(-1)!);assert(logo);assert.equal(logo.ownerId,adminId);assert(files.has(logo.storedName));
      const profile=Number((await db.prepare("INSERT INTO players(user_id,position) VALUES(?,'MED')").run(adminId)).lastInsertRowid);
      await assert.rejects(()=>c.playerService.remove(profile),/último administrador/i);
      assert.equal((await c.authService.me(adminId)).user.active,true);
    });
    if(!pg)await t.test('old backups without the new tables remain ingestible without approving pending users',async()=>{
      // Materialize only this isolated adapter's remaining files for a verified SQLite export.
      fs.mkdirSync(path.join(directory,'uploads'),{recursive:true});
      for(const row of await db.prepare('SELECT stored_name FROM media_assets').all()) {
        assert(/^[a-zA-Z0-9_.-]+$/.test(row.stored_name));
        fs.writeFileSync(path.join(directory,'uploads',row.stored_name),files.get(row.stored_name)!);
      }
      const packet=JSON.parse(gunzipSync(await migration.exportData()).toString());
      delete packet.tables.registration_requests;delete packet.tables.media_deletion_jobs;
      const upgraded=new FileMigrationStore(getDb(),directory).validateForImport(gzipSync(JSON.stringify(packet)));
      assert.deepEqual(upgraded.tables.registration_requests.rows,[]);assert.deepEqual(upgraded.tables.media_deletion_jobs.rows,[]);
    });
  } finally {if(pg){await pg.execute('DROP SCHEMA futapp CASCADE');await pg.close();}}
});
