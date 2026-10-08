import type { Database } from 'better-sqlite3';
import type { UnitOfWork } from '../../../application/ports/out/unit-of-work';
import { asAsyncDatabase, type ApplicationDatabase } from "./async-database";

export class SqliteUnitOfWork implements UnitOfWork {
  constructor(db: Database | ApplicationDatabase) {
      this.db = asAsyncDatabase(db);
  }

  async run<T>(operation: () => T | Promise<T>): Promise<T> {
    return this.db.transaction(operation).immediate();
  }

    private readonly db: ApplicationDatabase;
}
