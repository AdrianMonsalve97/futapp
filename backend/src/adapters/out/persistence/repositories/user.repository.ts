import type { Database } from 'better-sqlite3';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserRepository,
  UserWithPassword,
} from '../../../../application/ports/out/user.repository';
import type { User } from '../../../../domain/entities';
import { mapUser, type UserRow } from '../mappers';
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

export class SqliteUserRepository implements UserRepository {
  constructor(db: Database | ApplicationDatabase) {
      this.db = asAsyncDatabase(db);
  }

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const row = (await this.db
          .prepare(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`)
          .get(email.trim())) as UserRow | undefined;
    if (!row) return null;
    return { ...mapUser(row), passwordHash: row.password_hash };
  }

  async findById(id: number): Promise<User | null> {
    const row = (await this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id)) as UserRow | undefined;
    return row ? mapUser(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const result = (await this.db
          .prepare(
            `INSERT INTO users (email, password_hash, full_name, phone, avatar_url, role, active)
         VALUES (@email, @passwordHash, @fullName, @phone, @avatarUrl, @role, @active)`,
          )
          .run({
            email: input.email.trim().toLowerCase(),
            passwordHash: input.passwordHash,
            fullName: input.fullName.trim(),
            phone: input.phone ?? null,
            avatarUrl: input.avatarUrl ?? null,
            role: input.role,
            active: input.active === false ? 0 : 1,
          }));
    return (await this.findById(Number(result.lastInsertRowid))) as User;
  }

  async update(id: number, input: UpdateUserInput): Promise<User> {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };
    const set = (column: string, key: string, value: unknown) => {
      fields.push(`${column} = @${key}`);
      params[key] = value;
    };
    if (input.fullName !== undefined) set('full_name', 'fullName', input.fullName.trim());
    if (input.phone !== undefined) set('phone', 'phone', input.phone);
    if (input.avatarUrl !== undefined) set('avatar_url', 'avatarUrl', input.avatarUrl);
    if (input.role !== undefined) set('role', 'role', input.role);
    if (input.active !== undefined) set('active', 'active', input.active ? 1 : 0);
    if (input.passwordHash !== undefined) set('password_hash', 'passwordHash', input.passwordHash);
    if (fields.length > 0) {
      (await this.db.transaction(async ()=>{
                (await this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = @id`).run(params));
                if(input.passwordHash!==undefined||input.role!==undefined||input.active!==undefined)(await this.db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(id));
                if(input.passwordHash!==undefined||input.role!==undefined||input.active!==undefined)await this.db.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').run(id);
              })());
    }
    return (await this.findById(id)) as User;
  }

  async countActiveAdmins(excludeUserId?: number): Promise<number> {
    const row = (await this.db
          .prepare(
            `SELECT COUNT(*) AS total FROM users
         WHERE role = 'admin' AND active = 1 AND id <> COALESCE(?, -1)`,
          )
          .get(excludeUserId ?? -1)) as { total: number };
    return row.total;
  }

    private readonly db: ApplicationDatabase;
}
