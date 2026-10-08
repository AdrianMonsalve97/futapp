import type { UnitOfWork } from '../ports/out/unit-of-work';
import type {
  AddPaymentInput,
  CreateInscriptionInput,
  InscriptionFiltersInput,
  InscriptionPort,
  UpdateInscriptionInput,
} from '../ports/in/inscription.port';
import type { InscriptionRepository } from '../ports/out/inscription.repository';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { Inscription } from '../../domain/entities';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { deriveInscriptionStatus, formatMoney } from './shared';

const EPSILON = 0.001;

export class InscriptionService implements InscriptionPort {
  constructor(
    private readonly inscriptions: InscriptionRepository,
    private readonly players: PlayerRepository,
    private readonly uow: UnitOfWork,
  ) {}

  /** Siempre devuelve `status` derivado de `paid`/`amount` (§4). */
  private withPayments(inscription: Inscription): Inscription {
    const status = deriveInscriptionStatus(inscription.paid, inscription.amount);
    return { ...inscription, status, payments: this.inscriptions.listPayments(inscription.id) };
  }

  list(filters: InscriptionFiltersInput = {}): Inscription[] {
    const rows = this.inscriptions.list({ season: filters.season, playerId: filters.playerId });
    return rows
      .map((row) => ({ ...row, status: deriveInscriptionStatus(row.paid, row.amount) }))
      .filter((row) => (filters.status ? row.status === filters.status : true))
      .map((row) => this.withPayments(row));
  }

  create(input: CreateInscriptionInput): Inscription {
    if (!input.season || !input.season.trim()) {
      throw new ValidationError('La temporada es obligatoria');
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ValidationError('El monto de la inscripción debe ser mayor a 0');
    }
    const player = this.players.findById(input.playerId);
    if (!player) throw new NotFoundError('Jugador no encontrado');
    const created = this.inscriptions.create({
      ...input,
      status: deriveInscriptionStatus(0, input.amount),
    });
    return this.withPayments(created);
  }

  addPayment(id: number, input: AddPaymentInput): Inscription {
    return this.uow.run(() => {
      const current = this.inscriptions.findById(id);
      if (!current) throw new NotFoundError('Inscripción no encontrada');
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        throw new ValidationError('El monto del pago debe ser mayor a 0');
      }
      const reference = input.reference?.trim() || null;
      if (input.idempotencyKey) {
        if (!/^[a-zA-Z0-9_-]{8,128}$/.test(input.idempotencyKey)) throw new ValidationError('Identificador de pago inválido');
        const previous = this.inscriptions.findPaymentByKey(id, input.idempotencyKey);
        if (previous) {
          if (previous.amount !== input.amount || previous.method !== input.method || previous.reference !== reference || previous.notes !== (input.notes ?? null) || (input.paidAt && previous.paidAt !== input.paidAt)) {
            throw new ValidationError('Este identificador ya pertenece a otro pago. Abre un nuevo registro.', 'PAYMENT_KEY_CONFLICT');
          }
          return this.withPayments(current);
        }
      }
      if (reference && this.inscriptions.listPayments(id).some(p => p.method === input.method && p.reference?.trim() === reference)) {
        throw new ValidationError('Ya existe un pago con esta referencia', 'DUPLICATE_PAYMENT');
      }
      const status = deriveInscriptionStatus(current.paid, current.amount);
      if (status === 'pagada') {
        throw new ValidationError('La inscripción ya está saldada');
      }
      const saldo = current.amount - current.paid;
      if (input.amount > saldo + EPSILON) {
        throw new ValidationError(
          `El pago de ${formatMoney(input.amount)} excede el saldo pendiente de ${formatMoney(saldo)}`,
        );
      }
      this.inscriptions.addPayment({
        inscriptionId: id,
        registeredBy: input.registeredBy,
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        method: input.method,
        reference,
        paidAt: input.paidAt,
        notes: input.notes,
      });
      const paid = roundMoney(current.paid + input.amount);
      const updated = this.inscriptions.update(id, {
        paid,
        status: deriveInscriptionStatus(paid, current.amount),
      });
      return this.withPayments(updated);
    });
  }

  update(id: number, input: UpdateInscriptionInput): Inscription {
    const current = this.inscriptions.findById(id);
    if (!current) throw new NotFoundError('Inscripción no encontrada');
    if (input.amount !== undefined && (!Number.isFinite(input.amount) || input.amount <= 0)) {
      throw new ValidationError('El monto de la inscripción debe ser mayor a 0');
    }
    if (input.season !== undefined && !input.season.trim()) {
      throw new ValidationError('La temporada es obligatoria');
    }
    const amount = input.amount ?? current.amount;
    if (amount < current.paid) throw new ValidationError('El monto no puede ser menor que lo ya pagado');
    const updated = this.inscriptions.update(id, {
      ...input,
      status: deriveInscriptionStatus(current.paid, amount),
    });
    return this.withPayments(updated);
  }

  remove(id: number): { ok: true } {
    const current = this.inscriptions.findById(id);
    if (!current) throw new NotFoundError('Inscripción no encontrada');
    this.inscriptions.remove(id);
    return { ok: true };
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
