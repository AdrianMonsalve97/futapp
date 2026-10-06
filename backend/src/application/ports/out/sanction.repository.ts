import type { Sanction, SanctionStatus, SanctionType } from '../../../domain/entities';

export interface SanctionFilters {
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

/** Puerto de salida para sanciones. */
export interface SanctionRepository {
  /** Con `playerName`; ordenadas por `created_at` desc. */
  list(filters?: SanctionFilters): Sanction[];
  findById(id: number): Sanction | null;
  create(input: CreateSanctionInput): Sanction;
  update(id: number, input: UpdateSanctionInput): Sanction;
  remove(id: number): void;
}
