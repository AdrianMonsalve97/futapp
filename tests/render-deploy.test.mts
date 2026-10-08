import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderClient } from '../scripts/render-deploy.mjs';
const commit='a'.repeat(40),url='https://futapp-test.onrender.com';
function fixture({free=false,mismatched=false}={}){
  const env=new Map([['JWT_SECRET','existing-very-long-jwt-secret-that-must-persist'],['SMTP_PASSWORD','keep-provider-secret']]);
  const writes:{route:string;body:any}[]=[];let trigger='commit';
  const request=async(input:string,options:any={})=>{
    const parsed=new URL(input),route=parsed.pathname.replace('/v1/services/srv-example','');
    if(parsed.origin==='https://api.render.com')assert.equal(options.headers.Authorization,'Bearer api-key-test');
    if(parsed.origin===url)return new Response('{"status":"ok"}',{status:200});
    if(options.method==='PUT'){const body=JSON.parse(options.body);writes.push({route,body});env.set(route.split('/').at(-1)!,body.value);return Response.json({});}
    if(options.method==='PATCH'){trigger=JSON.parse(options.body).autoDeployTrigger;return Response.json({});}
    if(options.method==='POST'){const body=JSON.parse(options.body);writes.push({route,body});return Response.json({id:'dep-example'});}
    if(route.startsWith('/env-vars'))return Response.json([...env].map(([key,value])=>({envVar:{key,value},cursor:key})));
    if(route==='/deploys/dep-example')return Response.json({id:'dep-example',status:'live',commit:{id:mismatched?'b'.repeat(40):commit}});
    return Response.json({type:'web_service',repo:'https://github.com/AdrianMonsalve97/futapp.git',branch:'main',rootDir:'',autoDeployTrigger:trigger,serviceDetails:{runtime:'node',numInstances:1,plan:free?'free':'0.5c-512mb',disk:{mountPath:'/var/data'},url}});
  };
  return {env,writes,client:createRenderClient({apiKey:'api-key-test',serviceId:'srv-example',request})};
}
test('environment task preserves existing secrets, generates missing credentials and is idempotent',async()=>{
  const {client,env,writes}=fixture();const before=env.get('JWT_SECRET');await client.configure();
  assert.equal(env.get('JWT_SECRET'),before);assert.equal(env.get('SMTP_PASSWORD'),'keep-provider-secret');
  assert(env.get('ADMIN_PASSWORD')!.length>=15);assert.equal(env.get('DB_PATH'),'/var/data/portal.db');assert.equal(env.get('PUBLIC_APP_URL'),url);
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
  const {client,writes}=fixture({free:true});await assert.rejects(client.configure(),/persistente/);assert.equal(writes.length,0);
});
