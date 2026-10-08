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
  list(filters?: InscriptionFilters): Promise<Inscription[]>;
  findById(id: number): Promise<Inscription | null>;
  findByPlayer(playerId: number): Promise<Inscription[]>;
  create(input: CreateInscriptionInput): Promise<Inscription>;
  update(id: number, input: UpdateInscriptionInput): Promise<Inscription>;
  remove(id: number): Promise<void>;
  listPayments(inscriptionId: number): Promise<Payment[]>;
  addPayment(input: CreatePaymentInput): Promise<Payment>;
  findPaymentByKey(inscriptionId: number, key: string): Promise<Payment | null>;
}
