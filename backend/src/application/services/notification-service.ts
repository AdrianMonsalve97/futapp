import { createHash } from 'node:crypto';
import type { NotificationRepository } from '../ports/out/notification.repository';
import type { NotificationTransport } from '../ports/out/notification.transport';
import type { MatchRepository } from '../ports/out/match.repository';
import type { UserRepository } from '../ports/out/user.repository';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { SettingsRepository } from '../ports/out/settings.repository';
import type { QrPaymentRepository } from '../ports/out/qr-payment.repository';
import type { UnitOfWork } from '../ports/out/unit-of-work';
import type { TournamentRepository } from '../ports/out/tournament.repository';
import type { Match } from '../../domain/entities';
import type { PaymentReceipt } from '../../domain/payments';
import { NotificationDeliveryError, GROUP_JID } from '../../domain/notifications';
import type { NotificationSettings, NotificationPreferences, NotificationKind, NotificationMessage, NotificationJob, NotificationEvents, NotificationChannel, NotificationRecipient } from '../../domain/notifications';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { asyncFilter } from "./shared";

const phone=/^\+[1-9]\d{7,14}$/;
const email=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
// Existing match dates represent Colombia's local clock; explicit offset prevents host timezone drift on Render.
export const kickoffTime=(match: Match)=>Date.parse(match.kickOff+'-05:00');
export const matchRevision=(match: Match)=>createHash('sha256').update(JSON.stringify([match.opponent,match.competition,match.kickOff,match.venue,match.status,match.format,match.minutes,match.tournamentId])).digest('hex').slice(0,20);

export class NotificationService implements NotificationEvents {
  private busy=false;
  constructor(private readonly repository: NotificationRepository, private readonly transport: NotificationTransport,
    private readonly matches: MatchRepository, private readonly users: UserRepository, private readonly players: PlayerRepository,
    private readonly team: SettingsRepository, private readonly receipts: QrPaymentRepository, private readonly uow: UnitOfWork,
    private readonly clock: ()=>number=Date.now, private readonly tournaments?: TournamentRepository) {}
  private async enrolled(match: Match, userId: number): Promise<boolean> {
    if (!match.tournamentId) return true;
    const player = (await this.players.findByUserId(userId));
    return !!player && !!(await this.tournaments?.hasPlayer(match.tournamentId, player.id));
  }
  async view() {
    const settings=(await this.repository.settings());
    return {settings,providers:{whatsapp:this.transport.status('whatsapp',settings.whatsappProvider),email:this.transport.status('email')},
      history:(await this.repository.history()),recipients:(await this.repository.recipients()).length};
  }
  async configure(input: NotificationSettings) {
    const draft={...(await this.repository.settings()),...input};
    const config={...draft,matchGroupId:draft.matchGroupId.trim(),matchGroupName:draft.matchGroupName.trim(),adminWhatsapp:input.adminWhatsapp.trim(),adminEmail:input.adminEmail.trim(),publicBaseUrl:input.publicBaseUrl.trim().replace(/\/$/,''),
      matchTemplate:input.matchTemplate.trim(),paymentTemplate:input.paymentTemplate.trim(),templateLanguage:input.templateLanguage.trim()};
    if (config.adminWhatsapp && !phone.test(config.adminWhatsapp)) throw new ValidationError('WhatsApp debe incluir el indicativo, por ejemplo +573001234567');
    if (config.adminEmail && !email.test(config.adminEmail)) throw new ValidationError('Correo de alertas inválido');
    if(config.matchGroupId && !GROUP_JID.test(config.matchGroupId))throw new ValidationError('Selecciona un grupo de WhatsApp válido');
    if(config.whatsappEnabled && config.matchDestination==='group' && (config.whatsappProvider!=='evolution' || !config.matchGroupId))throw new ValidationError('Para avisar al grupo elige Evolution, vincula el bot y selecciona el grupo');
    if (config.publicBaseUrl) {
      let url:URL; try { url=new URL(config.publicBaseUrl); } catch { throw new ValidationError('URL pública inválida'); }
      if (url.username || url.password || url.search || url.hash || url.pathname!=='/' ||
        (url.protocol!=='https:' && !(process.env.NODE_ENV!=='production' && url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) throw new ValidationError('La URL debe ser el origen HTTPS de FutApp, sin rutas ni credenciales');
    }
    if ((config.whatsappEnabled || config.emailEnabled) && !config.publicBaseUrl) throw new ValidationError('Indica la URL pública para abrir el partido o comprobante');
    if (config.whatsappEnabled && !this.transport.status('whatsapp',config.whatsappProvider).ready) throw new ValidationError('Configura primero las credenciales del proveedor de WhatsApp en el servidor');
    if (config.emailEnabled && !this.transport.status('email').ready) throw new ValidationError('Configura primero las credenciales SMTP en el servidor');
    if (config.paymentAlerts && ((config.whatsappEnabled && !config.adminWhatsapp) || (config.emailEnabled && !config.adminEmail))) throw new ValidationError('Indica tu destinatario para las alertas de comprobantes o desactiva esa alerta');
    if (!/^[a-z0-9_]{1,100}$/.test(config.matchTemplate) || !/^[a-z0-9_]{1,100}$/.test(config.paymentTemplate) || !/^[a-z]{2,3}(_[A-Z]{2})?$/.test(config.templateLanguage)) throw new ValidationError('Nombre de plantilla o idioma inválidos');
    return (await this.uow.run(async ()=>{(await this.repository.setSettings(config));return (await this.view());}));
  }
  async configureVerified(input:NotificationSettings) {
    input={...(await this.repository.settings()),...input};
    if(input.whatsappEnabled && input.matchDestination==='group') {
      if(input.whatsappProvider!=='evolution')throw new ValidationError('Selecciona Evolution para el grupo existente');
      const groups=await this.groups();
      const group=groups.find(g=>g.id===input.matchGroupId);
      if(!group)throw new ValidationError('El bot debe pertenecer al grupo seleccionado');
      input={...input,matchGroupName:group.name};
    }
    return (await this.configure(input));
  }
  async groups() {
    if(!this.transport.groups)throw new ValidationError('La conexión a grupos no está disponible');
    try{return await this.transport.groups();}catch(error){throw new ValidationError(error instanceof NotificationDeliveryError?error.message:'No se pudieron consultar los grupos del bot');}
  }
  async connection() {
    if(!this.transport.connection)throw new ValidationError('La conexión vinculada no está disponible');
    try{return await this.transport.connection();}catch(error){throw new ValidationError(error instanceof NotificationDeliveryError?error.message:'No se pudo comprobar la conexión del bot');}
  }
  async connect() {
    if(!this.transport.connect)throw new ValidationError('La conexión vinculada no está disponible');
    try{return await this.transport.connect();}catch(error){throw new ValidationError(error instanceof NotificationDeliveryError?error.message:'No se pudo generar el QR de conexión');}
  }
  async preferences(userId: number) { if (!(await this.users.findById(userId))) throw new NotFoundError('Usuario no encontrado'); return (await this.repository.preferences(userId)); }
  async savePreferences(userId: number, input: NotificationPreferences) {
    (await this.preferences(userId)); const prefs={...input,whatsappNumber:input.whatsappNumber.trim()};
    if ((prefs.whatsapp || prefs.whatsappNumber) && !phone.test(prefs.whatsappNumber)) throw new ValidationError('Indica tu WhatsApp completo con + e indicativo');
    return (await this.uow.run(async ()=>{(await this.repository.cancelUser(userId,this.clock()));(await this.repository.setPreferences(userId,prefs));return prefs;}));
  }
  private async enqueue(kind: NotificationKind, event: string, message: NotificationMessage, recipient: string, channel: NotificationChannel,
    userId: number|null, matchId: number|null, receiptId: number|null, now=this.clock()) {
    return (await this.repository.enqueue({kind,eventKey:`${event}:${channel}:${userId??recipient}`,message,recipient,channel,userId,matchId,receiptId,nextAttemptAt:now},now));
  }
  private async forPlayer(recipient: NotificationRecipient, kind: NotificationKind, event: string, message: NotificationMessage, matchId: number|null, receiptId: number|null) {
    const config=(await this.repository.settings()); let count=0;
    if (config.whatsappEnabled && recipient.whatsapp) count+=(await this.enqueue(kind,event,message,recipient.whatsappNumber,'whatsapp',recipient.userId,matchId,receiptId));
    if (config.emailEnabled && recipient.email) count+=(await this.enqueue(kind,event,message,recipient.emailAddress,'email',recipient.userId,matchId,receiptId));
    return count;
  }
  private async matchMessage(match: Match, title: string): Promise<NotificationMessage> {
    const when=new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'full',timeStyle:'short'}).format(kickoffTime(match));
    return {club:(await this.team.get()).teamName,title,detail:`${match.opponent} · ${match.competition || 'Partido del equipo'} · ${when} (Colombia) · ${match.venue || 'Cancha por confirmar'} · F${match.format} · ${match.minutes} minutos · ${match.status}. Revisa el partido y confirma tu asistencia.`,
      path:`/jugador/partidos/${match.id}`,matchRevision:matchRevision(match)};
  }
  private async announce(match: Match, kind: NotificationKind, title: string) {
    const event=`${kind}:${match.id}:${(await this.repository.revisionKey(match.id,matchRevision(match)))}`; let count=0;
    const config=(await this.repository.settings());
    if(config.matchDestination==='group') {
      if(config.whatsappEnabled && config.whatsappProvider==='evolution' && config.matchGroupId)count+=(await this.enqueue(kind,event,{...(await this.matchMessage(match,title)),audience:'group'},config.matchGroupId,'whatsapp',null,match.id,null));
      return count;
    }
    for (const recipient of (await asyncFilter((await this.repository.recipients()),async p=>p.matchAlerts && (await this.enrolled(match,p.userId))))) count+=(await this.forPlayer(recipient,kind,event,(await this.matchMessage(match,title)),match.id,null));
    return count;
  }
  async matchChanged(match: Match, previous?: Match) {
    if (previous && matchRevision(previous)===matchRevision(match)) return;
    (await this.repository.cancelMatch(match.id,this.clock()));
    (await this.repository.revisionKey(match.id,matchRevision(match)));
    if (!(await this.repository.settings()).matchAnnouncements) return;
    if (match.status==='jugado' || kickoffTime(match)<=this.clock()) return;
    (await this.announce(match,'match',match.status==='cancelado'?'Partido cancelado':match.status==='pospuesto'?'Partido pospuesto':previous?'Cambio en el partido':'Nuevo partido programado'));
  }
  async notifyMatch(id: number) {
    const match=(await this.matches.findById(id));
    if (!match) throw new NotFoundError('Partido no encontrado');
    if (match.status!=='programado' || kickoffTime(match)<=this.clock()) throw new ValidationError('Solo se notifican partidos futuros programados');
    if (!(await this.repository.settings()).matchAnnouncements) throw new ValidationError('Activa los avisos de partidos en Notificaciones');
    return (await this.uow.run(async ()=>({queued:(await this.announce(match,'match','Partido programado')),message:(await this.repository.settings()).matchDestination==='group'?'El aviso va al grupo deportivo configurado. Los avisos existentes no se duplican.':'Se agregaron avisos para jugadores que activaron este canal. Los avisos existentes no se duplican.'})));
  }
  async receiptUploaded(receipt: PaymentReceipt) {
    const config=(await this.repository.settings()); if (!config.paymentAlerts) return;
    const player=(await this.players.findById(receipt.playerId)), user=player?(await this.users.findById(player.userId)):null;
    const concept=receipt.kind==='inscription'?'inscripción':receipt.kind==='referee'?'arbitraje':'uniforme';
    const message: NotificationMessage={club:(await this.team.get()).teamName,title:'Nuevo comprobante pendiente de revisión',
      detail:`${user?.fullName || 'Jugador'} subió el soporte #${receipt.id} de ${concept} por ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:2}).format(receipt.amount)}. Referencia: ${receipt.reference}. Esto confirma la carga del soporte; el abono necesita tu aprobación.`,path:'/admin/pagos-qr',audience:'admin'};
    if (config.whatsappEnabled && config.adminWhatsapp) (await this.enqueue('receipt_uploaded',`receipt_uploaded:${receipt.id}`,message,config.adminWhatsapp,'whatsapp',null,null,receipt.id));
    if (config.emailEnabled && config.adminEmail) (await this.enqueue('receipt_uploaded',`receipt_uploaded:${receipt.id}`,message,config.adminEmail,'email',null,null,receipt.id));
  }
  async receiptReviewed(receipt: PaymentReceipt) {
    const config=(await this.repository.settings());if(!config.paymentAlerts)return;
    const player=(await this.players.findById(receipt.playerId)),user=player?(await this.users.findById(player.userId)):null;
    const message:NotificationMessage={
      club:(await this.team.get()).teamName,title:`Comprobante ${receipt.status}`,
      detail:`El soporte #${receipt.id} de ${user?.fullName || 'Jugador'} fue ${receipt.status}. ${receipt.status==='aprobado'?'El abono ya está registrado.':'No se registró un abono.'}`,
      path:'/admin/pagos-qr',audience:'admin'};
    const event=`receipt_reviewed:${receipt.id}:${receipt.status}`;
    if(config.whatsappEnabled&&config.adminWhatsapp)(await this.enqueue('receipt_reviewed',event,message,config.adminWhatsapp,'whatsapp',null,null,receipt.id));
    if(config.emailEnabled&&config.adminEmail)(await this.enqueue('receipt_reviewed',event,message,config.adminEmail,'email',null,null,receipt.id));
  }
  async test(channel: NotificationChannel) {
    const config=(await this.repository.settings());
    const recipient=channel==='whatsapp'?config.adminWhatsapp:config.adminEmail;
    if (!recipient || !(channel==='whatsapp'?config.whatsappEnabled:config.emailEnabled)) throw new ValidationError('Activa el canal y configura tu destinatario antes de probar');
    return {queued:(await this.enqueue('test',`test:${Math.floor(this.clock()/60000)}`,{club:(await this.team.get()).teamName,title:'Prueba privada del bot de FutApp',detail:'Las alertas administrativas están dirigidas únicamente a tu contacto privado.',path:'/admin/notificaciones',audience:'admin'},recipient,channel,null,null,null))};
  }
  async testGroup() {
    const config=(await this.repository.settings());
    if(!config.whatsappEnabled||config.whatsappProvider!=='evolution'||config.matchDestination!=='group'||!config.matchGroupId)throw new ValidationError('Conecta y guarda el grupo deportivo antes de probar');
    return {queued:(await this.enqueue('test',`test_group:${Math.floor(this.clock()/60000)}`,{club:(await this.team.get()).teamName,title:'Bot deportivo conectado',detail:'En este grupo recibirán avisos de partidos, cambios de horario y recordatorios. La asistencia se confirma en FutApp.',path:'/jugador/partidos',audience:'group'},config.matchGroupId,'whatsapp',null,null,null))};
  }
  async retry(id: number) {
    if (!(await this.repository.find(id))) throw new NotFoundError('Aviso no encontrado');
    if (!(await this.repository.retry(id,this.clock()))) throw new ValidationError('Solo se reintentan avisos fallidos, bloqueados o inciertos');
    return {ok:true};
  }
  private async eligible(job: NotificationJob, config: NotificationSettings): Promise<boolean> {
    const group=job.message.audience==='group';
    if (job.kind==='test') return group?config.matchDestination==='group'&&config.whatsappProvider==='evolution'&&job.recipient===config.matchGroupId&&job.receiptId===null:job.userId===null&&job.recipient===(job.channel==='whatsapp'?config.adminWhatsapp:config.adminEmail);
    if (job.kind==='receipt_uploaded'||job.kind==='receipt_reviewed') {
      const receipt=(await this.receipts.find(job.receiptId!));
      return !group&&job.userId===null&&config.paymentAlerts && !!receipt && (job.kind==='receipt_uploaded'?receipt.status==='pendiente':receipt.status!=='pendiente') && job.recipient===(job.channel==='whatsapp'?config.adminWhatsapp:config.adminEmail);
    }
    const match=job.matchId?(await this.matches.findById(job.matchId)):null;
    if(group) {
      if(config.matchDestination!=='group'||config.whatsappProvider!=='evolution'||job.channel!=='whatsapp'||job.userId!==null||job.receiptId!==null||job.recipient!==config.matchGroupId)return false;
      return (await this.matchEligible(job,match,config));
    }
    if(config.matchDestination==='group')return false;
    const user=job.userId?(await this.users.findById(job.userId)):null;
    if (!user?.active || user.role!=='player') return false;
    const prefs=(await this.repository.preferences(user.id));
    if (job.channel==='whatsapp' ? !prefs.whatsapp || job.recipient!==prefs.whatsappNumber : !prefs.email || job.recipient!==user.email) return false;
    if (!prefs.matchAlerts) return false;
    if (match && !(await this.enrolled(match,user.id))) return false;
    return (await this.matchEligible(job,match,config));
  }
  private matchEligible(job:NotificationJob,match:Match|null,config:NotificationSettings) {
    if (!match || kickoffTime(match)<=this.clock() || matchRevision(match)!==job.message.matchRevision) return false;
    if (job.kind==='match') return config.matchAnnouncements && match.status!=='jugado';
    return match.status==='programado' && (job.kind==='reminder_24h'?config.reminder24h:config.reminder2h);
  }
  async tick() {
    if (this.busy) return; this.busy=true;
    try {
      const now=this.clock(),config=(await this.repository.settings());
      (await this.uow.run(async ()=>{
                (await this.repository.recoverInterrupted(now));
                for (const match of (await this.matches.list()).filter(m=>m.status==='programado')) {
                  const hours=(kickoffTime(match)-now)/3600000;
                  if (hours<=0) continue;
                  // A late restart sends only the nearest reminder, never both together.
                  if (config.reminder2h && hours<=2) (await this.announce(match,'reminder_2h','Tu partido comienza en menos de 2 horas'));
                  else if (config.reminder24h && hours<=24 && hours>2) (await this.announce(match,'reminder_24h','Tu partido es en las próximas 24 horas'));
                }
              }));
      for (let i=0;i<20;i++) {
        let job=(await this.repository.claim(this.clock())); if (!job) break;
        const current=(await this.repository.settings());
        if (!(await this.eligible(job,current))) {(await this.repository.finish(job.id,'cancelado',this.clock(),'El aviso ya no corresponde a las preferencias o al estado actual'));continue;}
        if (!(job.channel==='whatsapp'?current.whatsappEnabled:current.emailEnabled) || !this.transport.status(job.channel,current.whatsappProvider).ready || !current.publicBaseUrl) {
          (await this.repository.finish(job.id,'bloqueado',this.clock(),'Canal desactivado o proveedor sin configurar',null,this.clock()+60000));continue;
        }
        job=(await this.repository.beginAttempt(job.id,this.clock()));
        try {
          const id=await this.transport.send(job,current);
          (await this.repository.finish(job.id,'aceptado',this.clock(),null,id));
        } catch(error) {
          const delivery=error instanceof NotificationDeliveryError?error:new NotificationDeliveryError('Respuesta del proveedor no confirmada','uncertain');
          const status=delivery.outcome==='blocked'?'bloqueado':delivery.outcome==='retry' && job.attempts<3?'pendiente':delivery.outcome==='uncertain'?'incierto':'fallido';
          (await this.repository.finish(job.id,status,this.clock(),delivery.message,null,this.clock()+60000*2**Math.min(job.attempts,4)));
        }
      }
    } finally {this.busy=false;}
  }
  start() {
    const run=()=>{void this.tick().catch(()=>console.error('El bot de notificaciones no pudo procesar la cola; revisa su configuración.'));};
    run(); const timer=setInterval(run,30000);timer.unref();return ()=>clearInterval(timer);
  }
}
