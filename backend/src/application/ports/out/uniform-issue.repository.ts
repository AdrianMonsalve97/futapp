import type { UniformCondition, UniformIssue } from '../../../domain/entities';

export interface CreateUniformIssueInput {
  playerId: number;
  uniformId: number;
  size: string;
  cost?: number;
  condition?: UniformCondition;
  notes?: string | null;
}

export interface UpdateUniformIssueInput {
  returned?: boolean;
  condition?: UniformCondition;
  notes?: string | null;
}

/** Puerto de salida para entregas de uniformes. */
export interface UniformIssueRepository {
  list(playerId?: number): Promise<UniformIssue[]>;
  findById(id: number): Promise<UniformIssue | null>;
  create(input: CreateUniformIssueInput): Promise<UniformIssue>;
  update(id: number, input: UpdateUniformIssueInput): Promise<UniformIssue>;
}
