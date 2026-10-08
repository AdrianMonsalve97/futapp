import type { Role, User } from '../../../domain/entities';

/** Usuario con el hash de contraseña (nunca sale de la capa de persistencia hacia las rutas). */
export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: Role;
  active?: boolean;
}

export interface UpdateUserInput {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: Role;
  active?: boolean;
  passwordHash?: string;
}

/** Puerto de salida para la entidad User. */
export interface UserRepository {
  findByEmail(email: string): Promise<UserWithPassword | null>;
  findById(id: number): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  update(id: number, input: UpdateUserInput): Promise<User>;
  /** Cuenta administradores activos (opcionalmente excluyendo uno). */
  countActiveAdmins(excludeUserId?: number): Promise<number>;
}
