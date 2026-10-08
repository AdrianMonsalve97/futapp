import type { Sanction, SanctionStatus, SanctionType } from '../../../domain/entities';

export interface SanctionFiltersInput {
  playerId?: number;
  status?: SanctionStatus;
  type?: SanctionType;
}

export interface CreateSanctionInput {
  playerId: number;
  matchId?: number | null;
  type: SanctionType;
  reason: string;
  amount?: number;
  points?: number;
  matchDate?: string | null;
}

export interface UpdateSanctionInput {
  status?: SanctionStatus;
  reason?: string;
  amount?: number;
  points?: number;
}

/** Casos de uso de sanciones (§7.7). */
export interface SanctionPort {
  list(filters?: SanctionFiltersInput): Promise<Sanction[]>;
  create(input: CreateSanctionInput): Promise<Sanction>;
  update(id: number, input: UpdateSanctionInput): Promise<Sanction>;
  remove(id: number): Promise<{ ok: true }>;
}
