import type { Uniform, UniformKind, UniformVariant } from '../../../domain/entities';

export interface CreateUniformInput {
  name: string;
  kind: UniformKind;
  variant?: UniformVariant;
  price: number;
  stock?: number;
  minStock?: number;
  active?: boolean;
}

export interface UpdateUniformInput {
  imageUrl?: string | null;
  name?: string;
  kind?: UniformKind;
  variant?: UniformVariant;
  price?: number;
  stock?: number;
  minStock?: number;
  active?: boolean;
}

/** Puerto de salida para el catálogo de uniformes. */
export interface UniformRepository {
  /** Por defecto solo activos; incluye `issuedCount` (entregas totales). */
  list(includeInactive?: boolean): Uniform[];
  findById(id: number): Uniform | null;
  create(input: CreateUniformInput): Uniform;
  update(id: number, input: UpdateUniformInput): Uniform;
  /** Baja lógica (`active = false`). */
  remove(id: number): void;
}
