import type { Database } from 'better-sqlite3';
import type {
  CreatePlayerInput,
  PlayerRepository,
  PlayerWithUser,
  UpdatePlayerInput,
} from '../../../../application/ports/out/player.repository';
import type { Player } from '../../../../domain/entities';
import { ValidationError } from '../../../../domain/errors';
import { mapPlayer, mapUser, type PlayerRow, type UserRow } from '../mappers';

const SELECT_WITH_USER = `
  SELECT p.*, u.email, u.password_hash, u.full_name, u.phone, u.avatar_url, u.role, u.active, u.created_at
  FROM players p
  JOIN users u ON u.id = p.user_id
`;

interface JoinedRow extends PlayerRow {
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  active: number;
  created_at: string;
}

function toWithUser(row: JoinedRow): PlayerWithUser {
  const userRow: UserRow = {
    id: row.user_id,
    email: row.email,
    password_hash: row.password_hash,
    full_name: row.full_name,
    phone: row.phone,
    avatar_url: row.avatar_url,
    role: row.role,
    active: row.active,
    created_at: row.created_at,
  };
  return { user: mapUser(userRow), player: mapPlayer(row) };
}

export class SqlitePlayerRepository implements PlayerRepository {
  constructor(private readonly db: Database) {}

  list(): PlayerWithUser[] {
    const rows = this.db
      .prepare(`${SELECT_WITH_USER} ORDER BY u.full_name COLLATE NOCASE ASC`)
      .all() as JoinedRow[];
    return rows.map(toWithUser);
  }

  listAll(): Player[] {
    const rows = this.db.prepare(`SELECT * FROM players ORDER BY id ASC`).all() as PlayerRow[];
    return rows.map(mapPlayer);
  }

  findById(id: number): Player | null {
    const row = this.db.prepare(`SELECT * FROM players WHERE id = ?`).get(id) as PlayerRow | undefined;
    return row ? mapPlayer(row) : null;
  }

  findByUserId(userId: number): Player | null {
    const row = this.db.prepare(`SELECT * FROM players WHERE user_id = ?`).get(userId) as
      | PlayerRow
      | undefined;
    return row ? mapPlayer(row) : null;
  }

  findWithUser(id: number): PlayerWithUser | null {
    const row = this.db.prepare(`${SELECT_WITH_USER} WHERE p.id = ?`).get(id) as
      | JoinedRow
      | undefined;
    return row ? toWithUser(row) : null;
  }

  create(input: CreatePlayerInput): Player {
    this.validateShirtNumber(input.shirtNumber ?? null);
    const result = this.write(() => this.db
      .prepare(
        `INSERT INTO players (user_id, dni, birth_date, position, secondary_position, shirt_number,
                              height_cm, weight_kg, foot, emergency_contact, eps, prepaid_health)
         VALUES (@userId, @dni, @birthDate, @position, @secondaryPosition, @shirtNumber,
                 @heightCm, @weightKg, @foot, @emergencyContact, @eps, @prepaidHealth)`,
      )
      .run({
        userId: input.userId,
        dni: input.dni ?? null,
        birthDate: input.birthDate ?? null,
        position: input.position,
        secondaryPosition: input.secondaryPosition ?? null,
        shirtNumber: input.shirtNumber ?? null,
        heightCm: input.heightCm ?? null,
        weightKg: input.weightKg ?? null,
        foot: input.foot ?? null,
        emergencyContact: input.emergencyContact ?? null,
        eps: input.eps?.trim() || null,
        prepaidHealth: input.prepaidHealth?.trim() || null,
      }), input.shirtNumber);
    return this.findById(Number(result.lastInsertRowid)) as Player;
  }

  update(id: number, input: UpdatePlayerInput): Player {
    if (input.shirtNumber !== undefined) this.validateShirtNumber(input.shirtNumber, id);
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };
    const set = (column: string, key: string, value: unknown) => {
      fields.push(`${column} = @${key}`);
      params[key] = value;
    };
    if (input.dni !== undefined) set('dni', 'dni', input.dni);
    if (input.birthDate !== undefined) set('birth_date', 'birthDate', input.birthDate);
    if (input.position !== undefined) set('position', 'position', input.position);
    if (input.secondaryPosition !== undefined) {
      set('secondary_position', 'secondaryPosition', input.secondaryPosition);
    }
    if (input.shirtNumber !== undefined) set('shirt_number', 'shirtNumber', input.shirtNumber);
    if (input.heightCm !== undefined) set('height_cm', 'heightCm', input.heightCm);
    if (input.weightKg !== undefined) set('weight_kg', 'weightKg', input.weightKg);
    if (input.foot !== undefined) set('foot', 'foot', input.foot);
    if (input.eps !== undefined) set('eps', 'eps', input.eps?.trim() || null);
    if (input.prepaidHealth !== undefined) set('prepaid_health', 'prepaidHealth', input.prepaidHealth?.trim() || null);
    if (input.emergencyContact !== undefined) {
      set('emergency_contact', 'emergencyContact', input.emergencyContact);
    }
    if (fields.length > 0) {
      this.write(() => this.db.prepare(`UPDATE players SET ${fields.join(', ')} WHERE id = @id`).run(params), input.shirtNumber);
    }
    return this.findById(id) as Player;
  }

  private validateShirtNumber(number: number | null, exceptId = -1): void {
    if (number === null) return;
    if (!Number.isInteger(number) || number < 0 || number > 999) {
      throw new ValidationError('El dorsal debe ser un número entero entre 0 y 999.');
    }
    if (this.db.prepare('SELECT id FROM players WHERE shirt_number = ? AND id <> ?').get(number, exceptId)) {
      throw this.occupiedNumber(number);
    }
  }

  private occupiedNumber(number: number | null | undefined): ValidationError {
    return new ValidationError(`El dorsal ${number} ya está asignado. Elige otro número o déjalo sin asignar.`, 'SHIRT_NUMBER_TAKEN');
  }

  private write<T>(action: () => T, number: number | null | undefined): T {
    try { return action(); }
    catch (error) {
      // The unique index also protects concurrent writes from another process.
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: players.shirt_number')) throw this.occupiedNumber(number);
      throw error;
    }
  }
}
