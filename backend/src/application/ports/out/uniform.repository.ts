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
  list(includeInactive?: boolean): Promise<Uniform[]>;
  findById(id: number): Promise<Uniform | null>;
  create(input: CreateUniformInput): Promise<Uniform>;
  update(id: number, input: UpdateUniformInput): Promise<Uniform>;
  /** Baja lógica (`active = false`). */
  remove(id: number): Promise<void>;
}
