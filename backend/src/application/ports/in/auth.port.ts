import type { AuthPayload, Player, Position, User } from '../../../domain/entities';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  invitationCode?: string;
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

export interface RegistrationPayload extends AuthUserView { pendingApproval:true; message:string }

/** Casos de uso de autenticación (§7.1). */
export interface AuthPort {
  verifySession(token:string):Promise<AuthUserView>;
  logout(token:string):Promise<void>;
  createInvitation():Promise<{code:string;expiresAt:string}>;
  login(input: LoginInput): Promise<AuthPayload>;
  register(input: RegisterInput): Promise<RegistrationPayload>;
  me(userId: number): Promise<AuthUserView>;
}
