import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import {gunzipSync,gzipSync} from 'node:zlib';
import type {RecoveryMail} from '../backend/src/application/ports/out/recovery-mailer';
import {BrevoRecoveryMailer} from '../backend/src/adapters/out/notifications/recovery-mailer';
import {testPostgres} from './postgres-helper.mts';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'futapp-recovery-'));
process.env.DB_PATH=path.join(directory,'fixture.db');process.env.NODE_ENV='test';process.env.PUBLIC_APP_URL='https://futapp-fixture.example';process.env.JWT_SECRET='isolated-recovery-fixture-secret-1234567890';
const {migrate}=await import('../backend/src/adapters/out/persistence/migrate');
const {migratePostgres}=await import('../backend/src/adapters/out/persistence/postgres-schema');
const {getDb,closeDb}=await import('../backend/src/adapters/out/persistence/database');
const {asAsyncDatabase}=await import('../backend/src/adapters/out/persistence/async-database');
const {createContainer}=await import('../backend/src/container');
const {createHttpServer}=await import('../backend/src/adapters/in/rest/http-server');
const {SqliteSecurityRepository}=await import('../backend/src/adapters/out/persistence/repositories/security.repository');
const {FileMigrationStore}=await import('../backend/src/adapters/out/persistence/migration-store');
const {PostgresMigrationStore}=await import('../backend/src/adapters/out/persistence/postgres-migration-store');
const original='Recovery fixture password 123!',fresh='Nueva12!';
const token=(url:string)=>new URLSearchParams(new URL(url).hash.slice(1)).get('token')!;
const settle=()=>new Promise(resolve=>setTimeout(resolve,35));
after(()=>{closeDb();assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});});

for(const dialect of ['sqlite','postgres'] as const)test(`${dialect}: recovery links protect ownership, expiry, single use, sessions and migrations`,async t=>{
  migrate();const pg=dialect==='postgres'?await testPostgres():null;if(pg)await migratePostgres(pg);const db=pg??asAsyncDatabase(getDb());
  const mails:RecoveryMail[]=[];let ready=true,fail=false;
  const mailer={status:()=>({ready,missing:ready?[]:['BREVO_API_KEY']}),send:async(message:RecoveryMail)=>{if(fail)throw new Error('Private provider error');mails.push(message);}};
  const c=createContainer({db,recoveryMailer:mailer} as any),security=new SqliteSecurityRepository(db);
  const adminId=Number((await db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run(`admin-${dialect}@test.local`,bcrypt.hashSync(original,4),'Admin fixture')).lastInsertRowid);
  const player=await c.playerService.create({email:`player-${dialect}@test.local`,password:original,fullName:'Jugador fixture',position:'POR'});
  const other=await c.playerService.create({email:`other-${dialect}@test.local`,password:original,fullName:'Otro fixture',position:'DEF'});
  const admin=(await c.authService.login({email:`admin-${dialect}@test.local`,password:original})).token,session=(await c.authService.login({email:player.user.email,password:original})).token;
  const server=createHttpServer({notifications:c.notificationService,qrPayments:c.qrPaymentService,tournaments:c.tournamentService,media:c.mediaService,auth:c.authService,me:c.meService,players:c.playerService,inscriptions:c.inscriptionService,uniforms:c.uniformService,matches:c.matchService,sanctions:c.sanctionService,stats:c.statsService,ai:c.aiService,dashboard:c.dashboardService,settings:c.settingsService}).listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
  const request=async(url:string,body?:unknown,auth?:string,extra:Record<string,string>={})=>{const response=await fetch(base+'/api/auth'+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json() as any,response};};
  let emailToken='';
  const manual=(userId=player.user.id)=>c.authService.administratorReset(adminId,userId,original);
  try{
    await t.test('public requests do not disclose accounts, tokens or provider latency; links use trusted URL fragments',async()=>{
      const known=await request('/forgot-password',{email:player.user.email.toUpperCase()}),unknown=await request('/forgot-password',{email:'unknown@test.local'});assert.equal(known.status,202);assert.deepEqual(unknown.data,known.data);await settle();assert.equal(mails.length,1);assert.equal(mails[0].email,player.user.email);
      emailToken=token(mails[0].url!);assert.equal(emailToken.length,43);assert.equal(new URL(mails[0].url!).origin,'https://futapp-fixture.example');assert.equal(new URL(mails[0].url!).search,'');assert.equal(new URL(mails[0].url!).pathname,'/restablecer-contrasena');
      const rows=await db.prepare('SELECT * FROM password_reset_tokens').all();assert.equal(rows[0].token_hash.length,64);assert(!JSON.stringify(rows).includes(emailToken));assert(!JSON.stringify(known.data).includes(emailToken));assert.equal((await c.authService.login({email:player.user.email,password:original})).user.id,player.user.id);
      const repeat=await request('/forgot-password',{email:player.user.email});assert.deepEqual(repeat.data,known.data);await settle();assert.equal(mails.length,1);
    });
    await t.test('administrator recovery requires reauthentication, an active player and the admin role',async()=>{
      assert.equal((await request('/admin-reset',{userId:player.user.id,password:original},session)).status,403);assert.equal((await request('/admin-reset',{userId:player.user.id,password:original})).status,401);
      assert.equal((await request('/admin-reset',{userId:player.user.id,password:'incorrect'},admin)).status,400);assert.equal((await request('/admin-reset',{userId:adminId,password:original},admin)).status,400);
      const link=await request('/admin-reset',{userId:player.user.id,password:original},admin);assert.equal(link.status,200);assert.equal(new URL(link.data.url).origin,'https://futapp-fixture.example');assert((Date.parse(link.data.expiresAt)-Date.now())<=900000);
      assert.equal((await request('/reset-password',{token:emailToken,password:fresh,confirmation:fresh})).status,400);
    });
    await t.test('expired, altered, reused and mismatched links fail without changing the account',async()=>{
      const grant=await manual();await db.prepare('UPDATE password_reset_tokens SET expires_at=? WHERE user_id=?').run(Date.now()-1,player.user.id);
      assert.equal((await request('/reset-password',{token:token(grant.url),password:fresh,confirmation:fresh})).data.error.code,'RESET_INVALID');
      const active=await manual(),value=token(active.url);
      for(const password of ['sinMayuscula12!'.toLowerCase(),'SINMINUSCULA12!','SinNumeros!!','SinSimbolos12'])assert.equal((await request('/reset-password',{token:value,password,confirmation:password})).status,400);
      assert.equal((await request('/reset-password',{token:value,password:'short',confirmation:'short'})).status,400);assert.equal((await request('/reset-password',{token:value,password:fresh,confirmation:'mismatch'})).status,400);
      assert.equal((await request('/reset-password',{token:value,password:original,confirmation:original})).status,400);assert.equal((await request('/reset-password',{token:'x'.repeat(43),password:fresh,confirmation:fresh})).status,400);
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM password_reset_tokens WHERE user_id=?').get(player.user.id)).n,1);
    });
    await t.test('successful recovery revokes sessions, sends a change notice and never logs the user in automatically',async()=>{
      const link=await manual(),value=token(link.url),old=await c.authService.login({email:player.user.email,password:original});
      const reset=await request('/reset-password',{token:value,password:fresh,confirmation:fresh},undefined,{Cookie:'futapp_session=invalid-old-cookie',Origin:base});assert.equal(reset.status,200);assert.deepEqual(reset.data,{ok:true});assert.equal(reset.response.headers.get('set-cookie'),null);
      await assert.rejects(c.authService.verifySession(old.token));await assert.rejects(c.authService.login({email:player.user.email,password:original}));assert.equal((await c.authService.login({email:player.user.email,password:fresh})).user.id,player.user.id);
      assert.equal((await request('/reset-password',{token:value,password:fresh,confirmation:fresh})).status,400);await settle();assert(mails.some(mail=>mail.kind==='changed'&&mail.email===player.user.email));
      assert.equal((await c.authService.verifySession(admin)).user.role,'admin');assert.equal((await c.authService.login({email:other.user.email,password:original})).user.id,other.user.id);
    });
    await t.test('a concurrent replay can update the password exactly once',async()=>{
      const link=await manual(),value=token(link.url),a='Concurrent winning password Alpha 123!',b='Concurrent winning password Beta 456!';
      const responses=await Promise.all([request('/reset-password',{token:value,password:a,confirmation:a}),request('/reset-password',{token:value,password:b,confirmation:b})]);assert.deepEqual(responses.map(row=>row.status).sort(),[200,400]);
      const winning=responses[0].status===200?a:b;assert.equal((await c.authService.login({email:player.user.email,password:winning})).user.id,player.user.id);
    });
    await t.test('inactive, pending and changed accounts cannot be reactivated using a reset link',async()=>{
      const link=await manual();await db.prepare('UPDATE users SET active=0 WHERE id=?').run(player.user.id);
      assert.equal((await request('/reset-password',{token:token(link.url),password:fresh,confirmation:fresh})).status,400);await assert.rejects(manual(),/activos/);assert.equal((await db.prepare('SELECT active FROM users WHERE id=?').get(player.user.id)).active,0);
      await db.prepare('UPDATE users SET active=1 WHERE id=?').run(player.user.id);
      const changed=await manual(other.user.id);await c.meService.changePassword(other.user.id,original,fresh);assert.equal((await request('/reset-password',{token:token(changed.url),password:original,confirmation:original})).status,400);
      const role=await manual();await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(player.user.id);assert.equal((await request('/reset-password',{token:token(role.url),password:fresh,confirmation:fresh})).status,400);await db.prepare("UPDATE users SET role='player' WHERE id=?").run(player.user.id);
    });
    await t.test('recovery throttles are durable, atomic and bounded per account',async()=>{
      const now=Date.now(),key='atomic-fixture-'+dialect;const claims=await Promise.all(Array.from({length:6},()=>security.claimPasswordReset(key,now)));assert.equal(claims.filter(Boolean).length,1);
      for(let index=1;index<5;index++)assert.equal(await security.claimPasswordReset(key,now+index*61000),true);
      assert.equal(await security.claimPasswordReset(key,now+6*61000),false);assert.equal(await security.claimPasswordReset(key,now+3600001),true);
    });
    await t.test('delivery failure is tracked privately, and missing configuration offers a consistent assisted fallback',async()=>{
      fail=true;await c.authService.forgotPassword('failure-'+dialect+'@test.local');await db.prepare('DELETE FROM password_reset_requests').run();await c.authService.forgotPassword(other.user.email);await settle();assert.equal((await db.prepare('SELECT delivery_state FROM password_reset_tokens WHERE user_id=?').get(other.user.id)).delivery_state,'failed');fail=false;
      ready=false;assert.equal((await request('/recovery-status')).data.ready,false);assert.equal((await request('/forgot-password',{email:other.user.email})).status,503);assert.equal((await request('/forgot-password',{email:'unknown@test.local'})).status,503);assert.equal((await request('/recovery-settings',undefined,admin)).data.missing[0],'BREVO_API_KEY');await manual();ready=true;
    });
    await t.test('backups omit reset secrets and old snapshots without recovery tables remain valid',async()=>{
      const objects={put:async()=>{},get:async()=>Buffer.alloc(0),remove:async()=>{}};const store=pg?new PostgresMigrationStore(pg,objects):new FileMigrationStore(getDb(),directory);
      const packet=JSON.parse(gunzipSync(await store.exportData()).toString());assert.deepEqual(packet.tables.password_reset_tokens.rows,[]);assert.deepEqual(packet.tables.password_reset_requests.rows,[]);
      delete packet.tables.password_reset_tokens;delete packet.tables.password_reset_requests;const freshDb=new Database(':memory:');migrate(freshDb);try{const valid=new FileMigrationStore(freshDb,directory).validateForImport(gzipSync(JSON.stringify(packet)));assert.deepEqual(valid.tables.password_reset_tokens.rows,[]);}finally{freshDb.close();}
    });
    await t.test('short passwords work for player creation, registration and change; existing credentials stay valid',async()=>{
      const legacy='legacypassphrase';
      const legacyId=Number((await db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'player')").run(`legacy-${dialect}@test.local`,bcrypt.hashSync(legacy,4),'Cuenta anterior')).lastInsertRowid);
      const legacySession=await c.authService.login({email:`legacy-${dialect}@test.local`,password:legacy});assert.equal(legacySession.user.id,legacyId);
      const created=await c.playerService.create({email:`short-${dialect}@test.local`,password:fresh,fullName:'Contraseña corta',position:'MED'});
      await assert.rejects(c.playerService.create({email:`bad-${dialect}@test.local`,password:'sinmayuscula12!',fullName:'Inválido',position:'MED'}));
      const invited=await c.authService.createInvitation();
      await assert.rejects(c.authService.register({email:`bad-register-${dialect}@test.local`,password:'SINMINUSCULA12!',fullName:'Inválido',invitationCode:invited.code}));
      const registered=await c.authService.register({email:`short-register-${dialect}@test.local`,password:fresh,fullName:'Registro corto',invitationCode:invited.code});assert.equal(registered.pendingApproval,true);
      const session=await c.authService.login({email:created.user.email,password:fresh});
      await assert.rejects(c.meService.changePassword(created.user.id,fresh,'SinSimbolos12'));assert.equal((await c.authService.verifySession(session.token)).user.id,created.user.id);
      await c.meService.changePassword(created.user.id,fresh,'Otra123!');await assert.rejects(c.authService.verifySession(session.token));
      assert.equal((await c.authService.login({email:created.user.email,password:'Otra123!'})).user.id,created.user.id);
      assert.equal((await c.authService.verifySession(legacySession.token)).user.id,legacyId);
    });
    await t.test('public recovery rate limits also count successful generic replies',async()=>{
      let limited:any;for(let index=0;index<12;index++){const reply=await request('/forgot-password',{email:`limit${index}@test.local`});if(reply.status===429){limited=reply;break;}}assert(limited);assert(limited.response.headers.get('retry-after'));
    });
  }finally{await settle();await new Promise<void>(resolve=>server.close(()=>resolve()));if(pg){await pg.execute('DROP SCHEMA futapp CASCADE');await pg.close();}}
});
test('Brevo uses HTTPS with private server credentials and never sends a password',async()=>{
  let seen:any;const mailer=new BrevoRecoveryMailer({BREVO_API_KEY:'fixture-private-key',MAIL_FROM:'sender@test.local'},async(url,init)=>{seen={url,init,body:JSON.parse(init!.body as string)};return Response.json({messageId:'fixture'});});
  await mailer.send({email:'player@test.local',name:'Jugador',kind:'reset',url:'https://futapp.example/restablecer-contrasena#token=fixture'});assert.equal(seen.url,'https://api.brevo.com/v3/smtp/email');assert.equal(seen.init.headers['api-key'],'fixture-private-key');assert(seen.body.textContent.includes('15 minutos'));assert.equal(seen.body.to.length,1);
  assert.equal(new BrevoRecoveryMailer({}).status().ready,false);const rejected=new BrevoRecoveryMailer({BREVO_API_KEY:'key',MAIL_FROM:'sender@test.local'},async()=>new Response('Private secret body',{status:403}));await assert.rejects(rejected.send({email:'test@test.local',name:'Test',kind:'changed'}),error=>!String(error).includes('Private secret body'));
});
