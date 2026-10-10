import type { UnitOfWork } from '../ports/out/unit-of-work';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHmac, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { SecurityRepository } from '../ports/out/security.repository';
import { validatePassword } from '../../domain/password-policy';
import { env } from '../../config/env';
import type { AuthPort, AuthUserView, LoginInput, RegisterInput, RegistrationPayload } from '../ports/in/auth.port';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { UserRepository,UserWithPassword } from '../ports/out/user.repository';
import type {RecoveryMailer,RecoveryMail} from '../ports/out/recovery-mailer';
import type { AuthPayload, User, SessionStatus } from '../../domain/entities';
import { AppError,ForbiddenError,NotFoundError, UnauthorizedError, ValidationError } from '../../domain/errors';

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
    private readonly recoveryMailer:RecoveryMailer,
  ) {}

  private recoveryOrigin():string|null {
    try{const url=new URL(env.publicAppUrl||'');if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
      if(url.protocol==='https:'||(!env.production&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))return url.origin;
    }catch{}return null;
  }
  recoveryStatus(){const status=this.recoveryMailer.status(),missing=[...status.missing];if(!this.recoveryOrigin())missing.push('PUBLIC_APP_URL');return {ready:missing.length===0,missing,expiresInMinutes:15};}
  private recoveryStamp(user:UserWithPassword){return createHmac('sha256',env.jwtSecret).update(`${user.id}:${user.role}:${user.active}:${user.passwordHash}`).digest('hex');}
  private async issueRecovery(user:UserWithPassword,createdBy:number|null){
    const origin=this.recoveryOrigin();if(!origin)throw new ValidationError('Configura la URL pública de FutApp para generar enlaces de recuperación.');
    const token=randomBytes(32).toString('base64url'),issuedAt=Date.now(),expiresAt=issuedAt+15*60000;
    await this.security.savePasswordReset({userId:user.id,tokenHash:digest(token),stamp:this.recoveryStamp(user),issuedAt,expiresAt,createdBy});
    return {url:`${origin}/restablecer-contrasena#token=${token}`,expiresAt:new Date(expiresAt).toISOString(),tokenHash:digest(token)};
  }
  private deliverRecovery(message:RecoveryMail,tokenHash?:string){
    // Email latency never reveals whether an account exists. Never log links, recipient or provider bodies.
    setImmediate(()=>{void this.recoveryMailer.send(message).then(()=>tokenHash?this.security.resetDelivery(tokenHash,'sent'):undefined).catch(async()=>{if(tokenHash)await this.security.resetDelivery(tokenHash,'failed');}).catch(()=>{});});
  }
  async forgotPassword(value:string):Promise<{message:string}>{
    const email=value.trim().toLowerCase(),started=Date.now();
    if(email.length>254||!EMAIL_RE.test(email))throw new ValidationError('Indica un correo válido.');
    if(!this.recoveryStatus().ready)throw new AppError('La recuperación por correo aún no está habilitada. Pide al administrador un enlace temporal.',503,'RECOVERY_UNAVAILABLE');
    const grant=await this.uow.run(async()=>{
      const key=createHmac('sha256',env.jwtSecret).update('recovery:'+email).digest('hex');
      const allowed=await this.security.claimPasswordReset(key,Date.now()),user=await this.users.findByEmail(email);
      if(!allowed||!user?.active)return null;
      return {user,...await this.issueRecovery(user,null)};
    });
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,250-(Date.now()-started))));
    if(grant)this.deliverRecovery({email:grant.user.email,name:grant.user.fullName,url:grant.url,kind:'reset'},grant.tokenHash);
    return {message:'Si existe una cuenta activa con ese correo, enviaremos un enlace para recuperar el acceso. Revisa también spam. Si no llega, contacta al administrador.'};
  }
  async resetPassword(token:string,password:string,confirmation:string):Promise<{ok:true}>{
    if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new ValidationError('Este enlace no es válido o ya venció. Solicita uno nuevo.','RESET_INVALID');
    if(password!==confirmation)throw new ValidationError('Las contraseñas no coinciden.');validatePassword(password);
    const hash=await bcrypt.hash(password,10);
    const user=await this.uow.run(async()=>{
      const grant=await this.security.consumePasswordReset(digest(token),Date.now());
      const view=grant?await this.users.findById(grant.userId):null,stored=view?await this.users.findByEmail(view.email):null;
      if(!grant||!stored?.active||!equal(grant.stamp,this.recoveryStamp(stored)))throw new ValidationError('Este enlace no es válido o ya venció. Solicita uno nuevo.','RESET_INVALID');
      if(await bcrypt.compare(password,stored.passwordHash))throw new ValidationError('Elige una contraseña diferente de la actual.');
      await this.users.update(stored.id,{passwordHash:hash});return stored;
    });
    if(this.recoveryMailer.status().ready)this.deliverRecovery({email:user.email,name:user.fullName,kind:'changed'});
    return {ok:true};
  }
  async administratorReset(adminId:number,userId:number,password:string){
    if(!Number.isSafeInteger(userId)||userId<1)throw new ValidationError('Jugador inválido.');
    const admin=await this.users.findById(adminId),stored=admin?await this.users.findByEmail(admin.email):null;
    if(!stored?.active||stored.role!=='admin')throw new ForbiddenError();
    if(!password||!await bcrypt.compare(password,stored.passwordHash))throw new ValidationError('Confirma tu contraseña de administrador.');
    return this.uow.run(async()=>{
      const view=await this.users.findById(userId),target=view?await this.users.findByEmail(view.email):null;
      if(!target?.active||target.role!=='player')throw new ValidationError('Solo se puede recuperar el acceso de jugadores activos. Las solicitudes pendientes requieren aval.');
      const {url,expiresAt}=await this.issueRecovery(target,adminId);return {url,expiresAt};
    });
  }

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
      let session=typeof payload.jti==='string'?(await this.security.session(payload.jti)):null;
      const userId=Number(payload.sub);if(!session||session.userId!==userId||session.expiresAt<=Date.now())throw new Error();
      const view=(await this.me(userId));
      if(!view.user.active||view.user.role!==payload.role||!equal(session.stamp,(await this.stamp(view.user))))throw new Error();
      if(view.user.role!=='admin'&&session.lastActivityAt+env.playerIdleTimeoutMs<=Date.now()) {
        if(await this.security.expireIdleSession(payload.jti!,Date.now()-env.playerIdleTimeoutMs))throw this.idleError();
        session=await this.security.session(payload.jti!);
        if(!session)throw new Error();
      }
      return {...view,session:this.sessionStatus(payload.jti!,view.user,session.lastActivityAt)};
    }catch(error){if(error instanceof UnauthorizedError)throw error;throw new UnauthorizedError('Sesión inválida, expirada o revocada');}
  }
  private idleError(){return new UnauthorizedError('Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.','SESSION_IDLE_EXPIRED');}
  private sessionStatus(id:string,user:User,lastActivityAt:number):SessionStatus {
    return {sessionKey:digest(id),serverNow:Date.now(),idleTimeoutMs:user.role==='admin'?null:env.playerIdleTimeoutMs,idleExpiresAt:user.role==='admin'?null:lastActivityAt+env.playerIdleTimeoutMs};
  }
  async activity(token:string):Promise<SessionStatus> {
    const view=await this.verifySession(token);
    if(view.user.role==='admin')return view.session!;
    const id=(jwt.decode(token) as jwt.JwtPayload).jti!,now=Date.now();
    if(!await this.security.touchSession(id,now,env.playerIdleTimeoutMs))throw this.idleError();
    const session=await this.security.session(id);
    if(!session)throw new UnauthorizedError('Sesión revocada');
    return this.sessionStatus(id,view.user,session.lastActivityAt);
  }
  async logout(token:string,sessionKey?:string){
    try {
      const payload=jwt.verify(token,env.jwtSecret,{algorithms:['HS256'],issuer:'futapp',audience:'futapp-client',ignoreExpiration:true}) as jwt.JwtPayload;
      if(sessionKey&&(!payload.jti||!equal(sessionKey,digest(payload.jti))))return false;
      if(payload.jti)await this.security.revokeSession(payload.jti);
    }catch{}
    return true;
  }
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
    return { token, user: safeUser, player,session:this.sessionStatus(id,safeUser,(await this.security.session(id))!.lastActivityAt) };
  }
}
