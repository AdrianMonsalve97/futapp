import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient, type QueryResult } from 'pg';
import type { ApplicationDatabase, AsyncStatement } from './async-database';
import { ValidationError } from '../../../domain/errors';

const serialTables = new Set(['users','players','inscriptions','payments','uniforms','uniform_issues','uniform_requests','matches','strategies','lineups','sanctions','match_stats','tournaments','tournament_documents','payment_receipts','notification_jobs']);

/** Only translates our parameterized repository SQL, never SQL supplied by a user. */
export function postgresQuery(sql: string, values: any[], insert = false): { text: string; values: any[] } {
  let text = sql.replace(/datetime\('now'\)/gi,"to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')")
    .replace(/date\('now'\)/gi,"to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD')")
    .replace(/\b([a-z_][a-z0-9_.]*)\s+COLLATE NOCASE\b/gi,'LOWER($1)')
    .replace(/\bAS\s+([a-zA-Z_][a-zA-Z0-9_]*[A-Z][a-zA-Z0-9_]*)\b/g,'AS "$1"');
  const ignored = /INSERT OR IGNORE/i.test(text);
  text = text.replace(/INSERT OR IGNORE/gi,'INSERT');
  if (ignored && !/ON CONFLICT/i.test(text)) text = text.replace(/;?\s*$/,' ON CONFLICT DO NOTHING');
  const args: any[] = [];
  const named = values.length === 1 && values[0] && typeof values[0] === 'object' && !Array.isArray(values[0]) ? values[0] : null;
  let position = 0;
  // Protect quoted SQL literals/identifiers from placeholder replacement.
  text = text.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?|@[a-zA-Z_][a-zA-Z0-9_]*/g, token => {
    if (token[0] !== '?' && token[0] !== '@') return token;
    const value = token === '?' ? values[position++] : named?.[token.slice(1)];
    if (value === undefined) throw new Error('Falta un parámetro de persistencia');
    args.push(value); return '$' + args.length;
  });
  const table = /^\s*INSERT INTO\s+([a-z_]+)/i.exec(text)?.[1];
  if (insert && table && serialTables.has(table) && !/\bRETURNING\b/i.test(text)) text = text.replace(/;?\s*$/,' RETURNING id');
  return { text, values: args };
}

function normalize(result: QueryResult): any[] {
  return result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const type = result.fields.find(field => field.name === key)?.dataTypeID;
    if ((type === 20 || type === 1700) && value !== null) {
      const number = Number(value); if (!Number.isFinite(number) || (type === 20 && !Number.isSafeInteger(number))) throw new Error('Valor numérico fuera de rango');
      return [key,number];
    }
    return [key,value];
  })));
}

export class PostgresDatabase implements ApplicationDatabase {
  readonly dialect = 'postgres' as const;
  private scope = new AsyncLocalStorage<PoolClient>();
  constructor(readonly pool: Pool) {}
  private async client<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const current = this.scope.getStore(); if (current) return operation(current);
    const client = await this.pool.connect();
    try {
      await client.query("SET search_path TO futapp, pg_catalog; SET statement_timeout TO '30s'; SET lock_timeout TO '10s'");
      return await operation(client);
    } finally { client.release(); }
  }
  async query(text: string, values: any[] = []): Promise<any[]> {
    return this.client(async client => normalize(await client.query(text,values)));
  }
  async execute(text: string): Promise<void> { await this.client(async client => { await client.query(text); }); }
  prepare(sql: string): AsyncStatement {
    const query = (values: any[], insert = false) => {
      const statement = postgresQuery(sql,values,insert);
      return this.client(client => client.query(statement.text,statement.values)).catch((error:unknown)=>{
        const code=typeof error==='object'&&error&&'code' in error?String(error.code):'';
        if(code==='23505')throw new ValidationError('El registro ya existe; revisa el dorsal, correo o referencia');
        if(code==='23503')throw new ValidationError('La operación hace referencia a un registro que ya no existe');
        if(code==='23514'||code==='23502')throw new ValidationError('Los datos no cumplen las reglas del equipo');
        throw new Error('No se pudo completar la consulta de PostgreSQL');
      });
    };
    return {
      get: async (...values) => normalize(await query(values))[0],
      all: async (...values) => normalize(await query(values)),
      run: async (...values) => { const result = await query(values,true); return { changes: result.rowCount ?? 0, lastInsertRowid: normalize(result)[0]?.id ?? 0 }; },
    };
  }
  transaction<T>(operation: () => T | Promise<T>) {
    const execute = async (): Promise<T> => {
      if (this.scope.getStore()) return operation();
      return this.client(async client => {
        await client.query('BEGIN');
        try {
          await client.query("SELECT pg_advisory_xact_lock(hashtextextended('futapp-write',0))");
          const result = await this.scope.run(client,operation); await client.query('COMMIT'); return result;
        }
        catch (error) { await client.query('ROLLBACK'); throw error; }
      });
    };
    return Object.assign(execute,{immediate:execute});
  }
  async close() { await this.pool.end(); }
}

export function createPostgresDatabase(connectionString: string): PostgresDatabase {
  const url=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('DATABASE_URL debe ser una conexión de PostgreSQL');
  if(url.hostname.endsWith('.pooler.supabase.com')&&url.port==='6543')throw new Error('Selecciona Session pooler, puerto 5432, en Supabase');
  if(process.env.NODE_ENV==='production'&&process.env.PG_SSL==='disable')throw new Error('PostgreSQL requiere TLS en producción');
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
  return new PostgresDatabase(new Pool({ connectionString:url.toString(), max:5, connectionTimeoutMillis:15000,
    ssl: process.env.PG_SSL === 'disable' ? false : { rejectUnauthorized:true,
      ...(process.env.SUPABASE_DB_CA ? {ca:process.env.SUPABASE_DB_CA.replace(/\\n/g,'\n')} : {}) },
  }));
}
