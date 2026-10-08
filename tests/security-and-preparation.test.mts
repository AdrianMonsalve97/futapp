import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'futapp-security-'));
process.env.DB_PATH=path.join(directory,'portal.db');process.env.JWT_SECRET='isolated-security-tests-12345678901234567890';process.env.NODE_ENV='test';
const {migrate}=await import('../backend/src/adapters/out/persistence/migrate');
const {getDb,closeDb}=await import('../backend/src/adapters/out/persistence/database');
const {createContainer}=await import('../backend/src/container');
const {createHttpServer}=await import('../backend/src/adapters/in/rest/http-server');
const {getFormation}=await import('../backend/src/domain/formations');
const {broadcastUrl}=await import('../backend/src/domain/broadcast');
const {buildStrengthsWeaknesses}=await import('../backend/src/domain/model/performance-model');
const {prepareTeam}=await import('../scripts/prepare-team.mjs');
migrate();const db=getDb(),c=createContainer();
const password='Security Test Passphrase 123!';
db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run('admin@security.test',bcrypt.hashSync(password,4),'Admin seguridad');
const admin=c.authService.login({email:'admin@security.test',password}).token;
const players=['POR','DEF','DEF','DEF','MED','MED','MED','DEL'].map((position,i)=>c.playerService.create({email:`player${i}@security.test`,password,fullName:`Jugador real ${i}`,position:position as any}));
const keeper=c.authService.login({email:players[0].user.email,password}).token;
const app=createHttpServer({notifications:c.notificationService,qrPayments:c.qrPaymentService,tournaments:c.tournamentService,media:c.mediaService,auth:c.authService,me:c.meService,players:c.playerService,inscriptions:c.inscriptionService,uniforms:c.uniformService,matches:c.matchService,sanctions:c.sanctionService,stats:c.statsService,ai:c.aiService,dashboard:c.dashboardService,settings:c.settingsService});
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`,base=origin+'/api';
async function request(method:string,url:string,body?:unknown,token=admin,headers:Record<string,string>={}){const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {res,status:res.status,data:await res.json()};}
after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));closeDb();assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});});

test('browser login uses HttpOnly cookies without disclosing JWT and rejects forged origins',async()=>{
  const login=await request('POST','/auth/login',{email:'admin@security.test',password},'',{'X-FutApp-Client':'web',Origin:origin});
  assert.equal(login.status,200);assert.equal(login.data.token,undefined);
  const cookie=login.res.headers.get('set-cookie')!;assert(cookie.includes('HttpOnly'));assert(cookie.includes('SameSite=Strict'));assert(!cookie.includes('Domain='));
  const header={Cookie:cookie.split(';')[0]};assert.equal((await request('GET','/auth/me',undefined,'',header)).status,200);
  assert.equal((await request('POST','/auth/invitation',{},'',{...header,Origin:'https://attacker.example'})).status,403);
  assert.equal((await request('POST','/auth/invitation',{},'',header)).status,403);
  assert.equal((await request('POST','/auth/invitation',{},'',{...header,Origin:origin})).status,200);
  const secure=await request('POST','/auth/login',{email:'admin@security.test',password},'',{'X-FutApp-Client':'web',Origin:origin.replace('http:','https:')});assert(secure.res.headers.get('set-cookie')!.includes('Secure'));
  const logout=await request('POST','/auth/logout',{},'',{...header,Origin:origin});assert.equal(logout.status,200);
  assert.equal((await request('GET','/auth/me',undefined,'',header)).status,401);
});

test('logout and password changes invalidate replayed credentials and unrelated sessions survive',async()=>{
  const first=c.authService.login({email:players[1].user.email,password}).token;
  const second=c.authService.login({email:players[1].user.email,password}).token;
  c.authService.logout(first);assert.equal((await request('GET','/auth/me',undefined,first)).status,401);
  assert.equal((await request('GET','/auth/me',undefined,second)).status,200);
  const change=await request('PUT','/me/password',{currentPassword:password,newPassword:'Updated secure passphrase 456!'},second);assert.equal(change.status,200);
  assert.equal((await request('GET','/auth/me',undefined,second)).status,401);
  assert.equal((await request('GET','/auth/me',undefined,keeper)).status,200);
  const inactive=c.authService.login({email:players[2].user.email,password}).token;
  c.playerService.update(players[2].player.id,{active:false});c.playerService.update(players[2].player.id,{active:true});
  assert.equal((await request('GET','/auth/me',undefined,inactive)).status,401);
});

test('registration requires a live invitation, rejects role injection and enforces password length without bcrypt truncation',async()=>{
  const body={email:'invite@security.test',fullName:'Invitado',password,position:'POR'};
  assert.equal((await request('POST','/auth/register',body,'')).status,400);
  assert.equal((await request('POST','/auth/invitation',{},keeper)).status,403);
  const first=c.authService.createInvitation(),second=c.authService.createInvitation();
  assert.equal((await request('POST','/auth/register',{...body,invitationCode:first.code},'')).status,400);
  assert.equal((await request('POST','/auth/register',{...body,invitationCode:second.code,password:'short'},'')).status,400);
  assert.equal((await request('POST','/auth/register',{...body,invitationCode:second.code,password:'é'.repeat(40)},'')).status,400);
  assert.equal((await request('POST','/auth/register',{...body,invitationCode:second.code,role:'admin'},'')).status,400);
  const joined=await request('POST','/auth/register',{...body,invitationCode:second.code},'');assert.equal(joined.status,200);assert.equal(joined.data.user.role,'player');
  assert.equal(joined.data.user.passwordHash,undefined);assert.equal((await request('GET','/players',undefined,joined.data.token)).status,403);
  const stored=db.prepare('SELECT digest FROM registration_invitation').get() as {digest:string};assert.notEqual(stored.digest,second.code);
  db.prepare('UPDATE registration_invitation SET expires_at=0').run();assert.equal((await request('POST','/auth/register',{...body,email:'expired@security.test',invitationCode:second.code},'')).status,400);
});

test('goalkeeper preparation uses the selected published lineup, protects drafts and follows actual F8 rules',async()=>{
  const rules={format:8,periods:2,minutesPerPeriod:25,breakMinutes:null,maxSquad:null,maxSubstitutions:null,rollingSubstitutions:null,allowedFormations:['1-3-3-1','1-2-3-2'],tacticalStyle:'ofensivo'};
  const tournament=c.tournamentService.save(null,{name:'Liga actual',leagueName:'Liga pruebas',season:'2099',status:'publicado',rules,notes:''} as any);
  c.tournamentService.addPlayers(tournament.id,players.map(row=>row.player.id));
  const stale=c.matchService.create({opponent:'Fixture antiguo',competition:'Demo',kickOff:'2020-01-01T18:00',isHome:true});
  const game=c.matchService.create({opponent:'Rival actual',competition:'Liga',kickOff:'2099-01-01T18:00',isHome:true,tournamentId:tournament.id});
  const draft=getFormation('1-3-3-1',8).slots.map((s,i)=>({...s,playerId:players[i].player.id}));c.matchService.setLineup(game.id,draft);
  const before=(await request('GET',`/me/ai?matchId=${game.id}`,undefined,keeper)).data;
  assert.equal(before.preparation.lineup.length,0);assert(!JSON.stringify(before.preparation).includes('Jugador real 1'));
  assert.equal(before.preparation.assignment,'sin_publicar');
  c.matchService.publishLineup(game.id);
  const live=(await request('GET','/me/ai',undefined,keeper)).data;
  assert.equal(live.preparation.matchId,game.id);assert.notEqual(live.preparation.matchId,stale.id);
  assert.equal(live.preparation.lineup.length,8);assert.equal(live.preparation.role,'POR');assert.equal(live.preparation.minutes,50);assert.equal(live.preparation.assignment,'titular');
  assert(live.preparation.individual.some((i:any)=>i.title==='Uno contra uno'));assert(live.preparation.team.some((s:string)=>s.includes('Cambios ilimitados')));
  assert(live.preparation.plays.some((p:any)=>p.id==='portero'));assert(live.preparation.metricNote.includes('atajadas'));
  const keeperMetrics=buildStrengthsWeaknesses([0,0,0,0.9,0,0,1,0,0,0],[1,1,0.5,0.5,6,4,0.8,1,1,0],Array(10).fill(0.2),{goalkeeper:true,comparison:'promedio de porteros con historial'});
  assert(!JSON.stringify(keeperMetrics).match(/Falta de gol|Desperdicia tiros|Poco regate|Baja intervención defensiva/));
  assert(keeperMetrics.strengths.some(s=>s.label==='Buen pie'&&s.detail.includes('promedio de porteros')));
  c.matchService.setFormation(game.id,'1-2-3-2');const after=(await request('GET',`/me/ai?matchId=${game.id}`,undefined,keeper)).data;
  assert.equal(after.preparation.formation,'1-3-3-1');assert.equal(after.preparation.lineup.length,8);
  assert.equal((await request('GET','/me/ai?matchId=not-a-number',undefined,keeper)).status,400);
});

test('broadcast settings accept canonical YouTube links only and are restricted to administrators',async()=>{
  const game=c.matchService.create({opponent:'Para transmitir',competition:'Liga',kickOff:'2099-02-01T18:00',isHome:true});
  const created=await request('POST','/matches',{opponent:'Live inicial',kickOff:'2099-02-02T18:00',streamUrl:'https://youtu.be/abcdefghijk'});
  assert.equal(created.status,200);assert.equal(created.data.streamUrl,'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal((await request('POST','/matches',{opponent:'Live inválido',kickOff:'2099-02-03T18:00',streamUrl:'https://evil.example/embed/abcdefghijk'})).status,400);
  assert.equal((await request('PUT',`/matches/${game.id}`,{streamUrl:'https://youtu.be/abcdefghijk'},keeper)).status,403);
  for(const url of ['javascript:alert(1)','https://evil.example/embed/abcdefghijk','http://youtube.com/watch?v=abcdefghijk','https://youtube.com.evil.example/watch?v=abcdefghijk','https://user:pass@youtube.com/watch?v=abcdefghijk'])assert.equal((await request('PUT',`/matches/${game.id}`,{streamUrl:url})).status,400);
  assert.equal((await request('PUT',`/matches/${game.id}`,{streamUrl:'https://youtu.be/abcdefghijk?utm_source=test'})).status,200);
  assert.equal((await request('GET',`/matches/${game.id}`,undefined,keeper)).data.match.streamUrl,'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(broadcastUrl('https://www.youtube.com/live/abcdefghijk'),'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal((await request('PUT',`/matches/${game.id}`,{streamUrl:null})).status,200);
  assert.equal((await request('GET',`/matches/${game.id}`,undefined,keeper)).data.match.streamUrl,null);
});

test('team cleanup backs up all data, preserves club settings and removes demo credentials and learned history',async()=>{
  const config=db.prepare('SELECT * FROM team_settings').get();
  const tournamentCount=(db.prepare('SELECT COUNT(*) n FROM tournaments').get() as any).n;
  db.prepare("INSERT INTO uniforms(name,kind,stock,image_url) VALUES('Referencia equipo','camiseta',20,NULL)").run();
  const credentialsPath=path.join(directory,'private','admin.txt');
  const result=await prepareTeam({dbPath:process.env.DB_PATH!,email:'new-admin@security.test',name:'Admin inicial',credentialsPath,apply:true});
  assert(fs.existsSync(path.join(result.backup,'portal.db')));
  assert.equal((db.prepare('SELECT COUNT(*) n FROM users').get() as any).n,1);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM players').get() as any).n,0);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM matches').get() as any).n,0);
  assert.equal((db.prepare('SELECT COUNT(*) n FROM tournaments').get() as any).n,tournamentCount);
  assert.deepEqual(db.prepare('SELECT * FROM team_settings').get(),config);
  assert.equal((db.prepare('SELECT stock FROM uniforms').get() as any).stock,0);
  assert.equal((await request('GET','/auth/me',undefined,admin)).status,401);
  const content=fs.readFileSync(credentialsPath,'utf8'),initial=content.match(/Contraseña: (.+)/)![1];
  assert(initial.length>=15);assert.equal(c.authService.login({email:'new-admin@security.test',password:initial}).user.role,'admin');
  assert(!fs.existsSync(path.join(directory,'model.json')));
});
