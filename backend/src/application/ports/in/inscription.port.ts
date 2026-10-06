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
  list(filters?: InscriptionFiltersInput): Inscription[];
  create(input: CreateInscriptionInput): Inscription;
  addPayment(id: number, input: AddPaymentInput): Inscription;
  update(id: number, input: UpdateInscriptionInput): Inscription;
  remove(id: number): { ok: true };
}
