import type { Inscription, InscriptionStatus, Payment, PaymentMethod } from '../../../domain/entities';

export interface InscriptionFilters {
  season?: string;
  playerId?: number;
}

export interface CreateInscriptionInput {
  playerId: number;
  season: string;
  concept?: string;
  amount: number;
  dueDate?: string | null;
  notes?: string | null;
  status: InscriptionStatus;
}

export interface UpdateInscriptionInput {
  season?: string;
  concept?: string;
  amount?: number;
  paid?: number;
  dueDate?: string | null;
  notes?: string | null;
  status?: InscriptionStatus;
}

export interface CreatePaymentInput {
  idempotencyKey?: string;
  inscriptionId: number;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  paidAt?: string;
  notes?: string | null;
  registeredBy?: number | null;
}

/** Puerto de salida para inscripciones y sus pagos. */
export interface InscriptionRepository {
  /** Con `playerName`; ordenadas por temporada desc y vencimiento asc. */
  list(filters?: InscriptionFilters): Inscription[];
  findById(id: number): Inscription | null;
  findByPlayer(playerId: number): Inscription[];
  create(input: CreateInscriptionInput): Inscription;
  update(id: number, input: UpdateInscriptionInput): Inscription;
  remove(id: number): void;
  listPayments(inscriptionId: number): Payment[];
  addPayment(input: CreatePaymentInput): Payment;
  findPaymentByKey(inscriptionId: number, key: string): Payment | null;
}
