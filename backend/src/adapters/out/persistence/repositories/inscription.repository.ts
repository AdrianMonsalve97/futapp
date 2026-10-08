import type { Database } from 'better-sqlite3';
import type {
  CreateInscriptionInput,
  CreatePaymentInput,
  InscriptionFilters,
  InscriptionRepository,
  UpdateInscriptionInput,
} from '../../../../application/ports/out/inscription.repository';
import type { Inscription, Payment } from '../../../../domain/entities';
import { mapInscription, mapPayment, type InscriptionRow, type PaymentRow } from '../mappers';
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

const SELECT_INSCRIPTION = `
  SELECT i.*, u.full_name AS player_name
  FROM inscriptions i
  JOIN players p ON p.id = i.player_id
  JOIN users u ON u.id = p.user_id
`;

export class SqliteInscriptionRepository implements InscriptionRepository {
  constructor(db: Database | ApplicationDatabase) {
      this.db = asAsyncDatabase(db);
  }

  async list(filters: InscriptionFilters = {}): Promise<Inscription[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.season) {
      conditions.push('i.season = ?');
      params.push(filters.season);
    }
    if (filters.playerId !== undefined) {
      conditions.push('i.player_id = ?');
      params.push(filters.playerId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = (await this.db
          .prepare(
            `${SELECT_INSCRIPTION} ${where}
         ORDER BY i.season DESC, COALESCE(i.due_date, i.created_at) ASC, i.id ASC`,
          )
          .all(...params)) as InscriptionRow[];
    return rows.map(mapInscription);
  }

  async findById(id: number): Promise<Inscription | null> {
    const row = (await this.db.prepare(`${SELECT_INSCRIPTION} WHERE i.id = ?`).get(id)) as
      | InscriptionRow
      | undefined;
    return row ? mapInscription(row) : null;
  }

  async findByPlayer(playerId: number): Promise<Inscription[]> {
    const rows = (await this.db
          .prepare(`${SELECT_INSCRIPTION} WHERE i.player_id = ? ORDER BY i.season DESC, i.id DESC`)
          .all(playerId)) as InscriptionRow[];
    return rows.map(mapInscription);
  }

  async create(input: CreateInscriptionInput): Promise<Inscription> {
    const result = (await this.db
          .prepare(
            `INSERT INTO inscriptions (player_id, season, concept, amount, paid, due_date, notes, status)
         VALUES (@playerId, @season, @concept, @amount, 0, @dueDate, @notes, @status)`,
          )
          .run({
            playerId: input.playerId,
            season: input.season,
            concept: input.concept ?? 'Inscripción anual',
            amount: input.amount,
            dueDate: input.dueDate ?? null,
            notes: input.notes ?? null,
            status: input.status,
          }));
    return (await this.findById(Number(result.lastInsertRowid))) as Inscription;
  }

  async update(id: number, input: UpdateInscriptionInput): Promise<Inscription> {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };
    const set = (column: string, key: string, value: unknown) => {
      fields.push(`${column} = @${key}`);
      params[key] = value;
    };
    if (input.season !== undefined) set('season', 'season', input.season);
    if (input.concept !== undefined) set('concept', 'concept', input.concept);
    if (input.amount !== undefined) set('amount', 'amount', input.amount);
    if (input.paid !== undefined) set('paid', 'paid', input.paid);
    if (input.dueDate !== undefined) set('due_date', 'dueDate', input.dueDate);
    if (input.notes !== undefined) set('notes', 'notes', input.notes);
    if (input.status !== undefined) set('status', 'status', input.status);
    if (fields.length > 0) {
      (await this.db.prepare(`UPDATE inscriptions SET ${fields.join(', ')} WHERE id = @id`).run(params));
    }
    return (await this.findById(id)) as Inscription;
  }

  async remove(id: number): Promise<void> {
    (await this.db.prepare(`DELETE FROM inscriptions WHERE id = ?`).run(id));
  }

  async listPayments(inscriptionId: number): Promise<Payment[]> {
    const rows = (await this.db
          .prepare(`SELECT p.*, u.full_name AS registered_by_name FROM payments p LEFT JOIN users u ON u.id = p.registered_by WHERE p.inscription_id = ? ORDER BY p.paid_at DESC, p.id DESC`)
          .all(inscriptionId)) as PaymentRow[];
    return rows.map(mapPayment);
  }

  async addPayment(input: CreatePaymentInput): Promise<Payment> {
    const result = (await this.db
          .prepare(
            `INSERT INTO payments (inscription_id, amount, method, reference, paid_at, notes, registered_by, idempotency_key)
         VALUES (@inscriptionId, @amount, @method, @reference, @paidAt, @notes, @registeredBy, @idempotencyKey)`,
          )
          .run({
            inscriptionId: input.inscriptionId,
            amount: input.amount,
            method: input.method,
            reference: input.reference ?? null,
            paidAt: input.paidAt ?? new Date().toISOString().slice(0, 10),
            notes: input.notes ?? null,
            registeredBy: input.registeredBy ?? null,
            idempotencyKey: input.idempotencyKey ?? null,
          }));
    const row = (await this.db
          .prepare(`SELECT * FROM payments WHERE id = ?`)
          .get(Number(result.lastInsertRowid))) as PaymentRow;
    return mapPayment(row);
  }

  async findPaymentByKey(inscriptionId: number, key: string): Promise<Payment | null> {
    const row = (await this.db.prepare('SELECT * FROM payments WHERE inscription_id = ? AND idempotency_key = ?')
          .get(inscriptionId, key)) as PaymentRow | undefined;
    return row ? mapPayment(row) : null;
  }

    private readonly db: ApplicationDatabase;
}
