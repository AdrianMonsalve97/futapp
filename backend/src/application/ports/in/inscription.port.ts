import type { Inscription, InscriptionStatus, PaymentMethod } from '../../../domain/entities';

export interface InscriptionFiltersInput {
  season?: string;
  status?: InscriptionStatus;
  playerId?: number;
}

export interface CreateInscriptionInput {
  playerId: number;
  season: string;
  concept?: string;
  amount: number;
  dueDate?: string | null;
  notes?: string | null;
}

export interface AddPaymentInput {
  registeredBy?: number;
  idempotencyKey?: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  paidAt?: string;
  notes?: string | null;
}

export interface UpdateInscriptionInput {
  amount?: number;
  dueDate?: string | null;
  notes?: string | null;
  concept?: string;
  season?: string;
}

/** Casos de uso de inscripciones (§7.5). */
export interface InscriptionPort {
  list(filters?: InscriptionFiltersInput): Promise<Inscription[]>;
  create(input: CreateInscriptionInput): Promise<Inscription>;
  addPayment(id: number, input: AddPaymentInput): Promise<Inscription>;
  update(id: number, input: UpdateInscriptionInput): Promise<Inscription>;
  remove(id: number): Promise<{ ok: true }>;
}
