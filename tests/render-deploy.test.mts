import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderClient } from '../scripts/render-deploy.mjs';
const commit='a'.repeat(40),url='https://futapp-test.onrender.com';
function fixture({free=true,mismatched=false,configured=true,mail={}}:{free?:boolean;mismatched?:boolean;configured?:boolean;mail?:Record<string,string>}={}){
  const env=new Map([['JWT_SECRET','existing-very-long-jwt-secret-that-must-persist'],['SMTP_PASSWORD','keep-provider-secret'],['DB_PATH','/var/data/portal.db']]);
  const writes:{route:string;body:any}[]=[];let trigger='commit';
  const request=async(input:string,options:any={})=>{
    const parsed=new URL(input),route=parsed.pathname.replace('/v1/services/srv-example','');
    if(parsed.origin==='https://api.render.com')assert.equal(options.headers.Authorization,'Bearer api-key-test');
    if(parsed.origin===url)return new Response('{"status":"ok"}',{status:200});
    if(options.method==='PUT'){const body=JSON.parse(options.body);writes.push({route,body});env.set(route.split('/').at(-1)!,body.value);return Response.json({});}
    if(options.method==='PATCH'){trigger=JSON.parse(options.body).autoDeployTrigger;return Response.json({});}
    if(options.method==='DELETE'){writes.push({route,body:null});env.delete(route.split('/').at(-1)!);return new Response(null,{status:204});}
    if(options.method==='POST'){const body=JSON.parse(options.body);writes.push({route,body});return Response.json({id:'dep-example'});}
    if(route.startsWith('/env-vars'))return Response.json([...env].map(([key,value])=>({envVar:{key,value},cursor:key})));
    if(route==='/deploys/dep-example')return Response.json({id:'dep-example',status:'live',commit:{id:mismatched?'b'.repeat(40):commit}});
    return Response.json({type:'web_service',repo:'https://github.com/AdrianMonsalve97/futapp.git',branch:'main',rootDir:'',autoDeployTrigger:trigger,serviceDetails:{runtime:'node',numInstances:1,plan:free?'free':'0.5c-512mb',...(free?{}:{disk:{mountPath:'/var/data'}}),url}});
  };
  return {env,writes,client:createRenderClient({apiKey:'api-key-test',serviceId:'srv-example',request,cloud:configured?{databaseUrl:'postgresql://postgres.test:fixture-password@aws-0-test.pooler.supabase.com:5432/postgres',supabaseUrl:'https://fixture-project.supabase.co',serverKey:'sb_secret_fixture_key',...mail}:{}})};
}
test('optional Brevo secrets are applied idempotently, preserve other credentials and reject partial setup',async()=>{
  const {client,env,writes}=fixture({mail:{brevoApiKey:'private-fixture-key',mailFrom:'verified@test.local',mailFromName:'Club fixture'}});await client.configure();assert.equal(env.get('BREVO_API_KEY'),'private-fixture-key');assert.equal(env.get('MAIL_FROM'),'verified@test.local');assert.equal(env.get('MAIL_FROM_NAME'),'Club fixture');assert.equal(env.get('SMTP_PASSWORD'),'keep-provider-secret');const count=writes.length;await client.configure();assert.equal(writes.length,count);
  const partial=fixture({mail:{brevoApiKey:'private-fixture-key'}});await assert.rejects(partial.client.configure(),/MAIL_FROM/);assert.equal(partial.writes.length,0);
});
test('environment task preserves existing secrets, generates missing credentials and is idempotent',async()=>{
  const {client,env,writes}=fixture();const before=env.get('JWT_SECRET');await client.configure();
  assert.equal(env.get('JWT_SECRET'),before);assert.equal(env.get('SMTP_PASSWORD'),'keep-provider-secret');
  assert(env.get('ADMIN_PASSWORD')!.length>=15);assert.equal(env.has('DB_PATH'),false);assert.equal(env.get('DB_DRIVER'),'postgres');assert.equal(env.get('PUBLIC_APP_URL'),url);assert.equal(env.get('SUPABASE_SECRET_KEY'),'sb_secret_fixture_key');
  const count=writes.length,password=env.get('ADMIN_PASSWORD');await client.configure();assert.equal(writes.length,count);assert.equal(env.get('ADMIN_PASSWORD'),password);
});
test('only the validated commit is published and the service must pass health',async()=>{
  const {client,writes}=fixture();await assert.rejects(client.deploy(commit));await client.configure();
  const result=await client.deploy(commit,{sleep:async()=>{}});assert.equal(result.commit,commit);
  assert.deepEqual(writes.find(row=>row.route==='/deploys')?.body,{commitId:commit,clearCache:'do_not_clear'});
  const mismatch=fixture({mismatched:true});await mismatch.client.configure();await assert.rejects(mismatch.client.deploy(commit,{sleep:async()=>{}}),/diferente/);
});
test('unsafe targets and missing configuration are rejected before writing',async()=>{
  assert.throws(()=>createRenderClient({apiKey:'',serviceId:'srv-example'}));assert.throws(()=>createRenderClient({apiKey:'x',serviceId:'../wrong'}));
  const {client,writes}=fixture({free:false});await assert.rejects(client.configure(),/Free/);assert.equal(writes.length,0);
  const missing=fixture({configured:false});await assert.rejects(missing.client.configure(),/SUPABASE/);assert.equal(missing.writes.length,0);
});
