import type {
  Uniform,
  UniformCondition,
  UniformIssue,
  UniformKind,
  UniformRequest,
  UniformRequestStatus,
  UniformVariant,
  UniformRecipientInput,
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

export interface CreateIssueInput extends UniformRecipientInput {
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
  listUniforms(): Promise<Uniform[]>;
  createUniform(input: CreateUniformInput): Promise<Uniform>;
  updateUniform(id: number, input: UpdateUniformInput): Promise<Uniform>;
  removeUniform(id: number): Promise<{ ok: true }>;
  listIssues(playerId?: number): Promise<UniformIssue[]>;
  createIssue(input: CreateIssueInput): Promise<UniformIssue>;
  updateIssue(id: number, input: UpdateIssueInput): Promise<UniformIssue>;
  listRequests(status?: UniformRequestStatus): Promise<UniformRequest[]>;
  updateRequest(id: number, input: UpdateRequestInput): Promise<UniformRequest>;
}
