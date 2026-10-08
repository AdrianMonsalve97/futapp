import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'futapp-notifications-'));
process.env.DB_PATH=path.join(directory,'portal.db');process.env.JWT_SECRET='notification-tests-isolated-secret-123456';process.env.NODE_ENV='test';
const {migrate}=await import('../backend/src/adapters/out/persistence/migrate');
const {getDb,closeDb}=await import('../backend/src/adapters/out/persistence/database');
const {createContainer}=await import('../backend/src/container');
const {createHttpServer}=await import('../backend/src/adapters/in/rest/http-server');
const {NotificationService,kickoffTime}=await import('../backend/src/application/services/notification-service');
const {SqliteNotificationRepository}=await import('../backend/src/adapters/out/persistence/repositories/notification.repository');
const {SqliteMatchRepository}=await import('../backend/src/adapters/out/persistence/repositories/match.repository');
const {SqliteUserRepository}=await import('../backend/src/adapters/out/persistence/repositories/user.repository');
const {SqlitePlayerRepository}=await import('../backend/src/adapters/out/persistence/repositories/player.repository');
const {SqliteSettingsRepository}=await import('../backend/src/adapters/out/persistence/repositories/settings.repository');
const {SqliteQrPaymentRepository}=await import('../backend/src/adapters/out/persistence/repositories/qr-payment.repository');
const {SqliteUnitOfWork}=await import('../backend/src/adapters/out/persistence/unit-of-work');
const {SqliteTournamentRepository}=await import('../backend/src/adapters/out/persistence/repositories/tournament.repository');
const {DEFAULT_NOTIFICATION_SETTINGS,NotificationDeliveryError}=await import('../backend/src/domain/notifications');
const {ProviderNotificationTransport}=await import('../backend/src/adapters/out/notifications/provider-transport');
const {EvolutionClient}=await import('../backend/src/adapters/out/notifications/evolution-client');
import type { NotificationJob, NotificationSettings } from '../backend/src/domain/notifications';
import type { NotificationTransport } from '../backend/src/application/ports/out/notification.transport';
migrate();const db=getDb(),c=createContainer();
db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run('admin@notify.test',bcrypt.hashSync('Admin123!',4),'Admin pruebas');
const adminToken=(await c.authService.login({email:'admin@notify.test',password:'Admin123!'})).token;
const player=(await c.playerService.create({email:'player@notify.test',password:'Player1234567890!',fullName:'Jugador avisos',position:'MED'}));
const disabled=(await c.playerService.create({email:'disabled@notify.test',password:'Player1234567890!',fullName:'Sin consentimiento',position:'DEF'}));
const playerToken=(await c.authService.login({email:player.user.email,password:'Player1234567890!'})).token;
let now=Date.parse('2099-01-01T12:00:00Z');
const sent:NotificationJob[]=[];let failure:Error|null=null;
const transport:NotificationTransport={status:()=>({ready:true,missing:[]}),send:async job=>{if(failure)throw failure;sent.push(job);return 'provider_'+job.id;}};
const repo=new SqliteNotificationRepository(db),matches=new SqliteMatchRepository(db);
const notifications=new NotificationService(repo,transport,matches,new SqliteUserRepository(db),new SqlitePlayerRepository(db),new SqliteSettingsRepository(db),new SqliteQrPaymentRepository(db),new SqliteUnitOfWork(db),()=>now,new SqliteTournamentRepository(db));
const app=createHttpServer({notifications,qrPayments:c.qrPaymentService,tournaments:c.tournamentService,media:c.mediaService,auth:c.authService,me:c.meService,players:c.playerService,inscriptions:c.inscriptionService,uniforms:c.uniformService,matches:c.matchService,sanctions:c.sanctionService,stats:c.statsService,ai:c.aiService,dashboard:c.dashboardService,settings:c.settingsService});
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}/api`;
after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));closeDb();assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});});
async function request(method:string,url:string,json?:unknown,token=adminToken) {
  const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(json!==undefined?{body:JSON.stringify(json)}:{})});
  return {status:response.status,data:await response.json()};
}
const configured:NotificationSettings={...DEFAULT_NOTIFICATION_SETTINGS,whatsappProvider:'meta',matchDestination:'players',whatsappEnabled:true,emailEnabled:true,adminWhatsapp:'+573001111111',adminEmail:'owner@notify.test',publicBaseUrl:'https://futapp.example'};
const grouped:NotificationSettings={...configured,whatsappProvider:'evolution',matchDestination:'group',matchGroupId:'120363123456789@g.us',matchGroupName:'Equipo pruebas'};
async function reset() {
  db.exec('DELETE FROM notification_jobs; DELETE FROM notification_match_versions; DELETE FROM notification_preferences; DELETE FROM matches;');
  (await notifications.configure(configured));sent.length=0;failure=null;now=Date.parse('2099-01-01T12:00:00Z');
  (await notifications.savePreferences(player.user.id,{whatsapp:true,email:false,whatsappNumber:'+573002222222',matchAlerts:true,paymentUpdates:true}));
}
async function match(kickOff='2099-01-02T06:00',opponent='Rival avisos') {return (await c.matchService.create({opponent,competition:'Copa F8',kickOff,venue:'Cancha Norte',format:8,minutes:50}));}
async function receipt() {
  const inscription=(await c.inscriptionService.create({playerId:player.player.id,season:'2099',amount:100000,concept:'Inscripción torneo'}));
  const bytes=await sharp({create:{width:20,height:20,channels:3,background:'#ffffff'}}).png().toBuffer();
  const form=new FormData();form.append('file',new Blob([bytes]),'comprobante.png');
  for(const [key,value] of Object.entries({kind:'inscription',targetId:inscription.id,amount:50000,reference:'REF_'+inscription.id,paidAt:'2099-01-01'}))form.append(key,String(value));
  const response=await fetch(base+'/me/payment-receipts',{method:'POST',body:form,headers:{Authorization:`Bearer ${playerToken}`,'Idempotency-Key':'notification_receipt_'+inscription.id}});
  return {status:response.status,data:await response.json(),inscription,form};
}

test('notification configuration is administrative, preferences are private and unknown fields are rejected',async()=>{
  (await reset());
  assert.equal((await request('GET','/notifications',undefined,playerToken)).status,403);
  assert.equal((await request('PUT','/notifications/settings',configured,playerToken)).status,403);
  assert.equal((await request('PUT','/notifications/settings',{...configured,WHATSAPP_ACCESS_TOKEN:'do_not_store'})).status,400);
  assert.equal((await request('PUT','/notifications/settings',{...configured,adminWhatsapp:'3001111111'})).status,400);
  assert.equal((await request('PUT','/notifications/settings',{...configured,publicBaseUrl:'https://user:password@futapp.example'})).status,400);
  assert.equal((await request('PUT','/notifications/settings',{...configured,paymentAlerts:true,adminWhatsapp:''})).status,400);
  assert.equal((await request('PUT','/me/notifications',{...(await repo.preferences(player.user.id)),userId:disabled.user.id},playerToken)).status,400);
  assert.equal((await request('POST','/notifications/test',{channel:'whatsapp'},playerToken)).status,403);
  assert.equal((await repo.preferences(disabled.user.id)).whatsapp,false);
  const missing=new ProviderNotificationTransport({});assert.equal(missing.status('whatsapp').ready,false);
  assert(!JSON.stringify((await notifications.view())).includes('password_hash'));
});

test('individual match notices require tournament enrollment and withdrawn members lose queued reminders',async()=>{
  (await reset());
  const cup=(await c.tournamentService.save(null,{name:'Copa inscritos',leagueName:'Liga',season:'2099',status:'publicado',notes:'',rules:{format:8,periods:2,minutesPerPeriod:25,breakMinutes:5,maxSquad:null,maxSubstitutions:null,rollingSubstitutions:true,allowedFormations:['1-3-3-1'],tacticalStyle:'equilibrado'}}));
  const game=(await c.matchService.create({opponent:'Rival del torneo',kickOff:'2099-01-02T06:00',tournamentId:cup.id}));
  assert.equal((await repo.history()).filter(job=>job.matchId===game.id).length,0);
  assert.equal((await notifications.notifyMatch(game.id)).queued,0);
  (await c.tournamentService.addPlayers(cup.id,[player.player.id]));
  assert.equal((await notifications.notifyMatch(game.id)).queued,1);
  (await c.tournamentService.removePlayer(cup.id,player.player.id));
  await notifications.tick();
  assert.equal(sent.filter(job=>job.matchId===game.id).length,0);
  assert((await repo.history()).filter(job=>job.matchId===game.id).every(job=>job.status==='cancelado'));
  (await notifications.configure(grouped));
  assert.equal((await notifications.notifyMatch(game.id)).queued,1);
  await notifications.tick();
  assert.equal(sent.filter(job=>job.matchId===game.id&&job.message.audience==='group'&&job.kind==='match').length,1);
});

test('match changes atomically enqueue opted-in players, dedupe repeats and notify changes back to previous details',async()=>{
  (await reset());const game=(await match());
  assert.equal((await repo.history()).length,1);assert.equal((await repo.history())[0].recipient,'+573002222222');
  assert.equal((await request('POST',`/matches/${game.id}/notify`,{})).data.queued,0);
  assert.equal(kickoffTime(game),Date.parse('2099-01-02T11:00:00Z'));
  await notifications.tick();assert.equal(sent.filter(j=>j.kind==='match').length,1);
  assert(sent[0].message.detail.includes('Rival avisos'));assert(sent[0].message.detail.includes('50 minutos'));
  const initial=sent[0].message.detail;
  (await c.matchService.update(game.id,{venue:'Cancha Sur'}));await notifications.tick();
  (await c.matchService.update(game.id,{venue:'Cancha Norte'}));await notifications.tick();
  assert.equal(sent.filter(j=>j.kind==='match').length,3);
  assert.equal(sent.filter(j=>j.kind==='match').at(-1)!.message.detail,initial);
  assert(!JSON.stringify(sent).includes('Sin consentimiento'));
});

test('reminders survive reconstruction, are sent once per window, and postpone/cancel/decline preferences suppress stale notices',async()=>{
  (await reset());const game=(await match());
  await notifications.tick();const firstReminder=(await repo.history()).find(j=>j.kind==='reminder_24h'&&j.matchId===game.id);assert(firstReminder);assert.equal(firstReminder.status,'aceptado');
  const sentCount=sent.length;await notifications.tick();assert.equal(sent.length,sentCount);
  now=kickoffTime(game)-3600000;await notifications.tick();assert.equal(sent.filter(j=>j.kind==='reminder_2h'&&j.matchId===game.id).length,1);
  await notifications.tick();assert.equal(sent.filter(j=>j.kind==='reminder_2h'&&j.matchId===game.id).length,1);
  (await c.matchService.update(game.id,{venue:'Otra cancha'}));
  (await notifications.savePreferences(player.user.id,{...(await repo.preferences(player.user.id)),whatsapp:false}));
  await notifications.tick();assert.equal(sent.length,sentCount+1);
  (await notifications.savePreferences(player.user.id,{...(await repo.preferences(player.user.id)),whatsapp:true}));
  const future=(await match('2099-01-04T06:00','Partido pospuesto'));
  (await c.matchService.update(future.id,{status:'pospuesto'}));await notifications.tick();
  assert.equal(sent.filter(j=>j.matchId===future.id&&j.kind==='match').length,1);
  assert.equal(sent.find(j=>j.matchId===future.id)!.message.title,'Partido pospuesto');
  assert.equal((await request('POST',`/matches/${future.id}/notify`,{})).status,400);
  (await c.matchService.update(future.id,{status:'cancelado'}));await notifications.tick();assert(sent.some(j=>j.matchId===future.id&&j.message.title==='Partido cancelado'));
  const pending=(await match('2099-01-10T06:00','Persistente'));
  const restarted=new NotificationService(new SqliteNotificationRepository(db),transport,matches,new SqliteUserRepository(db),new SqlitePlayerRepository(db),new SqliteSettingsRepository(db),new SqliteQrPaymentRepository(db),new SqliteUnitOfWork(db),()=>now);
  await restarted.tick();assert(sent.some(j=>j.matchId===pending.id));
});

test('payment upload and review alerts reach only the configured owner and retries do not duplicate them',async()=>{
  (await reset());const result=await receipt();assert.equal(result.status,200);
  const ownerJobs=(await repo.history()).filter(j=>j.receiptId===result.data.id);assert.equal(ownerJobs.length,2);
  assert(ownerJobs.every(j=>j.userId===null));assert(ownerJobs.every(j=>j.kind==='receipt_uploaded'));
  assert.equal((await c.inscriptionService.list()).find(i=>i.id===result.inscription.id)!.paid,0);
  const again=await fetch(base+'/me/payment-receipts',{method:'POST',body:result.form,headers:{Authorization:`Bearer ${playerToken}`,'Idempotency-Key':'notification_receipt_'+result.inscription.id}});
  assert.equal(again.status,200);assert.equal((await repo.history()).filter(j=>j.receiptId===result.data.id).length,2);
  await notifications.tick();assert.equal(sent.filter(j=>j.receiptId===result.data.id).length,2);
  assert(sent.every(j=>j.message.path==='/admin/pagos-qr'));assert(sent.every(j=>!j.message.detail.includes('assetId')));
  const approved=await request('PUT',`/payment-receipts/${result.data.id}/review`,{status:'aprobado',notes:''});assert.equal(approved.status,200);
  assert.equal((await c.inscriptionService.list()).find(i=>i.id===result.inscription.id)!.paid,50000);await notifications.tick();
  const reviewed=sent.filter(j=>j.kind==='receipt_reviewed');assert.equal(reviewed.length,2);assert(reviewed.every(j=>j.userId===null));assert(reviewed.some(j=>j.recipient===configured.adminWhatsapp));assert(!sent.some(j=>j.recipient==='+573002222222'));
  await request('PUT',`/payment-receipts/${result.data.id}/review`,{status:'aprobado',notes:''});await notifications.tick();assert.equal(sent.filter(j=>j.kind==='receipt_reviewed').length,2);
});

test('failed outbox insertion rolls back receipt and match creation without accepting a phantom payment',async()=>{
  (await reset());const count=(db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get() as any).n;
  db.exec("CREATE TRIGGER fail_notification_job BEFORE INSERT ON notification_jobs BEGIN SELECT RAISE(ABORT,'outbox failure'); END");
  try {
    assert.equal((await receipt()).status,500);assert.equal((db.prepare('SELECT COUNT(*) AS n FROM payment_receipts').get() as any).n,count);
    const matchesCount=(await matches.list()).length;(await assert.rejects(async ()=>(await match())));assert.equal((await matches.list()).length,matchesCount);
  } finally{db.exec('DROP TRIGGER fail_notification_job');}
});

test('reviewed receipts suppress stale administrative alerts and inactive players cannot receive queued notices',async()=>{
  (await reset());const result=await receipt();assert.equal(result.status,200);
  assert.equal((await request('PUT',`/payment-receipts/${result.data.id}/review`,{status:'rechazado',notes:'Soporte ilegible'})).status,200);
  await notifications.tick();assert.equal(sent.filter(j=>j.kind==='receipt_uploaded').length,0);assert.equal(sent.filter(j=>j.kind==='receipt_reviewed').length,2);
  assert.equal((await c.inscriptionService.list()).find(i=>i.id===result.inscription.id)!.paid,0);
  sent.length=0;const game=(await match('2099-02-01T06:00','Cuenta inactiva'));
  db.prepare('UPDATE users SET active=0 WHERE id=?').run(player.user.id);
  try{await notifications.tick();assert.equal(sent.length,0);assert.equal((await repo.history()).find(j=>j.matchId===game.id)!.status,'cancelado');}
  finally{db.prepare('UPDATE users SET active=1 WHERE id=?').run(player.user.id);}
});

test('provider limits stop after three attempts and blocked channels preserve unsent jobs without using attempts',async()=>{
  (await reset());const game=(await match('2099-02-01T06:00','Canal suspendido'));
  (await notifications.configure({...configured,whatsappEnabled:false}));await notifications.tick();
  let job=(await repo.history()).find(j=>j.matchId===game.id)!;assert.equal(job.status,'bloqueado');assert.equal(job.attempts,0);assert.equal(sent.length,0);
  now+=120000;(await notifications.configure(configured));failure=new NotificationDeliveryError('Límite de envío','retry');
  for(let i=0;i<3;i++){await notifications.tick();now+=600000;}
  job=(await repo.find(job.id))!;assert.equal(job.status,'fallido');assert.equal(job.attempts,3);assert.equal(sent.length,0);
  failure=null;await notifications.tick();assert.equal(sent.length,0);
});

test('safe transient failures retry, uncertain sends require explicit retry, and concurrent ticks cannot send twice',async()=>{
  (await reset());const game=(await match('2099-02-01T06:00','Reintentos'));failure=new NotificationDeliveryError('Límite del proveedor','retry');
  await Promise.all([(await notifications.tick()),(await notifications.tick())]);let job=(await repo.history()).find(j=>j.matchId===game.id)!;assert.equal(job.attempts,1);assert.equal(job.status,'pendiente');
  now+=180000;failure=new NotificationDeliveryError('Respuesta sin confirmar','uncertain');await notifications.tick();job=(await repo.find(job.id))!;assert.equal(job.status,'incierto');
  now+=600000;failure=null;await notifications.tick();assert.equal(sent.filter(j=>j.id===job.id).length,0);
  (await notifications.retry(job.id));await notifications.tick();assert.equal(sent.filter(j=>j.id===job.id).length,1);
  (await assert.rejects(async ()=>(await notifications.retry(job.id))));
  const interrupted=(await match('2099-02-02T06:00','Interrumpido'));const claim=(await repo.claim(now));assert.equal(claim?.matchId,interrupted.id);
  now+=180000;await notifications.tick();assert.equal((await repo.find(claim!.id))!.status,'incierto');
});

test('WhatsApp uses approved template payload, keeps secrets server-side and never claims delivery on uncertain responses',async()=>{
  (await reset());(await match('2099-03-01T06:00','Plantillas'));const job=(await repo.history())[0];let payload:any;
  const config={WHATSAPP_ACCESS_TOKEN:'fake-test-token',WHATSAPP_PHONE_NUMBER_ID:'12345',WHATSAPP_API_VERSION:'v26.0'};
  const sender=new ProviderNotificationTransport(config,(async(url,options)=>{
    assert.equal(String(url),'https://graph.facebook.com/v26.0/12345/messages');assert.equal((options!.headers as any).Authorization,'Bearer fake-test-token');
    payload=JSON.parse(options!.body as string);return new Response(JSON.stringify({messages:[{id:'wamid.test'}]}),{status:200});
  }) as typeof fetch);
  assert.equal(await sender.send(job,configured),'wamid.test');assert.equal(payload.type,'template');assert.equal(payload.to,'573002222222');
  assert.equal(payload.template.name,'futapp_partido');assert.equal(payload.template.components[0].parameters.length,4);
  assert.equal(payload.template.components[0].parameters[3].text,'https://futapp.example'+job.message.path);
  const failureSender=new ProviderNotificationTransport(config,(async()=>new Response(JSON.stringify({error:{code:190,message:'fake-test-token internal secret'}}),{status:401})) as typeof fetch);
  await assert.rejects(async ()=>(await failureSender.send(job,configured)),(err:any)=>err.outcome==='failed'&&!err.message.includes('fake-test-token'));
  const uncertain=new ProviderNotificationTransport(config,(async()=>{throw new Error('fake-test-token');}) as typeof fetch);
  await assert.rejects(async ()=>(await uncertain.send(job,configured)),(err:any)=>err.outcome==='uncertain'&&!err.message.includes('fake-test-token'));
  const malformed=new ProviderNotificationTransport(config,(async()=>new Response('{}',{status:200})) as typeof fetch);
  await assert.rejects(async ()=>(await malformed.send(job,configured)),(err:any)=>err.outcome==='uncertain');
});

test('group announcements and reminders are deduplicated while payment uploads and reviews stay private',async()=>{
  (await reset());(await notifications.configure(grouped));const game=(await match());
  assert.equal((await repo.history()).length,1);assert.equal((await repo.history())[0].recipient,grouped.matchGroupId);
  assert.equal((await notifications.notifyMatch(game.id)).queued,0);
  await notifications.tick();await notifications.tick();
  assert.equal(sent.filter(j=>j.kind==='match').length,1);
  assert.equal(sent.filter(j=>j.kind==='reminder_24h').length,1);
  now=kickoffTime(game)-3600000;await notifications.tick();await notifications.tick();
  assert.equal(sent.filter(j=>j.kind==='reminder_2h').length,1);
  assert(sent.every(j=>j.recipient===grouped.matchGroupId&&j.userId===null&&j.receiptId===null&&j.message.audience==='group'));
  const uploaded=await receipt();assert.equal(uploaded.status,200);await notifications.tick();
  assert.equal((await request('PUT',`/payment-receipts/${uploaded.data.id}/review`,{status:'aprobado',notes:''})).status,200);
  await notifications.tick();
  const payments=sent.filter(j=>j.receiptId!==null);assert.equal(payments.length,4);
  assert(payments.every(j=>j.userId===null&&j.message.audience==='admin'&&[grouped.adminWhatsapp,grouped.adminEmail].includes(j.recipient)));
  assert(!sent.some(j=>j.recipient==='+573002222222'));
  assert(!sent.filter(j=>j.recipient===grouped.matchGroupId).some(j=>JSON.stringify(j.message).includes('REF_')));
});

test('switching to a group cancels old player jobs and verifies group membership with administrative-only endpoints',async()=>{
  (await reset());const game=(await match('2099-02-01T06:00'));const old=(await repo.history())[0];
  transport.groups=async()=>[{id:grouped.matchGroupId,name:'Nombre real del grupo'}];
  try {
    for(const endpoint of ['/notifications/whatsapp/groups','/notifications/whatsapp/connection'])assert.equal((await request('GET',endpoint,undefined,playerToken)).status,403);
    for(const endpoint of ['/notifications/whatsapp/connect','/notifications/test-group'])assert.equal((await request('POST',endpoint,{},playerToken)).status,403);
    assert.equal((await request('PUT','/notifications/settings',{...grouped,matchGroupId:'999999999@g.us'})).status,400);
    assert.equal((await request('PUT','/notifications/settings',{...grouped,whatsappProvider:'meta'})).status,400);
    assert.equal((await request('PUT','/notifications/settings',{...grouped,adminWhatsapp:grouped.matchGroupId})).status,400);
    const saved=await request('PUT','/notifications/settings',{...grouped,matchGroupName:'Nombre inventado'});
    assert.equal(saved.status,200);assert.equal(saved.data.settings.matchGroupName,'Nombre real del grupo');
    assert.equal((await notifications.notifyMatch(game.id)).queued,1);await notifications.tick();
    assert.equal((await repo.find(old.id))!.status,'cancelado');assert.equal(sent.length,1);assert.equal(sent[0].recipient,grouped.matchGroupId);
    assert.equal((await notifications.testGroup()).queued,1);assert.equal((await notifications.testGroup()).queued,0);
    await notifications.tick();assert.equal(sent.filter(j=>j.kind==='test').length,1);
  } finally {delete transport.groups;}
});

test('Evolution sends only to the selected joined group and refuses payment or stale membership before sending',async()=>{
  (await reset());(await notifications.configure(grouped));(await match('2099-03-01T06:00'));const job=(await repo.history())[0];
  const calls:string[]=[];let payload:any;let member=true;
  const env={EVOLUTION_API_URL:'http://127.0.0.1:8080',EVOLUTION_API_KEY:'test-evolution-secret',EVOLUTION_INSTANCE:'futapp-bot'};
  const sender=new ProviderNotificationTransport(env,(async(url,options)=>{
    calls.push(String(url));assert.equal((options!.headers as any).apikey,env.EVOLUTION_API_KEY);
    if(String(url).includes('/instance/connectionState/'))return Response.json({instance:{state:'open'}});
    if(String(url).includes('/group/fetchAllGroups/'))return Response.json(member?[{id:grouped.matchGroupId,subject:grouped.matchGroupName,participants:[{id:'private-member'}]}]:[]);
    assert.equal(String(url),'http://127.0.0.1:8080/message/sendText/futapp-bot');
    payload=JSON.parse(options!.body as string);return Response.json({key:{id:'evo.test'}});
  }) as typeof fetch);
  assert.deepEqual(await sender.groups(),[{id:grouped.matchGroupId,name:grouped.matchGroupName}]);
  assert.equal(await sender.send(job,grouped),'evo.test');assert.equal(payload.number,grouped.matchGroupId);assert.equal(payload.linkPreview,false);
  assert(payload.text.includes('F8'));assert(payload.text.includes('50 minutos'));
  const before=calls.length;
  await assert.rejects(async ()=>(await sender.send({...job,kind:'receipt_uploaded',receiptId:1},grouped)),(err:any)=>err.outcome==='failed');
  assert.equal(calls.length,before);
  member=false;const sends=calls.filter(url=>url.includes('/message/sendText/')).length;
  await assert.rejects(async ()=>(await sender.send(job,grouped)),(err:any)=>err.outcome==='blocked');
  assert.equal(calls.filter(url=>url.includes('/message/sendText/')).length,sends);
});

test('pairing QR is generated from protocol data and personal payment destination remains separate',async()=>{
  (await reset());const result=await receipt();const job=(await repo.history()).find(j=>j.channel==='whatsapp')!;
  const urls:string[]=[];let body:any;let connected=false;
  const env={EVOLUTION_API_URL:'https://evolution.example',EVOLUTION_API_KEY:'private-key',EVOLUTION_INSTANCE:'bot'};
  const sender=new EvolutionClient(env,(async(url,options)=>{
    urls.push(String(url));
    if(String(url).includes('/instance/connectionState/'))return Response.json({instance:{state:connected?'open':'close'}});
    if(String(url).includes('/instance/connect/'))return Response.json({code:'test-pairing-protocol-data',base64:'untrusted-image',pairingCode:'private-pairing-code'});
    body=JSON.parse(options!.body as string);return Response.json({key:{id:'private.test'}});
  }) as typeof fetch);
  const pairing=await sender.connect();assert.equal(pairing.state,'scan_required');assert(pairing.qr?.startsWith('data:image/png;base64,'));
  assert(!JSON.stringify(pairing).includes('private-pairing-code'));assert(!JSON.stringify(pairing).includes('untrusted-image'));
  await assert.rejects(async ()=>(await sender.send(job,grouped)),(err:any)=>err.outcome==='blocked');
  connected=true;assert.equal(await sender.send(job,grouped),'private.test');assert.equal(body.number,grouped.adminWhatsapp.slice(1));
  assert(body.text.includes(`#${result.data.id}`));assert(!urls.some(url=>url.includes('/chat/')||url.includes('/message/find')));
  assert.equal(new EvolutionClient({...env,EVOLUTION_API_URL:'http://remote.example'}).status().ready,false);
});
