import type { AuthPayload, Player, Position, User } from '../../../domain/entities';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  position?: Position;
  shirtNumber?: number | null;
}

export interface AuthUserView {
  user: User;
  player: Player | null;
}

/** Casos de uso de autenticación (§7.1). */
export interface AuthPort {
  login(input: LoginInput): AuthPayload;
  register(input: RegisterInput): AuthPayload;
  me(userId: number): AuthUserView;
}
