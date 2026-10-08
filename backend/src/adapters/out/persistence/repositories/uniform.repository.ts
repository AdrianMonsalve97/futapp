import type { Database } from 'better-sqlite3';
import type {
  CreateUniformInput,
  UniformRepository,
  UpdateUniformInput,
} from '../../../../application/ports/out/uniform.repository';
import type { Uniform } from '../../../../domain/entities';
import { mapUniform, type UniformRow } from '../mappers';
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

export class SqliteUniformRepository implements UniformRepository {
  constructor(db: Database | ApplicationDatabase) {
      this.db = asAsyncDatabase(db);
  }

  async list(includeInactive = false): Promise<Uniform[]> {
    const where = includeInactive ? '' : 'WHERE u.active = 1';
    const rows = (await this.db
          .prepare(
            `SELECT u.*, (SELECT COUNT(*) FROM uniform_issues ui WHERE ui.uniform_id = u.id) AS issued_count
         FROM uniforms u
         ${where}
         ORDER BY u.active DESC, u.kind ASC, u.name COLLATE NOCASE ASC`,
          )
          .all()) as UniformRow[];
    return rows.map(mapUniform);
  }

  async findById(id: number): Promise<Uniform | null> {
    const row = (await this.db.prepare(`SELECT * FROM uniforms WHERE id = ?`).get(id)) as
      | UniformRow
      | undefined;
    return row ? mapUniform(row) : null;
  }

  async create(input: CreateUniformInput): Promise<Uniform> {
    const result = (await this.db
          .prepare(
            `INSERT INTO uniforms (name, kind, variant, price, stock, min_stock, active)
         VALUES (@name, @kind, @variant, @price, @stock, @minStock, @active)`,
          )
          .run({
            name: input.name.trim(),
            kind: input.kind,
            variant: input.variant ?? 'titular',
            price: input.price,
            stock: input.stock ?? 0,
            minStock: input.minStock ?? 3,
            active: input.active === false ? 0 : 1,
          }));
    return (await this.findById(Number(result.lastInsertRowid))) as Uniform;
  }

  async update(id: number, input: UpdateUniformInput): Promise<Uniform> {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };
    const set = (column: string, key: string, value: unknown) => {
      fields.push(`${column} = @${key}`);
      params[key] = value;
    };
    if (input.imageUrl !== undefined) set('image_url', 'imageUrl', input.imageUrl);
    if (input.name !== undefined) set('name', 'name', input.name.trim());
    if (input.kind !== undefined) set('kind', 'kind', input.kind);
    if (input.variant !== undefined) set('variant', 'variant', input.variant);
    if (input.price !== undefined) set('price', 'price', input.price);
    if (input.stock !== undefined) set('stock', 'stock', input.stock);
    if (input.minStock !== undefined) set('min_stock', 'minStock', input.minStock);
    if (fields.length > 0) {
      (await this.db.prepare(`UPDATE uniforms SET ${fields.join(', ')} WHERE id = @id`).run(params));
    }
    return (await this.findById(id)) as Uniform;
  }

  async remove(id: number): Promise<void> {
    (await this.db.prepare(`UPDATE uniforms SET active = 0 WHERE id = ?`).run(id));
  }

    private readonly db: ApplicationDatabase;
}
