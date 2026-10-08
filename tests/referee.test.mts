import {after,afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import Database from 'better-sqlite3';
import {refereeDeadline,splitReferee} from '../backend/src/domain/referee';
import {testPostgres} from './postgres-helper.mts';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'futapp-referee-tests-'));
process.env.DB_PATH=path.join(directory,'portal.db');process.env.NODE_ENV='test';process.env.JWT_SECRET='isolated-referee-test-secret-12345678901234567890';
const {migrate}=await import('../backend/src/adapters/out/persistence/migrate');
const {getDb,closeDb}=await import('../backend/src/adapters/out/persistence/database');
const {createContainer}=await import('../backend/src/container');
const {createHttpServer}=await import('../backend/src/adapters/in/rest/http-server');
const {getFormation}=await import('../backend/src/domain/formations');
const {migratePostgres}=await import('../backend/src/adapters/out/persistence/postgres-schema');
const {PostgresMigrationStore}=await import('../backend/src/adapters/out/persistence/postgres-migration-store');
const {CloudMediaStorage}=await import('../backend/src/adapters/out/persistence/supabase-storage');
const {PostgresModelStore}=await import('../backend/src/adapters/out/persistence/postgres-model-store');
migrate();const db=getDb(),c=createContainer(),password='Referee test passphrase 123!';
db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run('admin@referee.test',bcrypt.hashSync(password,4),'Admin');
const players=[];for(const [i,position]of ['POR','DEF','DEF','DEF','MED','MED','MED','DEL','DEL'].entries())players.push(await c.playerService.create({email:`player${i}@referee.test`,password,fullName:`Jugador ${i}`,position:position as any}));
const image=await sharp({create:{width:8,height:8,channels:3,background:'#d8b86a'}}).png().toBuffer();
const iso=(time=Date.now())=>new Date(time).toISOString();
const kickoff=(hours=96)=>iso(Date.now()+hours*3600000-5*3600000).slice(0,16);
const game=(hours=96)=>c.matchService.create({opponent:'Rival arbitraje',competition:'Liga',kickOff:kickoff(hours),isHome:true,tournamentId:null,format:8});
async function receipt(instance:typeof c,matchId:number,userId:number,amount:number,paidAt=iso(),key=randomUUID()) {
  return instance.qrPaymentService.submit(userId,{kind:'referee',targetId:matchId,amount,reference:'REF-'+key,paidAt,idempotencyKey:key},'pago.png',image);
}
async function approve(instance:typeof c,id:number){return instance.qrPaymentService.review(id,1,'aprobado','Fecha, hora y monto verificados en el comprobante');}
const admin=(await c.authService.login({email:'admin@referee.test',password})).token;
const playerToken=(await c.authService.login({email:players[0].user.email,password})).token;
const server=createHttpServer({notifications:c.notificationService,qrPayments:c.qrPaymentService,tournaments:c.tournamentService,media:c.mediaService,auth:c.authService,me:c.meService,players:c.playerService,inscriptions:c.inscriptionService,uniforms:c.uniformService,matches:c.matchService,sanctions:c.sanctionService,stats:c.statsService,ai:c.aiService,dashboard:c.dashboardService,settings:c.settingsService,migration:c.migrationService}).listen(0,'127.0.0.1');
await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert(address&&typeof address!=='string');
const base=`http://127.0.0.1:${address.port}/api`;
after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));closeDb();assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});});
afterEach(()=>{db.exec("DELETE FROM match_referee_transfers; DELETE FROM payment_receipts; DELETE FROM matches; DELETE FROM media_assets WHERE purpose='receipt'");});

test('referee deadline is 48 hours in Colombia and integer shares sum to exactly 120000',()=>{
  assert.equal(refereeDeadline('2026-10-11T18:00'),'2026-10-09T23:00:00.000Z');
  for(const count of [0,1,7,8,9,12,22]){
    const split=splitReferee(120000,Array.from({length:count},(_,i)=>i+1));
    assert.equal([...split.values()].reduce((sum,value)=>sum+value,0),count?120000:0);
    assert([...split.values()].every(Number.isInteger));
  }
  assert.deepEqual([...splitReferee(120000,[3,1,2,1])],[[1,40000],[2,40000],[3,40000]]);
});

test('date confirmation creates referee billing; only confirmed attendees share it and own financial views stay private',async()=>{
  const match=await game();const empty=await c.matchService.referee(match.id);assert.equal(empty.total,120000);assert.equal(empty.attendees,0);
  await assert.rejects(()=>receipt(c,match.id,players[0].user.id,120000));
  await Promise.all(players.map(player=>c.matchService.setAttendance(match.id,player.user.id,'confirmado')));
  const view=await c.matchService.referee(match.id);assert.equal(view.attendees,9);assert.equal(view.rows.reduce((sum,row)=>sum+row.amount,0),120000);
  const own=await fetch(base+`/matches/${match.id}/referee`,{headers:{Authorization:'Bearer '+playerToken}});assert.equal(own.status,200);
  const visible=await own.json();assert.equal(visible.rows.length,1);assert.equal(visible.rows[0].playerId,players[0].player.id);assert.equal(visible.collected,undefined);
  assert.equal((await fetch(base+`/matches/${match.id}/referee`)).status,401);
  await c.matchService.setAttendance(match.id,players[8].user.id,'no_disponible');
  assert((await c.matchService.referee(match.id)).rows.filter(row=>row.amount>0).every(row=>row.amount===15000));
});

test('pending and partial payments cannot start; complete late payments appear only on the AI bench',async()=>{
  const match=await c.matchService.create({opponent:'Control del plazo',competition:'Liga',kickOff:kickoff(47),isHome:true,tournamentId:null,format:8});
  for(const player of players.slice(0,8))await c.matchService.setAttendance(match.id,player.user.id,'confirmado');
  const due=refereeDeadline(match.kickOff);
  for(const player of players.slice(0,6))await approve(c,(await receipt(c,match.id,player.user.id,15000,due)).id);
  const pending=await receipt(c,match.id,players[6].user.id,15000,due);
  await approve(c,(await receipt(c,match.id,players[7].user.id,7500,due)).id);
  assert.equal((await c.matchService.attendance(match.id)).find(row=>row.playerId===players[7].player.id)!.benchEligible,false);
  await approve(c,(await receipt(c,match.id,players[7].user.id,7500,iso())).id);
  const attendance=await c.matchService.attendance(match.id),late=attendance.find(row=>row.playerId===players[7].player.id)!;
  assert.equal(late.starterEligible,false);assert.equal(late.benchEligible,true);assert.match(late.reason!,/solo suplente/);
  assert.equal(attendance.find(row=>row.playerId===players[6].player.id)!.benchEligible,false);
  const xi=await c.aiService.recommendXi(match.id);assert.equal(xi.lineup.length,8);assert.equal(xi.lineup.filter(row=>row.playerId!==null).length,6);
  const practice=(await c.aiService.playerInsight(players[0].player.id,match.id)).preparation;
  assert.equal(practice.trainingScope,'partido');assert.equal(practice.lineup.length,0);
  assert.deepEqual(practice.trainingLineup.map(slot=>slot.playerId),xi.lineup.map(slot=>slot.playerId));
  assert(practice.trainingLineup.every(slot=>slot.playerId!==players[7].player.id&&slot.playerId!==players[6].player.id));
  assert(xi.lineup.every(row=>row.playerId!==players[7].player.id&&row.playerId!==players[6].player.id));
  assert(xi.bench?.some(row=>row.playerId===players[7].player.id));assert(!xi.bench?.some(row=>row.playerId===players[6].player.id));
  const slots=getFormation('1-3-3-1',8).slots.map((slot,i)=>({...slot,playerId:players[i].player.id}));
  await assert.rejects(()=>c.matchService.setLineup(match.id,slots));await assert.rejects(()=>c.matchService.publishLineup(match.id));
  await c.matchService.setAttendance(match.id,players[8].user.id,'confirmado');
  const share=(await c.matchService.referee(match.id)).rows.find(row=>row.playerId===players[8].player.id)!.amount;
  await approve(c,(await receipt(c,match.id,players[8].user.id,share,due)).id);await approve(c,pending.id);
  const complete=await c.aiService.recommendXi(match.id);assert.equal(complete.lineup.filter(slot=>slot.playerId!==null).length,8);
  await c.matchService.setLineup(match.id,complete.lineup);await c.matchService.publishLineup(match.id);
  await c.matchService.setAttendance(match.id,players[0].user.id,'no_disponible');
  assert.equal((await c.matchService.get(match.id)).match.lineupPublishedAt,null);
  assert.equal((await c.matchService.attendance(match.id)).find(row=>row.playerId===players[8].player.id)!.starterEligible,false);
});

test('recalculation preserves paid receipts and exposes credits; cancelled matches cannot be deleted with financial history',async()=>{
  const match=await game();await c.matchService.setAttendance(match.id,players[0].user.id,'confirmado');
  const submitted=await receipt(c,match.id,players[0].user.id,120000);
  await c.matchService.setAttendance(match.id,players[1].user.id,'confirmado');
  await approve(c,submitted.id);let row=(await c.matchService.referee(match.id)).rows.find(row=>row.playerId===players[0].player.id)!;assert.equal(row.amount,60000);assert.equal(row.paid,120000);assert.equal(row.credit,60000);
  await c.matchService.update(match.id,{status:'cancelado'});row=(await c.matchService.referee(match.id)).rows.find(row=>row.playerId===players[0].player.id)!;assert.equal(row.credit,120000);assert.equal(row.starterEligible,false);
  await assert.rejects(()=>c.matchService.remove(match.id),/historial/);
});

test('referee proofs validate timestamps, stay private, deduplicate retries and roll back failed approval',async()=>{
  const match=await game();await c.matchService.setAttendance(match.id,players[0].user.id,'confirmado');
  for(const paidAt of ['2026-10-08','2026-02-30T12:00:00Z',iso(Date.now()+86400000)])await assert.rejects(()=>receipt(c,match.id,players[0].user.id,100,paidAt));
  await assert.rejects(()=>receipt(c,match.id,players[0].user.id,100.5));
  await assert.rejects(()=>receipt(c,match.id,players[1].user.id,100));
  const paidAt=iso(),key=randomUUID();const submitted=await Promise.all([0,1].map(()=>receipt(c,match.id,players[0].user.id,120000,paidAt,key)));
  assert.equal(submitted[0].id,submitted[1].id);
  assert.equal(db.prepare("SELECT count(*) AS n FROM payment_receipts WHERE kind='referee' AND target_id=?").get(match.id).n,1);
  const other=(await c.authService.login({email:players[1].user.email,password})).token;
  assert.equal((await fetch(base+'/media/'+submitted[0].assetId,{headers:{Authorization:'Bearer '+other}})).status,404);
  assert.equal((await fetch(base+`/payment-receipts/${submitted[0].id}/review`,{method:'PUT',headers:{Authorization:'Bearer '+playerToken,'Content-Type':'application/json'},body:'{"status":"aprobado","notes":""}'})).status,403);
  db.exec("CREATE TRIGGER fail_referee_review BEFORE UPDATE OF status ON payment_receipts BEGIN SELECT RAISE(ABORT,'Test interrupted review'); END;");
  await assert.rejects(()=>approve(c,submitted[0].id));assert.equal((await c.matchService.referee(match.id)).rows.find(row=>row.playerId===players[0].player.id)!.paid,0);
  db.exec('DROP TRIGGER fail_referee_review');await Promise.all([0,1].map(()=>approve(c,submitted[0].id)));
  assert.equal((await c.matchService.referee(match.id)).rows.find(row=>row.playerId===players[0].player.id)!.paid,120000);
});

test('rescheduling recomputes the deadline and removes players who no longer meet the starter rule',async()=>{
  const match=await game();await c.matchService.setAttendance(match.id,players[0].user.id,'confirmado');
  await approve(c,(await receipt(c,match.id,players[0].user.id,120000)).id);
  const slots=getFormation('1-3-3-1',8).slots.map(slot=>({...slot,playerId:slot.role==='POR'?players[0].player.id:null}));
  await c.matchService.setLineup(match.id,slots);assert.equal((await c.matchService.get(match.id)).lineup[0].playerId,players[0].player.id);
  await c.matchService.update(match.id,{kickOff:kickoff(24)});
  const row=(await c.matchService.referee(match.id)).rows.find(row=>row.playerId===players[0].player.id)!;assert.equal(row.status,'tardio');assert.equal(row.benchEligible,true);
  assert((await c.matchService.get(match.id)).lineup.every(slot=>slot.playerId===null));
});

test('a completed match preserves its billed shares when an attendee later becomes inactive',async()=>{
  const match=await game();
  for(const player of players.slice(0,2))await c.matchService.setAttendance(match.id,player.user.id,'confirmado');
  await approve(c,(await receipt(c,match.id,players[0].user.id,60000)).id);
  await c.matchService.update(match.id,{status:'jugado'});
  db.prepare('UPDATE users SET active=0 WHERE id=?').run(players[1].user.id);
  try {
    const view=await c.matchService.referee(match.id);
    assert.equal(view.attendees,2);assert.equal(view.rows.find(row=>row.playerId===players[0].player.id)!.amount,60000);
    assert.equal(view.rows.find(row=>row.playerId===players[1].player.id)!.outstanding,60000);
    await assert.rejects(()=>c.matchService.setAttendance(match.id,players[0].user.id,'no_disponible'));
  } finally {db.prepare('UPDATE users SET active=1 WHERE id=?').run(players[1].user.id);}
});

test('the actual upload and admin review routes accept referee receipts and cannot bypass pending-payment eligibility',async()=>{
  const match=await game();await c.matchService.setAttendance(match.id,players[0].user.id,'confirmado');
  const upload=async(paidAt:string,key:string)=>{
    const body=new FormData();body.append('file',new Blob([Uint8Array.from(image)]),'soporte.png');
    for(const [field,value]of Object.entries({kind:'referee',targetId:match.id,amount:120000,reference:'HTTP-'+key,paidAt}))body.append(field,String(value));
    const response=await fetch(base+'/me/payment-receipts',{method:'POST',headers:{Authorization:'Bearer '+playerToken,'Idempotency-Key':key},body});
    return {status:response.status,data:await response.json()};
  };
  assert.equal((await upload('2026-10-08',randomUUID())).status,400);
  const submitted=await upload(iso(),randomUUID());assert.equal(submitted.status,200);assert.equal(submitted.data.kind,'referee');
  assert.equal((await c.matchService.attendance(match.id)).find(row=>row.playerId===players[0].player.id)!.eligible,false);
  const review=await fetch(base+`/payment-receipts/${submitted.data.id}/review`,{method:'PUT',headers:{Authorization:'Bearer '+admin,'Content-Type':'application/json'},body:JSON.stringify({status:'aprobado',notes:'Comprobante verificado'})});
  assert.equal(review.status,200);await review.json();
  assert.equal((await c.matchService.attendance(match.id)).find(row=>row.playerId===players[0].player.id)!.eligible,true);
});

test('SQLite upgrades its legacy receipt constraint while preserving records, references and foreign keys',()=>{
  const legacy=new Database(':memory:');
  try {
    migrate(legacy);
    const original=legacy.prepare("SELECT sql FROM sqlite_master WHERE name='payment_receipts'").get() as {sql:string};
    legacy.exec('DROP TABLE payment_receipts');legacy.exec(original.sql.replace("'uniform_issue','referee'","'uniform_issue'"));
    legacy.exec("INSERT INTO users(id,email,password_hash,full_name,role) VALUES(1,'legacy@test.local','hash','Legacy','player'); INSERT INTO players(id,user_id,position) VALUES(1,1,'POR'); INSERT INTO media_assets(id,owner_id,purpose,file_name,stored_name,mime_type,size) VALUES('legacy',1,'receipt','soporte.png','legacy.png','image/png',100)");
    legacy.prepare("INSERT INTO payment_receipts(id,player_id,kind,target_id,asset_id,amount,reference,paid_at,idempotency_key,file_hash,status) VALUES(7,1,'inscription',99,'legacy',15000,'PRESERVE-REF','2026-10-08','legacy-key','hash','aprobado')").run();
    const before=legacy.prepare('SELECT * FROM payment_receipts').all();migrate(legacy);migrate(legacy);
    assert.deepEqual(legacy.prepare('SELECT * FROM payment_receipts').all(),before);
    assert.deepEqual(legacy.pragma('foreign_key_check'),[]);
    assert.match((legacy.prepare("SELECT sql FROM sqlite_master WHERE name='payment_receipts'").get() as {sql:string}).sql,/'referee'/);
    assert(legacy.prepare("SELECT name FROM sqlite_master WHERE name='idx_receipt_approved_reference'").get());
  } finally {legacy.close();}
});

test('an approved absent-player payment carries to the next confirmed date, and only its unpaid difference accepts another receipt',async()=>{
  const first=await game(96),next=await game(168),later=await game(240);
  for(const player of players.slice(0,8))await c.matchService.setAttendance(first.id,player.user.id,'confirmado');
  await approve(c,(await receipt(c,first.id,players[0].user.id,15000)).id);
  await c.matchService.setAttendance(first.id,players[0].user.id,'no_disponible');
  const row=async(id:number,playerId=players[0].player.id)=>(await c.matchService.referee(id)).rows.find(row=>row.playerId===playerId)!;
  assert.equal((await row(first.id)).walletCredit,15000);
  for(const player of players.slice(0,2))await c.matchService.setAttendance(next.id,player.user.id,'confirmado');
  assert.equal((await row(next.id)).creditApplied,15000);assert.equal((await row(next.id)).outstanding,45000);
  assert.equal((await row(next.id)).benchEligible,false);assert.equal((await row(first.id)).creditTransferred,15000);
  await assert.rejects(()=>receipt(c,next.id,players[0].user.id,60000),/supera el saldo/);
  await approve(c,(await receipt(c,next.id,players[0].user.id,45000)).id);
  assert.equal((await row(next.id)).starterEligible,true);assert.equal((await row(next.id)).paid,60000);
  await c.matchService.setAttendance(later.id,players[0].user.id,'confirmado');
  assert.equal((await row(later.id)).creditApplied,0);assert.equal((await row(later.id)).outstanding,120000);
  assert.equal((await row(next.id,players[1].player.id)).creditApplied,0);
  const own=await fetch(base+`/matches/${next.id}/referee`,{headers:{Authorization:'Bearer '+playerToken}});const visible=await own.json();
  assert.equal(visible.rows.length,1);assert.equal(visible.rows[0].creditApplied,15000);
});

test('surplus accumulates across dates and changing attendance releases allocations and clears affected future starters',async()=>{
  const first=await game(96),next=await game(168),later=await game(240);
  await c.matchService.setAttendance(first.id,players[0].user.id,'confirmado');
  const deposit=await receipt(c,first.id,players[0].user.id,120000);await approve(c,deposit.id);
  await c.matchService.setAttendance(first.id,players[0].user.id,'no_disponible');
  for(const match of [next,later])for(const player of players.slice(0,8))await c.matchService.setAttendance(match.id,player.user.id,'confirmado');
  const row=async(id:number)=>(await c.matchService.referee(id)).rows.find(row=>row.playerId===players[0].player.id)!;
  assert.equal((await row(next.id)).creditApplied,15000);assert.equal((await row(later.id)).creditApplied,15000);assert.equal((await row(first.id)).walletCredit,90000);
  assert.equal(db.prepare("SELECT count(*) AS n FROM payment_receipts WHERE kind='referee'").get().n,1);
  const slots=getFormation('1-3-3-1',8).slots.map(slot=>({...slot,playerId:slot.role==='POR'?players[0].player.id:null}));
  await c.matchService.setLineup(next.id,slots);await c.matchService.setLineup(later.id,slots);
  await c.matchService.setAttendance(next.id,players[0].user.id,'no_disponible');
  assert.equal((await row(next.id)).creditApplied,0);assert.equal((await row(first.id)).walletCredit,105000);
  assert((await c.matchService.get(next.id)).lineup.every(slot=>slot.playerId===null));
  await c.matchService.setAttendance(first.id,players[0].user.id,'confirmado');
  assert.equal((await row(first.id)).paid,120000);assert.equal((await row(later.id)).creditApplied,0);
  assert((await c.matchService.get(later.id)).lineup.every(slot=>slot.playerId===null));
});

test('carried credits retain the original transfer time; pending proofs provide no credit and late full coverage only allows the bench',async()=>{
  const first=await game(24),next=await game(36),later=await game(96);
  await c.matchService.setAttendance(first.id,players[0].user.id,'confirmado');
  const proof=await receipt(c,first.id,players[0].user.id,120000);
  await c.matchService.setAttendance(first.id,players[0].user.id,'no_disponible');
  await c.matchService.setAttendance(next.id,players[0].user.id,'confirmado');
  const row=async(id:number)=>(await c.matchService.referee(id)).rows.find(row=>row.playerId===players[0].player.id)!;
  assert.equal((await row(next.id)).creditApplied,0);assert.equal((await row(first.id)).walletCredit,0);
  await approve(c,proof.id);assert.equal((await row(next.id)).creditApplied,120000);
  assert.equal((await row(next.id)).starterEligible,false);assert.equal((await row(next.id)).benchEligible,true);
  await c.matchService.setAttendance(later.id,players[0].user.id,'confirmado');assert.equal((await row(later.id)).paid,0);
  await c.matchService.setAttendance(next.id,players[0].user.id,'no_disponible');
  assert.equal((await row(later.id)).creditApplied,120000);assert.equal((await row(later.id)).starterEligible,true);
  await Promise.all([0,1].map(()=>approve(c,proof.id)));assert.equal((await row(later.id)).paid,120000);
});

test('credits consumed by a completed match survive restart and backup, and cannot be reclaimed or spent a second time',async()=>{
  const first=await game(96),next=await game(168),later=await game(240);
  await c.matchService.setAttendance(first.id,players[0].user.id,'confirmado');await approve(c,(await receipt(c,first.id,players[0].user.id,120000)).id);
  await c.matchService.setAttendance(first.id,players[0].user.id,'no_disponible');
  for(const player of players.slice(0,2))await c.matchService.setAttendance(next.id,player.user.id,'confirmado');
  await c.matchService.update(next.id,{status:'jugado'});
  assert.equal(db.prepare('SELECT amount FROM match_referee_transfers WHERE match_id=?').get(next.id).amount,60000);
  await c.matchService.setAttendance(first.id,players[0].user.id,'confirmado');
  const rebuilt=createContainer(),source=(await rebuilt.matchService.referee(first.id)).rows.find(row=>row.playerId===players[0].player.id)!;
  assert.equal(source.paid,60000);assert.equal(source.outstanding,60000);assert.equal(source.starterEligible,false);
  assert.equal((await rebuilt.matchService.referee(next.id)).rows.find(row=>row.playerId===players[0].player.id)!.creditApplied,60000);
  await c.matchService.setAttendance(later.id,players[0].user.id,'confirmado');
  assert.equal((await rebuilt.matchService.referee(later.id)).rows.find(row=>row.playerId===players[0].player.id)!.creditApplied,0);
  const validator=new (await import('../backend/src/adapters/out/persistence/migration-store')).FileMigrationStore(db,directory);
  const packet=validator.validateForImport(await c.migrationService.exportData());assert.equal(packet.tables.match_referee_transfers.rows.length,1);
  await assert.rejects(()=>c.matchService.remove(next.id),/historial/);
});

test('cancelling a funded completed date returns its credit, preserves the audit and keeps backups valid after reuse',async()=>{
  const first=await game(96),next=await game(168),later=await game(240);
  await c.matchService.setAttendance(first.id,players[0].user.id,'confirmado');await approve(c,(await receipt(c,first.id,players[0].user.id,120000)).id);
  await c.matchService.setAttendance(first.id,players[0].user.id,'no_disponible');
  await c.matchService.setAttendance(next.id,players[0].user.id,'confirmado');await c.matchService.update(next.id,{status:'jugado'});
  await c.matchService.update(next.id,{status:'cancelado'});
  assert.equal((await c.matchService.referee(first.id)).rows.find(row=>row.playerId===players[0].player.id)!.walletCredit,120000);
  await c.matchService.setAttendance(later.id,players[0].user.id,'confirmado');await c.matchService.update(later.id,{status:'jugado'});
  const view=(await c.matchService.referee(later.id)).rows.find(row=>row.playerId===players[0].player.id)!;
  assert.equal(view.creditApplied,120000);assert.equal(view.walletCredit,0);
  const validator=new (await import('../backend/src/adapters/out/persistence/migration-store')).FileMigrationStore(db,directory);
  const packet=validator.validateForImport(await c.migrationService.exportData());assert.equal(packet.tables.match_referee_transfers.rows.length,2);
  packet.tables.match_referee_transfers.rows[1][packet.tables.match_referee_transfers.columns.indexOf('amount')]=120001;
  assert.throws(()=>validator.validateForImport(gzipSync(Buffer.from(JSON.stringify(packet)))),/aplicaciones de arbitraje inválidas/);
});

test('closing and rescheduling in one operation freezes credits against the final match date',async()=>{
  const first=await game(96),next=await game(168);
  await c.matchService.setAttendance(first.id,players[0].user.id,'confirmado');await approve(c,(await receipt(c,first.id,players[0].user.id,120000)).id);
  await c.matchService.setAttendance(first.id,players[0].user.id,'no_disponible');await c.matchService.setAttendance(next.id,players[0].user.id,'confirmado');
  assert.equal((await c.matchService.referee(next.id)).rows.find(row=>row.playerId===players[0].player.id)!.creditApplied,120000);
  await c.matchService.update(next.id,{status:'jugado',kickOff:kickoff(80)});
  assert.equal((await c.matchService.referee(next.id)).rows.find(row=>row.playerId===players[0].player.id)!.creditApplied,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM match_referee_transfers').get().n,0);
});

test('PostgreSQL upgrades the old receipt CHECK without losing records and enforces referee eligibility durably',async()=>{
  const pg=await testPostgres(),files=new Map<string,Buffer>();
  const objects={put:async(key:string,data:Buffer)=>{files.set(key,Buffer.from(data));},get:async(key:string)=>files.get(key)!,remove:async(key:string)=>{files.delete(key);}};
  try{
    await migratePostgres(pg);
    await pg.execute("ALTER TABLE payment_receipts DROP CONSTRAINT payment_receipts_kind_check; ALTER TABLE payment_receipts ADD CONSTRAINT payment_receipts_kind_check CHECK(kind IN ('inscription','uniform_request','uniform_issue')); DROP TABLE match_referee_fees");
    await pg.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run('admin@cloud-referee.test',bcrypt.hashSync(password,4),'Admin');
    const cloud={db:pg,media:new CloudMediaStorage(pg,objects),model:new PostgresModelStore(pg),migration:new PostgresMigrationStore(pg,objects)};
    const instance=createContainer(cloud);
    const a=await instance.playerService.create({email:'a@cloud-referee.test',password,fullName:'Arquero',position:'POR'}),b=await instance.playerService.create({email:'b@cloud-referee.test',password,fullName:'Delantero',position:'DEL'});
    const inscription=await instance.inscriptionService.create({playerId:a.player.id,season:'2026',amount:100});
    const previous=await instance.qrPaymentService.submit(a.user.id,{kind:'inscription',targetId:inscription.id,amount:100,reference:'LEGACY-REFERENCE',paidAt:'2026-10-07',idempotencyKey:'legacy_referee_test'},'anterior.png',image);
    await migratePostgres(pg);await migratePostgres(pg);
    assert.equal((await instance.qrPaymentService.view(1,true)).receipts.find(row=>row.id===previous.id)?.reference,'LEGACY-REFERENCE');
    const match=await instance.matchService.create({opponent:'Rival',competition:'Liga',kickOff:kickoff(47),isHome:true,tournamentId:null,format:8});
    await Promise.all([a,b].map(player=>instance.matchService.setAttendance(match.id,player.user.id,'confirmado')));
    const due=refereeDeadline(match.kickOff);await approve(instance,(await receipt(instance,match.id,a.user.id,60000,due)).id);
    const late=await receipt(instance,match.id,b.user.id,60000);await Promise.all([0,1].map(()=>approve(instance,late.id)));
    const rebuilt=createContainer(cloud),xi=await rebuilt.aiService.recommendXi(match.id);
    assert.equal(xi.lineup.filter(slot=>slot.playerId!==null).length,1);assert.equal(xi.lineup.find(slot=>slot.role==='POR')?.playerId,a.player.id);assert(xi.bench?.some(row=>row.playerId===b.player.id));
    assert.equal((await rebuilt.matchService.referee(match.id)).collected,120000);
    await rebuilt.matchService.update(match.id,{status:'jugado'});
    await pg.prepare('UPDATE users SET active=0 WHERE id=?').run(b.user.id);
    assert.equal((await createContainer(cloud).matchService.referee(match.id)).rows.find(row=>row.playerId===b.player.id)?.amount,60000);
    await pg.prepare('UPDATE users SET active=1 WHERE id=?').run(b.user.id);
    const source=await instance.matchService.create({opponent:'Origen saldo',competition:'Liga',kickOff:kickoff(96),isHome:true,tournamentId:null,format:8});
    await instance.matchService.setAttendance(source.id,a.user.id,'confirmado');
    await approve(instance,(await receipt(instance,source.id,a.user.id,120000)).id);
    await instance.matchService.setAttendance(source.id,a.user.id,'no_disponible');
    const next=await instance.matchService.create({opponent:'Siguiente fecha',competition:'Liga',kickOff:kickoff(168),isHome:true,tournamentId:null,format:8});
    for(const player of [a,b])await instance.matchService.setAttendance(next.id,player.user.id,'confirmado');
    const before=(await instance.matchService.referee(next.id)).rows.find(row=>row.playerId===a.player.id)!;
    assert.equal(before.creditApplied,60000);assert.equal(before.walletCredit,60000);assert.equal(before.starterEligible,true);
    await instance.matchService.update(next.id,{status:'jugado'});
    const durable=createContainer(cloud),funded=(await durable.matchService.referee(next.id)).rows.find(row=>row.playerId===a.player.id)!;
    assert.equal(funded.creditApplied,60000);assert.equal(funded.walletCredit,60000);
    assert.equal((await pg.prepare('SELECT amount FROM match_referee_transfers WHERE match_id=?').get(next.id)).amount,60000);
    const exported=await durable.migrationService.exportData(),validated=new (await import('../backend/src/adapters/out/persistence/migration-store')).FileMigrationStore(db,directory).validateForImport(exported);
    assert.equal(validated.tables.match_referee_transfers.rows.length,1);
  } finally { if(process.env.TEST_DATABASE_URL)await pg.execute('DROP SCHEMA futapp CASCADE');await pg.close(); }
});

test('backups from before referee billing remain importable with original hashes and trusted new defaults',async()=>{
  const match=await game();await c.matchService.setAttendance(match.id,players[0].user.id,'confirmado');
  await c.matchService.update(match.id,{status:'jugado'});
  const bytes=await c.migrationService.exportData(),packet=JSON.parse(gunzipSync(bytes).toString());
  const validator=new (await import('../backend/src/adapters/out/persistence/migration-store')).FileMigrationStore(db,directory);
  const previous=structuredClone(packet);delete previous.tables.match_referee_transfers;
  const compatible=validator.validateForImport(gzipSync(Buffer.from(JSON.stringify(previous))));
  assert.deepEqual(compatible.tables.match_referee_fees,packet.tables.match_referee_fees);assert.deepEqual(compatible.tables.match_referee_transfers.rows,[]);
  const corrupted=structuredClone(packet),sharesColumn=corrupted.tables.match_referee_fees.columns.indexOf('settled_shares');
  corrupted.tables.match_referee_fees.rows[0][sharesColumn]='{"invalid":true}';
  assert.throws(()=>validator.validateForImport(gzipSync(Buffer.from(JSON.stringify(corrupted)))),/cuotas inválidas/);
  delete packet.tables.match_referee_fees;
  delete packet.tables.match_referee_transfers;
  packet.tables.matches.rows[0][packet.tables.matches.columns.indexOf('status')]='programado';
  // Old archives cannot contain the new payment kind.
  packet.tables.payment_receipts.rows=packet.tables.payment_receipts.rows.filter((row:any[])=>row[packet.tables.payment_receipts.columns.indexOf('kind')]!=='referee');
  const upgraded=validator.validateForImport(gzipSync(Buffer.from(JSON.stringify(packet))));
  assert(upgraded.tables.match_referee_fees.rows.length>0);
  assert.deepEqual(upgraded.tables.users,packet.tables.users);assert.deepEqual(upgraded.files,packet.files);
});
