import type { Database } from 'better-sqlite3';
import type { UnitOfWork } from '../../../application/ports/out/unit-of-work';

export class SqliteUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database) {}

  run<T>(operation: () => T): T {
    return this.db.transaction(operation).immediate();
  }
}
