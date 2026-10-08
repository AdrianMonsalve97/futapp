import type { Foot, Player, Position, User } from '../../../domain/entities';

export interface PlayerWithUser {
  user: User;
  player: Player;
}

export interface CreatePlayerInput {
  userId: number;
  dni?: string | null;
  birthDate?: string | null;
  position: Position;
  secondaryPosition?: Position | null;
  shirtNumber?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  foot?: Foot | null;
  emergencyContact?: string | null;
  eps?: string | null;
  prepaidHealth?: string | null;
}

export type UpdatePlayerInput = Partial<Omit<CreatePlayerInput, 'userId'>>;

/** Puerto de salida para la entidad Player. */
export interface PlayerRepository {
  /** Todas las fichas con su usuario, ordenadas alfabéticamente. */
  list(): PlayerWithUser[];
  listAll(): Player[];
  findById(id: number): Player | null;
  findByUserId(userId: number): Player | null;
  findWithUser(id: number): PlayerWithUser | null;
  create(input: CreatePlayerInput): Player;
  update(id: number, input: UpdatePlayerInput): Player;
}
