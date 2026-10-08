import type { UnitOfWork } from '../ports/out/unit-of-work';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHmac, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { SecurityRepository } from '../ports/out/security.repository';
import { validatePassword } from '../../domain/password-policy';
import { env } from '../../config/env';
import type { AuthPort, AuthUserView, LoginInput, RegisterInput, RegistrationPayload } from '../ports/in/auth.port';
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

  async login(input: LoginInput): Promise<AuthPayload> {
    const email = (input.email ?? '').trim();
    const password = input.password ?? '';
    if (!email || !password) {
      throw new ValidationError('El email y la contraseña son obligatorios');
    }
    const user = (await this.users.findByEmail(email));
    const matches=bcrypt.compareSync(password,user?.passwordHash??dummyHash);
    if (!user || !matches) {
      throw new UnauthorizedError('Credenciales inválidas', 'INVALID_CREDENTIALS');
    }
    if (!user.active) {
      if (await this.security.pendingRegistration(user.id)) throw new UnauthorizedError('Tu solicitud está pendiente del aval del administrador.', 'REGISTRATION_PENDING');
      throw new UnauthorizedError('La cuenta está inactiva', 'ACCOUNT_DISABLED');
    }
    return (await this.buildPayload(user));
  }

  async register(input: RegisterInput): Promise<RegistrationPayload> {
    return (await this.uow.run(async () => {
          const email = (input.email ?? '').trim().toLowerCase();
          const password = input.password ?? '';
          const fullName = (input.fullName ?? '').trim();
          if (!EMAIL_RE.test(email)) throw new ValidationError('El email no es válido');
          validatePassword(password);
          const invitation=(await this.security.invitation());
          if(!invitation||invitation.expiresAt<=Date.now()||!equal(invitation.digest,digest(input.invitationCode??'')))throw new ValidationError('Necesitas una invitación vigente del administrador para unirte al equipo.');
          if (!fullName) throw new ValidationError('El nombre completo es obligatorio');
          const position = input.position ?? 'MED';
          if (!VALID_POSITIONS.includes(position)) {
            throw new ValidationError(`Posición inválida. Opciones: ${VALID_POSITIONS.join(', ')}`);
          }
          if ((await this.users.findByEmail(email))) {
            throw new ValidationError('El email ya está registrado');
          }
          const user = (await this.users.create({
                  email,
                  passwordHash: bcrypt.hashSync(password, 10),
                  fullName,
                  phone: input.phone ?? null,
                  role: 'player',
                  active: false,
                }));
          const player = (await this.players.create({
                    userId: user.id,
                    position,
                    shirtNumber: input.shirtNumber ?? null,
                  }));
          await this.security.requestRegistration(user.id);
          return {user,player,pendingApproval:true,message:'Solicitud enviada. El administrador debe aprobar tu ingreso antes de que puedas iniciar sesión.'};
        }));
  }

  async me(userId: number): Promise<AuthUserView> {
    const user = (await this.users.findById(userId));
    if (!user) throw new NotFoundError('Usuario no encontrado');
    const player = (await this.players.findByUserId(userId));
    return { user, player };
  }

  private async stamp(user:User){const stored=(await this.users.findByEmail(user.email));return createHmac('sha256',env.jwtSecret).update(stored?.passwordHash??'').digest('hex');}
  async verifySession(token:string):Promise<AuthUserView> {
    try {
      const payload=jwt.verify(token,env.jwtSecret,{algorithms:['HS256'],issuer:'futapp',audience:'futapp-client'}) as jwt.JwtPayload;
      const session=typeof payload.jti==='string'?(await this.security.session(payload.jti)):null;
      const userId=Number(payload.sub);if(!session||session.userId!==userId||session.expiresAt<=Date.now())throw new Error();
      const view=(await this.me(userId));
      if(!view.user.active||view.user.role!==payload.role||!equal(session.stamp,(await this.stamp(view.user))))throw new Error();
      return view;
    }catch{throw new UnauthorizedError('Sesión inválida, expirada o revocada');}
  }
  async logout(token:string){try{const payload=jwt.verify(token,env.jwtSecret,{algorithms:['HS256'],issuer:'futapp',audience:'futapp-client'}) as jwt.JwtPayload;if(payload.jti)(await this.security.revokeSession(payload.jti));}catch{}}
  async createInvitation(){const code=randomBytes(24).toString('base64url'),expiresAt=Date.now()+7*86400000;(await this.security.setInvitation(digest(code),expiresAt));return {code,expiresAt:new Date(expiresAt).toISOString()};}

  private async buildPayload(user: User): Promise<AuthPayload> {
    const id=randomUUID();
    const token = jwt.sign(
      { sub: String(user.id), role: user.role, email: user.email },
      env.jwtSecret,
      { algorithm: 'HS256', issuer:'futapp',audience:'futapp-client',jwtid:id,expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
    );
    (await this.security.createSession(id,user.id,(await this.stamp(user)),(jwt.decode(token) as jwt.JwtPayload).exp!*1000));
    const player = (await this.players.findByUserId(user.id));
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
