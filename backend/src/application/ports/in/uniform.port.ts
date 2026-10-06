import type {
  Uniform,
  UniformCondition,
  UniformIssue,
  UniformKind,
  UniformRequest,
  UniformRequestStatus,
  UniformVariant,
} from '../../../domain/entities';

export interface CreateUniformInput {
  name: string;
  kind: UniformKind;
  variant?: UniformVariant;
  price: number;
  stock?: number;
  minStock?: number;
}

export interface UpdateUniformInput {
  name?: string;
  kind?: UniformKind;
  variant?: UniformVariant;
  price?: number;
  stock?: number;
  minStock?: number;
}

export interface CreateIssueInput {
  playerId: number;
  uniformId: number;
  size: string;
  cost?: number;
  condition?: UniformCondition;
  notes?: string | null;
}

export interface UpdateIssueInput {
  returned?: boolean;
  condition?: UniformCondition;
  notes?: string | null;
}

export interface UpdateRequestInput {
  status: UniformRequestStatus;
  reviewNotes?: string | null;
}

/** Casos de uso de uniformes (§7.6). */
export interface UniformPort {
  listUniforms(): Uniform[];
  createUniform(input: CreateUniformInput): Uniform;
  updateUniform(id: number, input: UpdateUniformInput): Uniform;
  removeUniform(id: number): { ok: true };
  listIssues(playerId?: number): UniformIssue[];
  createIssue(input: CreateIssueInput): UniformIssue;
  updateIssue(id: number, input: UpdateIssueInput): UniformIssue;
  listRequests(status?: UniformRequestStatus): UniformRequest[];
  updateRequest(id: number, input: UpdateRequestInput): UniformRequest;
}
