import { AsyncLocalStorage } from 'node:async_hooks';
import type { Database as SqliteDatabase } from 'better-sqlite3';

export interface RunResult { changes: number; lastInsertRowid: number | bigint }
export interface AsyncStatement {
  get(...values: any[]): Promise<any>;
  all(...values: any[]): Promise<any[]>;
  run(...values: any[]): Promise<RunResult>;
}
export interface ApplicationDatabase {
  readonly dialect: 'sqlite' | 'postgres';
  prepare(sql: string): AsyncStatement;
  transaction<T>(operation: () => T | Promise<T>): (() => Promise<T>) & { immediate(): Promise<T> };
}

/** A queue prevents other requests from seeing an unfinished async SQLite transaction. */
class SqliteAsyncDatabase implements ApplicationDatabase {
  readonly dialect = 'sqlite' as const;
  private tail: Promise<unknown> = Promise.resolve();
  private scope = new AsyncLocalStorage<boolean>();
  constructor(private db: SqliteDatabase) {}
  private async exclusive<T>(operation: () => T | Promise<T>): Promise<T> {
    if (this.scope.getStore()) return operation();
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await this.scope.run(true, operation); } finally { release(); }
  }
  prepare(sql: string): AsyncStatement {
    return {
      get: (...values) => this.exclusive(() => this.db.prepare(sql).get(...values)),
      all: (...values) => this.exclusive(() => this.db.prepare(sql).all(...values)),
      run: (...values) => this.exclusive(() => this.db.prepare(sql).run(...values)),
    };
  }
  transaction<T>(operation: () => T | Promise<T>) {
    const execute = async () => {
      if (this.scope.getStore() && this.db.inTransaction) return operation();
      return this.exclusive(async () => {
        this.db.exec('BEGIN IMMEDIATE');
        try { const result = await operation(); this.db.exec('COMMIT'); return result; }
        catch (error) { this.db.exec('ROLLBACK'); throw error; }
      });
    };
    return Object.assign(execute, { immediate: execute });
  }
}
const adapters = new WeakMap<SqliteDatabase, ApplicationDatabase>();
export function asAsyncDatabase(db: SqliteDatabase | ApplicationDatabase): ApplicationDatabase {
  if ('dialect' in db) return db;
  let adapter = adapters.get(db);
  if (!adapter) { adapter = new SqliteAsyncDatabase(db); adapters.set(db, adapter); }
  return adapter;
}
