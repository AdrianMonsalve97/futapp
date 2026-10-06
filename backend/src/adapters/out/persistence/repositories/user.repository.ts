import type { Database } from 'better-sqlite3';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserRepository,
  UserWithPassword,
} from '../../../../application/ports/out/user.repository';
import type { User } from '../../../../domain/entities';
import { mapUser, type UserRow } from '../mappers';

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  findByEmail(email: string): UserWithPassword | null {
    const row = this.db
      .prepare(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`)
      .get(email.trim()) as UserRow | undefined;
    if (!row) return null;
    return { ...mapUser(row), passwordHash: row.password_hash };
  }

  findById(id: number): User | null {
    const row = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined;
    return row ? mapUser(row) : null;
  }

  create(input: CreateUserInput): User {
    const result = this.db
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
      });
    return this.findById(Number(result.lastInsertRowid)) as User;
  }

  update(id: number, input: UpdateUserInput): User {
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
      this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = @id`).run(params);
    }
    return this.findById(id) as User;
  }

  countActiveAdmins(excludeUserId?: number): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS total FROM users
         WHERE role = 'admin' AND active = 1 AND id <> COALESCE(?, -1)`,
      )
      .get(excludeUserId ?? -1) as { total: number };
    return row.total;
  }
}
