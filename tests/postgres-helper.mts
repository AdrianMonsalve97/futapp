import {PGlite} from '@electric-sql/pglite';
import {PostgresDatabase,createPostgresDatabase} from '../backend/src/adapters/out/persistence/postgres-database';
/** Tests may connect only to a disposable local/CI database, never a Supabase project. */
export async function testPostgres(){
  if(process.env.TEST_DATABASE_URL){
    const url=new URL(process.env.TEST_DATABASE_URL);
    if(!['localhost','127.0.0.1','postgres'].includes(url.hostname)||url.pathname!=='/futapp_test')throw new Error('TEST_DATABASE_URL debe apuntar a futapp_test en el entorno aislado de pruebas');
    process.env.PG_SSL='disable';process.env.NODE_ENV='test';
    return createPostgresDatabase(process.env.TEST_DATABASE_URL);
  }
  const engine=new PGlite();await engine.waitReady;let tail=Promise.resolve();
  const pool={connect:async()=>{
    const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>{release=resolve;});await previous;
    return {query:async(text:string,values:any[]=[])=>{
      const result=!values.length&&text.includes(';')?(await engine.exec(text)).at(-1)!:await engine.query(text,values);
      return {...result,rowCount:result.affectedRows??result.rows.length};
    },release};
  },end:()=>engine.close()};
  return new PostgresDatabase(pool as any);
}
