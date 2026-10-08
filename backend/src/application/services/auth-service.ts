import type { UnitOfWork } from '../ports/out/unit-of-work';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHmac, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { SecurityRepository } from '../ports/out/security.repository';
import { validatePassword } from '../../domain/password-policy';
import { env } from '../../config/env';
import type { AuthPort, AuthUserView, LoginInput, RegisterInput } from '../ports/in/auth.port';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { UserRepository } from '../ports/out/user.repository';
import type { AuthPayload, User } from '../../domain/entities';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const dummyHash=bcrypt.hashSync('dummy-login-timing-password',10);
const VALID_POSITIONS = ['POR', 'DEF', 'MED', 'DEL'] as const;

export class AuthService implements AuthPort {
  constructor(
    private readonly users: UserRepository,
    private readonly players: PlayerRepository,
    private readonly uow: UnitOfWork,
    private readonly security:SecurityRepository,
  ) {}

  login(input: LoginInput): AuthPayload {
    const email = (input.email ?? '').trim();
    const password = input.password ?? '';
    if (!email || !password) {
      throw new ValidationError('El email y la contraseña son obligatorios');
    }
    const user = this.users.findByEmail(email);
    const matches=bcrypt.compareSync(password,user?.passwordHash??dummyHash);
    if (!user || !matches) {
      throw new UnauthorizedError('Credenciales inválidas', 'INVALID_CREDENTIALS');
    }
    if (!user.active) {
      throw new UnauthorizedError('La cuenta está inactiva', 'ACCOUNT_DISABLED');
    }
    return this.buildPayload(user);
  }

  register(input: RegisterInput): AuthPayload {
    return this.uow.run(() => {
      const email = (input.email ?? '').trim().toLowerCase();
      const password = input.password ?? '';
      const fullName = (input.fullName ?? '').trim();
      if (!EMAIL_RE.test(email)) throw new ValidationError('El email no es válido');
      validatePassword(password);
      const invitation=this.security.invitation();
      if(!invitation||invitation.expiresAt<=Date.now()||!equal(invitation.digest,digest(input.invitationCode??'')))throw new ValidationError('Necesitas una invitación vigente del administrador para unirte al equipo.');
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
    });
  }

  me(userId: number): AuthUserView {
    const user = this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');
    const player = this.players.findByUserId(userId);
    return { user, player };
  }

  private stamp(user:User){const stored=this.users.findByEmail(user.email);return createHmac('sha256',env.jwtSecret).update(stored?.passwordHash??'').digest('hex');}
  verifySession(token:string):AuthUserView {
    try {
      const payload=jwt.verify(token,env.jwtSecret,{algorithms:['HS256'],issuer:'futapp',audience:'futapp-client'}) as jwt.JwtPayload;
      const session=typeof payload.jti==='string'?this.security.session(payload.jti):null;
      const userId=Number(payload.sub);if(!session||session.userId!==userId||session.expiresAt<=Date.now())throw new Error();
      const view=this.me(userId);
      if(!view.user.active||view.user.role!==payload.role||!equal(session.stamp,this.stamp(view.user)))throw new Error();
      return view;
    }catch{throw new UnauthorizedError('Sesión inválida, expirada o revocada');}
  }
  logout(token:string){try{const payload=jwt.verify(token,env.jwtSecret,{algorithms:['HS256'],issuer:'futapp',audience:'futapp-client'}) as jwt.JwtPayload;if(payload.jti)this.security.revokeSession(payload.jti);}catch{}}
  createInvitation(){const code=randomBytes(24).toString('base64url'),expiresAt=Date.now()+7*86400000;this.security.setInvitation(digest(code),expiresAt);return {code,expiresAt:new Date(expiresAt).toISOString()};}

  private buildPayload(user: User): AuthPayload {
    const id=randomUUID();
    const token = jwt.sign(
      { sub: String(user.id), role: user.role, email: user.email },
      env.jwtSecret,
      { algorithm: 'HS256', issuer:'futapp',audience:'futapp-client',jwtid:id,expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
    );
    this.security.createSession(id,user.id,this.stamp(user),(jwt.decode(token) as jwt.JwtPayload).exp!*1000);
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
