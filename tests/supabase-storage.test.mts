import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseObjectStorage} from '../backend/src/adapters/out/persistence/supabase-storage';

test('Supabase SDK creates a private bucket and authenticates object requests on the server',async()=>{
  const files=new Map<string,Buffer>();let exists=false;
  const request:typeof fetch=async(input,options={})=>{
    const url=new URL(String(input)),headers=new Headers(options.headers);
    assert.equal(headers.get('apikey'),'sb_secret_test_only');
    assert.equal(headers.get('authorization'),'Bearer sb_secret_test_only');
    if(url.pathname==='/storage/v1/bucket/futapp-media')return exists?Response.json({id:'futapp-media',public:false}):Response.json({statusCode:'404',message:'Not found'},{status:404});
    if(url.pathname==='/storage/v1/bucket'){
      const body=JSON.parse(String(options.body));assert.equal(body.public,false);assert.equal(body.file_size_limit,12*1024*1024);exists=true;return Response.json({name:'futapp-media'});
    }
    if(options.method==='DELETE'){
      const body=JSON.parse(String(options.body));for(const key of body.prefixes)files.delete(key);return Response.json([]);
    }
    const key=url.pathname.split('/').at(-1)!;
    if(options.method==='POST'){
      assert.equal(headers.get('x-upsert'),'false');files.set(key,Buffer.from(options.body as Uint8Array));return Response.json({Key:'futapp-media/'+key});
    }
    assert(files.has(key));return new Response(files.get(key)!);
  };
  const storage=new SupabaseObjectStorage('https://test-project.supabase.co','sb_secret_test_only','futapp-media',request);
  await storage.initialize();await storage.initialize();await storage.put('private.txt',Buffer.from('Privado'),'text/plain');assert.equal((await storage.get('private.txt')).toString(),'Privado');
  await storage.remove('private.txt');assert.equal(files.size,0);await assert.rejects(()=>storage.get('../secret'));
});
test('existing public buckets are rejected instead of exposing medical or payment files',async()=>{
  const storage=new SupabaseObjectStorage('https://test-project.supabase.co','sb_secret_test_only','futapp-media',async()=>Response.json({id:'futapp-media',public:true}));
  await assert.rejects(()=>storage.initialize(),/privado/);
});
