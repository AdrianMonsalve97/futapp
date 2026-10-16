import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {testPostgres} from './postgres-helper.mts';
import {filterPaymentHistory,paymentDay} from '../frontend/src/utils/payment-history';
import type {PaymentHistoryEntry} from '../backend/src/domain/payments';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'futapp-commerce-'));
process.env.DB_PATH=path.join(directory,'fixture.db');process.env.NODE_ENV='test';process.env.JWT_SECRET='isolated-commerce-tests-secret-1234567890';
const {migrate}=await import('../backend/src/adapters/out/persistence/migrate');
const {migratePostgres}=await import('../backend/src/adapters/out/persistence/postgres-schema');
const {getDb,closeDb}=await import('../backend/src/adapters/out/persistence/database');
const {asAsyncDatabase}=await import('../backend/src/adapters/out/persistence/async-database');
const {createContainer}=await import('../backend/src/container');
const {createHttpServer}=await import('../backend/src/adapters/in/rest/http-server');
const {CloudMediaStorage}=await import('../backend/src/adapters/out/persistence/supabase-storage');
const {FileMigrationStore}=await import('../backend/src/adapters/out/persistence/migration-store');
const {PostgresMigrationStore}=await import('../backend/src/adapters/out/persistence/postgres-migration-store');
after(()=>{closeDb();assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});});

for(const dialect of ['sqlite','postgres'] as const)test(`${dialect}: deleted orders and complete payment history preserve money, files and ownership`,async t=>{
  migrate();const pg=dialect==='postgres'?await testPostgres():null;if(pg)await migratePostgres(pg);
  const db=pg??asAsyncDatabase(getDb()),files=new Map<string,Buffer>(),objects={put:async(key:string,data:Buffer)=>{files.set(key,Buffer.from(data));},get:async(key:string)=>files.get(key)!,remove:async(key:string)=>{files.delete(key);}};
  const c=createContainer({db,media:new CloudMediaStorage(db,objects),model:{load:async()=>null,save:async()=>{}}} as any),password='Commerce fixture 123!';
  const adminId=Number((await db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run(`admin-${dialect}@test.local`,bcrypt.hashSync(password,4),'Administrador de prueba')).lastInsertRowid);
  const player=await c.playerService.create({email:`owner-${dialect}@test.local`,password,fullName:'Andrés Jugador',position:'MED',shirtNumber:5});
  const teammate=await c.playerService.create({email:`other-${dialect}@test.local`,password,fullName:'Compañero',position:'POR'});
  const admin=(await c.authService.login({email:`admin-${dialect}@test.local`,password})).token,own=(await c.authService.login({email:player.user.email,password})).token,other=(await c.authService.login({email:teammate.user.email,password})).token;
  const server=createHttpServer({notifications:c.notificationService,qrPayments:c.qrPaymentService,tournaments:c.tournamentService,media:c.mediaService,auth:c.authService,me:c.meService,players:c.playerService,inscriptions:c.inscriptionService,uniforms:c.uniformService,matches:c.matchService,sanctions:c.sanctionService,stats:c.statsService,ai:c.aiService,dashboard:c.dashboardService,settings:c.settingsService}).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
  const request=async(method:string,url:string,body?:unknown,token=admin)=>{const response=await fetch(base+'/api'+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {response,status:response.status,data:await response.json() as any};};
  const image=await sharp({create:{width:30,height:30,channels:3,background:'#d8b86a'}}).png().toBuffer();let sequence=0;
  const upload=(kind:'inscription'|'uniform_request',targetId:number,amount:number)=>c.qrPaymentService.submit(player.user.id,{kind,targetId,amount,reference:`COMMERCE-${dialect}-${++sequence}`,paidAt:'2026-10-14',idempotencyKey:`commerce_${dialect}_${sequence}`},'prueba.png',image);
  const shirt=await c.uniformService.createUniform({name:'Camiseta visitante de prueba',kind:'camiseta',variant:'alterna',price:50000,stock:8});
  const order=()=>c.meService.createUniformRequest(player.user.id,{uniformId:shirt.id,size:'8',recipientType:'hijo',recipientName:'Familiar de prueba',reason:'Nombre en espalda'});
  try{
    await t.test('manual payments and approved QR receipts appear exactly once, including old seasons and settled debts',async()=>{
      const inscription=await c.inscriptionService.create({playerId:player.player.id,season:'2024',concept:'Liga anterior',amount:30000});
      await c.inscriptionService.addPayment(inscription.id,{amount:10000,method:'efectivo',reference:'MANUAL-CASH',paidAt:'2024-02-01',registeredBy:adminId,notes:'Abono presencial'});
      const receipt=await upload('inscription',inscription.id,20000);await c.qrPaymentService.review(receipt.id,adminId,'aprobado','Transferencia validada');
      const mine=await request('GET','/me/payment-receipts',undefined,own),history=mine.data.history.filter((row:any)=>row.kind==='inscription'&&row.targetId===inscription.id);
      assert.equal(mine.status,200);assert.equal(history.length,2);assert.equal(history.reduce((sum:number,row:any)=>sum+row.amount,0),30000);
      assert.equal(history.find((row:any)=>row.method==='efectivo').assetId,null);assert.equal(history.find((row:any)=>row.method==='qr').receiptId,receipt.id);assert(history.every((row:any)=>row.concept==='Liga anterior · 2024'));
      assert(!JSON.stringify(mine.data).includes('idempotencyKey'));assert(!JSON.stringify(mine.data).includes('fileHash'));
      const peer=await c.inscriptionService.create({playerId:teammate.player.id,season:'2025',concept:'Concepto privado del compañero',amount:12000});await c.inscriptionService.addPayment(peer.id,{amount:12000,method:'transferencia'});
      assert((await request('GET','/payment-receipts')).data.history.some((row:any)=>row.playerId===teammate.player.id));
      assert((await request('GET','/me/payment-receipts',undefined,own)).data.history.every((row:any)=>row.playerId===player.player.id));
      assert((await request('GET','/me/payment-receipts',undefined,other)).data.history.every((row:any)=>row.playerId===teammate.player.id));
      assert.equal((await request('GET','/payment-receipts',undefined,own)).status,403);assert.equal((await request('GET','/payment-receipts',undefined,'')).status,401);
      const extra=await c.inscriptionService.create({playerId:player.player.id,season:'2026',amount:1000}),legacyMismatch=await upload('inscription',extra.id,100);
      await db.prepare('UPDATE payment_receipts SET target_id=? WHERE id=?').run(peer.id,legacyMismatch.id);
      try{assert(!(await request('GET','/me/payment-receipts',undefined,own)).data.history.some((row:any)=>row.concept.includes('Concepto privado del compañero')));}finally{await db.prepare('UPDATE payment_receipts SET target_id=? WHERE id=?').run(extra.id,legacyMismatch.id);}
    });
    await t.test('imported balances have no invented date or proof and do not double count a legacy approved receipt',async()=>{
      const legacy=await c.inscriptionService.create({playerId:player.player.id,season:'2023',amount:60000});const receipt=await upload('inscription',legacy.id,15000);
      await db.prepare("UPDATE payment_receipts SET status='aprobado' WHERE id=?").run(receipt.id);await db.prepare('UPDATE inscriptions SET paid=20000 WHERE id=?').run(legacy.id);
      const rows=(await c.qrPaymentService.view(player.user.id,false)).history.filter(row=>row.kind==='inscription'&&row.targetId===legacy.id);
      assert.equal(rows.reduce((sum,row)=>sum+row.amount,0),20000);const opening=rows.find(row=>row.openingBalance)!;assert.equal(opening.amount,5000);assert.equal(opening.paidAt,null);assert.equal(opening.assetId,null);assert.match(opening.notes,/sin movimiento/);
      const unfinished=await c.inscriptionService.create({playerId:player.player.id,season:'2022',amount:1000}),unreviewed=await upload('inscription',unfinished.id,100);
      await c.inscriptionService.addPayment(unfinished.id,{amount:100,method:'qr',reference:unreviewed.reference,paidAt:unreviewed.paidAt,idempotencyKey:'receipt_'+unreviewed.id,notes:'Soporte QR #'+unreviewed.id});
      assert((await c.qrPaymentService.view(player.user.id,false)).history.some(row=>row.receiptId===unreviewed.id&&row.status==='pendiente'));
    });
    await t.test('an approved order can be removed by admin while approved money, recipient and original files remain',async()=>{
      const {request:row}=await order();await c.uniformService.updateRequest(row.id,{status:'aprobada'});
      const approved=await upload('uniform_request',row.id,20000),pending=await upload('uniform_request',row.id,10000);await c.qrPaymentService.review(approved.id,adminId,'aprobado','Válido');
      const beforeFiles=files.size,stock=(await c.uniformService.listUniforms()).find(item=>item.id===shirt.id)!.stock;
      assert.equal((await request('DELETE',`/uniform-requests/${row.id}`,undefined,own)).status,403);assert.equal((await request('DELETE',`/uniform-requests/${row.id}`,undefined,'')).status,401);
      assert.equal((await request('DELETE',`/uniform-requests/${row.id}`)).status,200);assert.equal((await request('DELETE',`/uniform-requests/${row.id}`)).status,404);
      assert(!(await c.uniformService.listRequests()).some(item=>item.id===row.id));assert(!(await c.meService.getUniforms(player.user.id)).requests.some(item=>item.id===row.id));
      const view=await c.qrPaymentService.view(player.user.id,false),debt=view.debts.find(item=>item.kind==='uniform_request'&&item.targetId===row.id)!;
      assert.equal(debt.cancelled,true);assert.equal(debt.outstanding,0);assert.equal(debt.paid,20000);assert.equal(debt.pending,0);
      assert.equal(view.receipts.find(item=>item.id===approved.id)!.status,'aprobado');assert.equal(view.receipts.find(item=>item.id===pending.id)!.status,'rechazado');
      const movement=view.history.find(item=>item.receiptId===approved.id)!;assert.equal(movement.requestDeleted,true);assert.match(movement.concept,/Familiar de prueba/);assert.equal(movement.assetId,approved.assetId);
      assert.equal(files.size,beforeFiles);assert.equal((await c.uniformService.listUniforms()).find(item=>item.id===shirt.id)!.stock,stock);
      const media=await fetch(base+'/api/media/'+approved.assetId,{headers:{Authorization:'Bearer '+own}});assert.equal(media.status,200);await media.arrayBuffer();
      await assert.rejects(()=>upload('uniform_request',row.id,1000),/eliminada/);await assert.rejects(()=>c.qrPaymentService.review(pending.id,adminId,'aprobado',''));
      assert.equal((await request('PUT',`/uniform-requests/${row.id}`,{status:'entregada'})).status,404);
      const download=await fetch(base+'/api/uniform-requests/export',{headers:{Authorization:'Bearer '+admin}});assert.equal(download.status,200);const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await download.arrayBuffer()));const ids:any[]=[];book.getWorksheet('Solicitudes')!.eachRow((cells,index)=>{if(index>=5)ids.push(cells.getCell(1).value);});assert(!ids.includes(row.id));
    });
    await t.test('removing a delivered request never reverses stock, duplicates its charge or loses a pending receipt',async()=>{
      const {request:row}=await order(),delivered=await c.uniformService.updateRequest(row.id,{status:'entregada'}),proof=await upload('uniform_request',row.id,5000);
      const stock=(await c.uniformService.listUniforms()).find(item=>item.id===shirt.id)!.stock;
      await c.uniformService.removeRequest(row.id,adminId);
      const view=await c.qrPaymentService.view(player.user.id,false),debt=view.debts.find(item=>item.kind==='uniform_request'&&item.targetId===row.id)!;
      assert.equal(debt.cancelled,false);assert.equal(debt.outstanding,50000);assert.equal(debt.pending,5000);assert(!view.debts.some(item=>item.kind==='uniform_issue'&&item.targetId===delivered.issueId));
      assert.equal((await c.uniformService.listUniforms()).find(item=>item.id===shirt.id)!.stock,stock);assert((await c.uniformService.listIssues()).some(item=>item.id===delivered.issueId));
      await c.qrPaymentService.review(proof.id,adminId,'aprobado','Entrega real');assert.equal((await c.qrPaymentService.view(player.user.id,false)).history.find(item=>item.receiptId===proof.id)!.amount,5000);
    });
    await t.test('delete and pending review are atomic; a persistence failure leaves the original request visible',async()=>{
      const {request:row}=await order(),proof=await upload('uniform_request',row.id,5000);
      if(pg)await pg.execute("CREATE FUNCTION fail_order_removal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Isolated removal failure'; END; $$; CREATE TRIGGER fail_order_removal BEFORE UPDATE ON payment_receipts FOR EACH ROW EXECUTE FUNCTION fail_order_removal();");
      else getDb().exec("CREATE TRIGGER fail_order_removal BEFORE UPDATE ON payment_receipts BEGIN SELECT RAISE(ABORT,'Isolated removal failure'); END");
      try{await assert.rejects(()=>c.uniformService.removeRequest(row.id,adminId));}finally{if(pg)await pg.execute('DROP TRIGGER fail_order_removal ON payment_receipts; DROP FUNCTION fail_order_removal()');else getDb().exec('DROP TRIGGER fail_order_removal');}
      assert((await c.uniformService.listRequests()).some(item=>item.id===row.id));assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM uniform_request_deletions WHERE request_id=?').get(row.id)).n,0);assert.equal((await c.qrPaymentService.view(player.user.id,false)).receipts.find(item=>item.id===proof.id)!.status,'pendiente');
      await c.uniformService.removeRequest(row.id,adminId);
      for(const status of ['pendiente','rechazada'] as const){const {request:extra}=await order();if(status==='rechazada')await c.uniformService.updateRequest(extra.id,{status});await c.uniformService.removeRequest(extra.id,adminId);assert(!(await c.uniformService.listRequests()).some(item=>item.id===extra.id));}
    });
    await t.test('backups retain deletions and history, accept previous snapshots and restore the audit references',async()=>{
      if(!pg){fs.mkdirSync(path.join(directory,'uploads'),{recursive:true});for(const row of await db.prepare('SELECT stored_name FROM media_assets').all())fs.writeFileSync(path.join(directory,'uploads',row.stored_name),files.get(row.stored_name)!);}
      const source=pg?new PostgresMigrationStore(pg,objects):new FileMigrationStore(getDb(),directory),bytes=await source.exportData(),packet=JSON.parse(gunzipSync(bytes).toString());assert(packet.tables.uniform_request_deletions.rows.length>=4);
      const target=new Database(':memory:');try{migrate(target);const destination=new FileMigrationStore(target,path.join(directory,'restored-'+dialect));const old=structuredClone(packet);delete old.tables.uniform_request_deletions;assert.deepEqual(destination.validateForImport(gzipSync(JSON.stringify(old))).tables.uniform_request_deletions.rows,[]);
        target.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES('bootstrap@test.local','test','Bootstrap','admin')").run();destination.enable(true);const preview=await destination.preview(1,bytes);await destination.commit(1,preview.id,'IMPORTAR');assert.equal(target.prepare('SELECT COUNT(*) AS n FROM uniform_request_deletions').get().n,packet.tables.uniform_request_deletions.rows.length);assert.deepEqual(target.pragma('foreign_key_check'),[]);
        assert.equal(target.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get().n,packet.tables.payment_receipts.rows.length);
      }finally{target.close();}
    });
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));if(pg){await pg.execute('DROP SCHEMA futapp CASCADE');await pg.close();}}
});

test('history filters distinguish categories, states and Colombian calendar dates without inventing dates',()=>{
  const base:PaymentHistoryEntry={id:'a',kind:'uniform_request',targetId:1,playerId:1,playerName:'Andrés',concept:'Camiseta familiar',amount:100,paidAt:'2026-10-15T02:00:00Z',status:'aprobado',method:'qr',reference:'OP-123',notes:'',receiptId:1,assetId:'test',reviewedAt:null,requestDeleted:true,openingBalance:false};
  const rows=[base,{...base,id:'b',kind:'uniform_issue' as const,paidAt:'2026-10-15',status:'rechazado' as const},{...base,id:'c',kind:'inscription' as const,openingBalance:true,paidAt:null}];
  const defaults={search:'',category:'all' as const,status:'',from:'',to:''};
  assert.equal(paymentDay(base.paidAt),'2026-10-14');assert.equal(paymentDay('2026-10-15'),'2026-10-15');
  assert.equal(filterPaymentHistory(rows,{...defaults,category:'uniform',search:'ANDRES'}).length,2);
  assert.deepEqual(filterPaymentHistory(rows,{...defaults,from:'2026-10-14',to:'2026-10-14'}).map(row=>row.id),['a']);
  assert.deepEqual(filterPaymentHistory(rows,{...defaults,status:'rechazado'}).map(row=>row.id),['b']);
  assert.equal(filterPaymentHistory(rows,{...defaults,category:'inscription'}).length,1);
});
