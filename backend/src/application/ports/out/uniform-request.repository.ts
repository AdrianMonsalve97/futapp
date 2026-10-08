import type { UniformRequest, UniformRequestStatus } from '../../../domain/entities';

export interface CreateUniformRequestInput {
  playerId: number;
  uniformId: number;
  size: string;
  reason?: string | null;
}

export interface UpdateUniformRequestInput {
  issueId?: number;
  status?: UniformRequestStatus;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
}

/** Puerto de salida para solicitudes de uniformes. */
export interface UniformRequestRepository {
  list(status?: UniformRequestStatus, playerId?: number): UniformRequest[];
  findById(id: number): UniformRequest | null;
  create(input: CreateUniformRequestInput): UniformRequest;
  update(id: number, input: UpdateUniformRequestInput): UniformRequest;
}
