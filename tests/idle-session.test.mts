import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {gzipSync,gunzipSync} from 'node:zlib';
import {testPostgres} from './postgres-helper.mts';
import {startIdleSession,type IdleEnvironment,type IdleMessage} from '../frontend/src/services/idle-session';
import type {SessionStatus} from '../frontend/src/types/api';

function clock(){
  let now=1000000,next=0,visible=true,latest:IdleMessage|null=null;
  let activity=()=>{},wake=()=>{},peer=(_message:IdleMessage)=>{};
  const timers=new Map<number,{at:number;callback:()=>void}>(),messages:IdleMessage[]=[];
  const environment:IdleEnvironment={now:()=>now,visible:()=>visible,timer:(callback,delay)=>{const id=++next;timers.set(id,{at:now+delay,callback});return id;},cancel:id=>{timers.delete(id);},activity:callback=>{activity=callback;return ()=>{activity=()=>{};};},wake:callback=>{wake=callback;return ()=>{wake=()=>{};};},peer:callback=>{peer=callback;return ()=>{peer=()=>{};};},latestPeer:()=>latest,publish:message=>{latest=message;messages.push(message);}};
  return {environment,messages,timers,input:()=>activity(),wake:()=>wake(),peer:(message:IdleMessage)=>{latest=message;peer(message);},store:(message:IdleMessage)=>{latest=message;},hidden:(value:boolean)=>{visible=!value;},jump:(ms:number)=>{now+=ms;},advance:async(ms:number)=>{const end=now+ms;for(;;){const first=[...timers].filter(([,item])=>item.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!first)break;now=first[1].at;timers.delete(first[0]);first[1].callback();await Promise.resolve();await Promise.resolve();}now=end;await Promise.resolve();}};
}
const policy=(c:ReturnType<typeof clock>,remaining=900000):SessionStatus=>({sessionKey:'test-session',serverNow:50,idleTimeoutMs:900000,idleExpiresAt:50+remaining});

test('idle browser: no activity closes locally on time, even when logout cannot reach the server',async()=>{
  const c=clock(),closed:string[]=[];let heartbeats=0;
  startIdleSession(policy(c),c.environment,async()=>{heartbeats++;throw new Error('Offline');},reason=>closed.push(reason));
  await c.advance(899999);assert.equal(closed.length,0);await c.advance(1);
  assert.deepEqual(closed,['idle']);assert.equal(heartbeats,0);assert.equal(c.timers.size,0);assert.equal(c.messages.at(-1)?.kind,'logout');
  c.input();c.wake();assert.equal(closed.length,1);
});
test('idle browser: real input extends the timer; heartbeat is bounded and passive wake does not keep it alive',async()=>{
  const c=clock(),closed:string[]=[];let heartbeats=0;
  startIdleSession(policy(c),c.environment,async()=>{heartbeats++;},reason=>closed.push(reason));
  await c.advance(60000);c.input();for(let i=0;i<100;i++)c.input();await c.advance(0);assert.equal(heartbeats,1);
  await c.advance(800000);c.wake();assert.equal(heartbeats,1);assert.equal(closed.length,0);
  await c.advance(100000);assert.deepEqual(closed,['idle']);
});
test('idle browser: suspended devices expire before new input and refresh uses the server remaining time',async()=>{
  const c=clock(),closed:string[]=[];startIdleSession(policy(c,30000),c.environment,async()=>{},reason=>closed.push(reason));
  c.hidden(true);c.jump(30001);c.hidden(false);c.input();assert.deepEqual(closed,['idle']);
  assert.equal(c.messages.filter(message=>message.kind==='activity').length,0);
});
test('idle browser: another active tab keeps a suspended tab valid; unrelated sessions and future timestamps do not',async()=>{
  const c=clock(),closed:string[]=[];startIdleSession(policy(c),c.environment,async()=>{},reason=>closed.push(reason));
  c.hidden(true);c.jump(1200000);
  c.store({key:'test-session',kind:'activity',at:c.environment.now()-1000});c.hidden(false);c.wake();assert.equal(closed.length,0);
  c.peer({key:'another-session',kind:'logout',at:c.environment.now()});assert.equal(closed.length,0);
  c.peer({key:'test-session',kind:'activity',at:c.environment.now()+9000000});
  await c.advance(899000);assert.deepEqual(closed,['idle']);
});
test('idle browser: logout propagates only to the same session and administrators have no idle timer',()=>{
  const c=clock(),closed:string[]=[];startIdleSession(policy(c),c.environment,async()=>{},reason=>closed.push(reason));
  c.peer({key:'test-session',kind:'logout',at:c.environment.now(),reason:'manual'});assert.deepEqual(closed,['remote']);assert.equal(c.timers.size,0);
  const admin=clock();startIdleSession({...policy(admin),idleTimeoutMs:null,idleExpiresAt:null},admin.environment,async()=>{throw new Error('No admin heartbeat');},()=>{throw new Error('No admin idle logout');});
  admin.jump(50000000);admin.input();admin.wake();assert.equal(admin.timers.size,0);assert.equal(admin.messages.length,0);
});
test('idle browser: heartbeat failures do not extend the local deadline and cleanup cancels listeners',async()=>{
  const c=clock(),closed:string[]=[];let heartbeats=0;
  const stop=startIdleSession(policy(c),c.environment,async()=>{heartbeats++;throw new Error('Offline');},reason=>closed.push(reason));
  c.input();await c.advance(900000);assert.deepEqual(closed,['idle']);assert(heartbeats<16);
  stop();c.input();c.wake();assert.equal(c.timers.size,0);
});

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'futapp-idle-'));
process.env.DB_PATH=path.join(directory,'portal.db');process.env.NODE_ENV='test';
process.env.JWT_SECRET='isolated-idle-session-secret-12345678901234567890';
process.env.PLAYER_IDLE_MINUTES='15';
const {migrate}=await import('../backend/src/adapters/out/persistence/migrate');
const {migratePostgres}=await import('../backend/src/adapters/out/persistence/postgres-schema');
const {getDb,closeDb}=await import('../backend/src/adapters/out/persistence/database');
const {asAsyncDatabase}=await import('../backend/src/adapters/out/persistence/async-database');
const {createContainer}=await import('../backend/src/container');
const {createHttpServer}=await import('../backend/src/adapters/in/rest/http-server');
const {FileMigrationStore}=await import('../backend/src/adapters/out/persistence/migration-store');
const {PostgresMigrationStore}=await import('../backend/src/adapters/out/persistence/postgres-migration-store');
const password='Idle session test passphrase 123!',idle=900000;
after(()=>{closeDb();assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});});

for(const dialect of ['sqlite','postgres'] as const)test(`${dialect}: server enforces player inactivity without expiring administrators or restoring dead sessions`,async t=>{
  migrate();const pg=dialect==='postgres'?await testPostgres():null;if(pg)await migratePostgres(pg);
  const db=pg??asAsyncDatabase(getDb()),c=createContainer({db});
  await db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run(`admin-${dialect}@test.local`,bcrypt.hashSync(password,4),'Admin');
  const player=await c.playerService.create({email:`player-${dialect}@test.local`,password,fullName:'Jugador',position:'MED'});
  const login=()=>c.authService.login({email:player.user.email,password});
  const admin=await c.authService.login({email:`admin-${dialect}@test.local`,password});
  const app=createHttpServer({notifications:c.notificationService,qrPayments:c.qrPaymentService,tournaments:c.tournamentService,media:c.mediaService,auth:c.authService,me:c.meService,players:c.playerService,inscriptions:c.inscriptionService,uniforms:c.uniformService,matches:c.matchService,sanctions:c.sanctionService,stats:c.statsService,ai:c.aiService,dashboard:c.dashboardService,settings:c.settingsService});
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
  const request=async(method:string,url:string,token:string,body?:unknown,cookie=false)=>{const response=await fetch(origin+'/api'+url,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:'futapp_session='+token,Origin:origin}:{Authorization:'Bearer '+token})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {response,status:response.status,data:await response.json() as any};};
  const id=(token:string)=>(jwt.decode(token) as jwt.JwtPayload).jti!;
  const age=async(token:string,ms:number)=>db.prepare('UPDATE auth_sessions SET last_activity_at=? WHERE id=?').run(Date.now()-ms,id(token));
  try {
    await t.test('legacy migration initializes activity once and preserves existing administrator and player sessions',async()=>{
      const payload=await login();
      if(pg)await pg.execute('ALTER TABLE auth_sessions DROP COLUMN last_activity_at');else getDb().exec('ALTER TABLE auth_sessions DROP COLUMN last_activity_at');
      if(pg)await migratePostgres(pg);else migrate();
      assert.equal((await c.authService.verifySession(payload.token)).session!.idleTimeoutMs,idle);
      assert.equal((await c.authService.verifySession(admin.token)).session!.idleTimeoutMs,null);
      await age(payload.token,120000);const before=(await db.prepare('SELECT last_activity_at FROM auth_sessions WHERE id=?').get(id(payload.token))).last_activity_at;
      if(pg)await migratePostgres(pg);else migrate();
      assert.equal((await db.prepare('SELECT last_activity_at FROM auth_sessions WHERE id=?').get(id(payload.token))).last_activity_at,before);
    });
    await t.test('reads and background polling never renew inactivity; player expiration revokes just that token',async()=>{
      const payload=await login(),other=await login();await age(payload.token,idle-60000);
      const before=(await db.prepare('SELECT last_activity_at FROM auth_sessions WHERE id=?').get(id(payload.token))).last_activity_at;
      for(const url of ['/auth/me','/me','/me/uniforms'])assert.equal((await request('GET',url,payload.token)).status,200);
      assert.equal((await db.prepare('SELECT last_activity_at FROM auth_sessions WHERE id=?').get(id(payload.token))).last_activity_at,before);
      await age(payload.token,idle+1000);const expired=await request('GET','/auth/me',payload.token,undefined,true);
      assert.equal(expired.status,401);assert.equal(expired.data.error.code,'SESSION_IDLE_EXPIRED');assert(expired.response.headers.get('set-cookie')?.includes('Expires='));
      assert.equal(await db.prepare('SELECT id FROM auth_sessions WHERE id=?').get(id(payload.token)),undefined);
      assert.equal((await request('POST','/auth/activity',payload.token,{})).status,401);
      assert.equal((await request('GET','/auth/me',other.token)).status,200);
    });
    await t.test('explicit activity renews a live session and rejects client-supplied timestamps',async()=>{
      const payload=await login();await age(payload.token,idle-10000);
      assert.equal((await request('POST','/auth/activity',payload.token,{lastActivityAt:Date.now()+999999999})).status,400);
      const renewed=await request('POST','/auth/activity',payload.token,{});assert.equal(renewed.status,200);assert.equal(renewed.data.idleTimeoutMs,idle);assert(renewed.data.idleExpiresAt-Date.now()>idle-1000);
      await age(payload.token,idle+1);assert.equal((await request('POST','/auth/activity',payload.token,{})).status,401);
      await assert.rejects(()=>c.authService.verifySession(payload.token));
    });
    await t.test('administrators are exempt from inactivity while general expiration and revocation still apply',async()=>{
      await age(admin.token,5*3600000);const view=await request('GET','/auth/me',admin.token);assert.equal(view.status,200);assert.equal(view.data.session.idleTimeoutMs,null);assert.equal(view.data.session.idleExpiresAt,null);
      assert.equal((await request('POST','/auth/activity',admin.token,{})).status,200);
      const temporary=await c.authService.login({email:`admin-${dialect}@test.local`,password});await db.prepare('UPDATE auth_sessions SET expires_at=? WHERE id=?').run(Date.now()-1,id(temporary.token));
      assert.equal((await request('GET','/auth/me',temporary.token)).status,401);
    });
    await t.test('late logout from an old tab cannot clear the cookie or revoke a newer session',async()=>{
      const old=await login(),current=await login();
      const late=await request('POST','/auth/logout',current.token,{sessionKey:old.session!.sessionKey},true);
      assert.equal(late.status,200);assert.equal(late.response.headers.get('set-cookie'),null);assert.equal((await request('GET','/auth/me',current.token)).status,200);
      await age(old.token,idle+1000);assert.equal((await request('POST','/auth/logout',old.token,{sessionKey:old.session!.sessionKey},true)).status,200);
      assert.equal((await request('GET','/auth/me',old.token)).status,401);assert.equal((await request('GET','/auth/me',current.token)).status,200);
    });
    await t.test('backups exported before the activity column validate without restoring their sessions',async()=>{
      const objects={put:async()=>{},get:async()=>Buffer.alloc(0),remove:async()=>{}};
      const store=pg?new PostgresMigrationStore(pg,objects):new FileMigrationStore(getDb(),directory);
      const packet=JSON.parse(gunzipSync(await store.exportData()).toString());
      const column=packet.tables.auth_sessions.columns.indexOf('last_activity_at');assert(column>=0);assert.equal(packet.tables.auth_sessions.rows.length,0);packet.tables.auth_sessions.columns.splice(column,1);
      const validator=new (await import('better-sqlite3')).default(':memory:');
      try {migrate(validator);const valid=new FileMigrationStore(validator,directory).validateForImport(gzipSync(JSON.stringify(packet)));assert(valid.tables.auth_sessions.columns.includes('last_activity_at'));assert.deepEqual(valid.tables.auth_sessions.rows,[]);}finally{validator.close();}
    });
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));if(pg){await pg.execute('DROP SCHEMA futapp CASCADE');await pg.close();}}
});
