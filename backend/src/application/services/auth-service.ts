import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import type { AuthPort, AuthUserView, LoginInput, RegisterInput } from '../ports/in/auth.port';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { UserRepository } from '../ports/out/user.repository';
import type { AuthPayload, User } from '../../domain/entities';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;
const VALID_POSITIONS = ['POR', 'DEF', 'MED', 'DEL'] as const;

export class AuthService implements AuthPort {
  constructor(
    private readonly users: UserRepository,
    private readonly players: PlayerRepository,
  ) {}

  login(input: LoginInput): AuthPayload {
    const email = (input.email ?? '').trim();
    const password = input.password ?? '';
    if (!email || !password) {
      throw new ValidationError('El email y la contraseña son obligatorios');
    }
    const user = this.users.findByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new UnauthorizedError('Credenciales inválidas', 'INVALID_CREDENTIALS');
    }
    if (!user.active) {
      throw new UnauthorizedError('La cuenta está inactiva', 'ACCOUNT_DISABLED');
    }
    return this.buildPayload(user);
  }

  register(input: RegisterInput): AuthPayload {
    const email = (input.email ?? '').trim().toLowerCase();
    const password = input.password ?? '';
    const fullName = (input.fullName ?? '').trim();
    if (!EMAIL_RE.test(email)) throw new ValidationError('El email no es válido');
    if (password.length < MIN_PASSWORD) {
      throw new ValidationError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);
    }
    if (!fullName) throw new ValidationError('El nombre completo es obligatorio');
    const position = input.position ?? 'MED';
    if (!VALID_POSITIONS.includes(position)) {
      throw new ValidationError(`Posición inválida. Opciones: ${VALID_POSITIONS.join(', ')}`);
    }
    if (this.users.findByEmail(email)) {
      throw new ValidationError('El email ya está registrado');
    }
    const user = this.users.create({
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      fullName,
      phone: input.phone ?? null,
      role: 'player',
    });
    this.players.create({
      userId: user.id,
      position,
      shirtNumber: input.shirtNumber ?? null,
    });
    return this.buildPayload(user);
  }

  me(userId: number): AuthUserView {
    const user = this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');
    const player = this.players.findByUserId(userId);
    return { user, player };
  }

  private buildPayload(user: User): AuthPayload {
    const token = jwt.sign(
      { sub: String(user.id), role: user.role, email: user.email },
      env.jwtSecret,
      { algorithm: 'HS256', expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
    );
    const player = this.players.findByUserId(user.id);
    // Nunca se expone el hash de la contraseña en la respuesta.
    const safeUser: User = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
    };
    return { token, user: safeUser, player };
  }
}
