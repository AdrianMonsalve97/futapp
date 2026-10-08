import QRCode from 'qrcode';
import { NotificationDeliveryError, GROUP_JID } from '../../../domain/notifications';
import type { NotificationJob, NotificationSettings, WhatsAppGroup } from '../../../domain/notifications';

export class EvolutionClient {
  constructor(private readonly config: NodeJS.ProcessEnv=process.env,private readonly fetcher: typeof fetch=fetch) {}
  status() {
    const missing=['EVOLUTION_API_URL','EVOLUTION_API_KEY','EVOLUTION_INSTANCE'].filter(key=>!this.config[key]?.trim());
    if (this.config.EVOLUTION_API_URL) try {
      const url=new URL(this.config.EVOLUTION_API_URL);
      if (url.username || url.password || url.search || url.hash || (url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) missing.push('EVOLUTION_API_URL HTTPS válida (HTTP solo local)');
    } catch {missing.push('EVOLUTION_API_URL válida');}
    if(this.config.EVOLUTION_INSTANCE && !/^[a-zA-Z0-9_-]{1,100}$/.test(this.config.EVOLUTION_INSTANCE))missing.push('EVOLUTION_INSTANCE válida');
    return {ready:missing.length===0,missing};
  }
  private async call(path: string,method='GET',body?: unknown): Promise<any> {
    if(!this.status().ready)throw new NotificationDeliveryError('Configura Evolution API en el servidor para conectar el grupo','blocked');
    let response:Response;
    try{response=await this.fetcher(`${this.config.EVOLUTION_API_URL!.replace(/\/$/,'')}${path}/${encodeURIComponent(this.config.EVOLUTION_INSTANCE!)}${path==='/group/fetchAllGroups'?'?getParticipants=false':''}`,{
      method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:this.config.EVOLUTION_API_KEY!,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),
    });}catch{throw new NotificationDeliveryError('Evolution no confirmó la respuesta; verifica la conexión antes de reenviar',method==='POST'?'uncertain':'blocked');}
    if(!response.ok)throw new NotificationDeliveryError(`Evolution respondió HTTP ${response.status}`,response.status===429?'retry':response.status>=500&&method==='POST'?'uncertain':'failed');
    try{return await response.json();}catch{throw new NotificationDeliveryError('Evolution devolvió una respuesta sin confirmar',method==='POST'?'uncertain':'blocked');}
  }
  async connection(): Promise<{state:'connected'|'disconnected'}> {
    const data=await this.call('/instance/connectionState');return {state:data.instance?.state==='open'?'connected':'disconnected'};
  }
  async connect(): Promise<{qr:string|null;state:'connected'|'scan_required'}> {
    if((await this.connection()).state==='connected')return {state:'connected',qr:null};
    const data=await this.call('/instance/connect');
    // Render only a QR made from the protocol's pairing code, never arbitrary images or provider fields.
    if(typeof data.code!=='string' || !data.code.length || data.code.length>4096)throw new NotificationDeliveryError('No llegó un QR válido. Crea la instancia de WhatsApp en Evolution y vuelve a intentar.','blocked');
    return {state:'scan_required',qr:await QRCode.toDataURL(data.code,{width:360,margin:2,errorCorrectionLevel:'M'})};
  }
  async groups(): Promise<WhatsAppGroup[]> {
    if((await this.connection()).state!=='connected')throw new NotificationDeliveryError('Vincula primero el teléfono del bot para consultar sus grupos','blocked');
    const data=await this.call('/group/fetchAllGroups');
    if(!Array.isArray(data))throw new NotificationDeliveryError('Evolution no devolvió una lista válida de grupos','blocked');
    return data.filter(g=>typeof g.id==='string' && GROUP_JID.test(g.id) && typeof g.subject==='string')
      .map(g=>({id:g.id,name:g.subject.slice(0,200)}));
  }
  async send(job:NotificationJob,settings:NotificationSettings): Promise<string> {
    const group=GROUP_JID.test(job.recipient);
    if(group) {
      const sports=['match','reminder_24h','reminder_2h'].includes(job.kind) && job.matchId!==null && job.message.path===`/jugador/partidos/${job.matchId}`;
      const test=job.kind==='test' && job.message.audience==='group' && job.message.path==='/jugador/partidos';
      if(job.receiptId!==null || job.userId!==null || job.message.audience!=='group' || (!sports&&!test) || settings.matchDestination!=='group' || job.recipient!==settings.matchGroupId)
        throw new NotificationDeliveryError('El grupo solo admite avisos deportivos; el destino privado es obligatorio para administración','failed');
    } else if(!/^\+[1-9]\d{7,14}$/.test(job.recipient)) throw new NotificationDeliveryError('Destino de WhatsApp inválido','failed');
    if(group) {
      if(!(await this.groups()).some(g=>g.id===job.recipient))throw new NotificationDeliveryError('El bot ya no pertenece al grupo configurado','blocked');
    } else if((await this.connection()).state!=='connected')throw new NotificationDeliveryError('El teléfono del bot está desconectado; vuelve a vincularlo','blocked');
    const data=await this.call('/message/sendText','POST',{number:group?job.recipient:job.recipient.slice(1),text:`${job.message.club}\n${job.message.title}\n\n${job.message.detail}\n\n${settings.publicBaseUrl}${job.message.path}`,linkPreview:false});
    if(typeof data.key?.id==='string'&&data.key.id.length)return data.key.id;
    throw new NotificationDeliveryError('Evolution no confirmó el identificador del envío; comprueba el proveedor','uncertain');
  }
}
