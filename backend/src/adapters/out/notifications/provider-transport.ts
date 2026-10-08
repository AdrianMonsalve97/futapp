import nodemailer from 'nodemailer';
import type { NotificationTransport } from '../../../application/ports/out/notification.transport';
import { NotificationDeliveryError, GROUP_JID } from '../../../domain/notifications';
import type { NotificationChannel, NotificationJob, NotificationSettings } from '../../../domain/notifications';
import { EvolutionClient } from './evolution-client';

export class ProviderNotificationTransport implements NotificationTransport {
  constructor(private readonly config: NodeJS.ProcessEnv = process.env, private readonly fetcher: typeof fetch = fetch) {}
  status(channel: NotificationChannel, provider: 'meta'|'evolution'='meta') {
    if(channel==='whatsapp'&&provider==='evolution')return new EvolutionClient(this.config,this.fetcher).status();
    const required=channel==='whatsapp'?['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_API_VERSION']:['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','SMTP_FROM'];
    const missing=required.filter(key=>!this.config[key]?.trim());
    if (channel==='whatsapp') {
      if (this.config.WHATSAPP_API_VERSION && !/^v\d+\.\d+$/.test(this.config.WHATSAPP_API_VERSION)) missing.push('WHATSAPP_API_VERSION válida');
      if (this.config.WHATSAPP_PHONE_NUMBER_ID && !/^\d+$/.test(this.config.WHATSAPP_PHONE_NUMBER_ID)) missing.push('WHATSAPP_PHONE_NUMBER_ID válido');
    } else if (this.config.SMTP_PORT && ![465,587,2525].includes(Number(this.config.SMTP_PORT))) missing.push('SMTP_PORT: 465, 587 o 2525');
    return {ready:missing.length===0,missing};
  }
  groups() {return new EvolutionClient(this.config,this.fetcher).groups();}
  connection() {return new EvolutionClient(this.config,this.fetcher).connection();}
  connect() {return new EvolutionClient(this.config,this.fetcher).connect();}
  async send(job: NotificationJob, settings: NotificationSettings): Promise<string> {
    if(['receipt_uploaded','receipt_reviewed'].includes(job.kind) && (job.userId!==null || job.message.audience==='group' || job.recipient!==(job.channel==='whatsapp'?settings.adminWhatsapp:settings.adminEmail)))
      throw new NotificationDeliveryError('Los avisos administrativos solo se envían al contacto privado configurado','failed');
    if (!this.status(job.channel,settings.whatsappProvider).ready) throw new NotificationDeliveryError('Faltan credenciales del proveedor en el servidor','blocked');
    if(job.channel==='whatsapp'&&settings.whatsappProvider==='evolution')return new EvolutionClient(this.config,this.fetcher).send(job,settings);
    if(job.channel==='whatsapp' && GROUP_JID.test(job.recipient))throw new NotificationDeliveryError('Este adaptador de Meta usa destinatarios individuales; configura Evolution para el grupo existente','failed');
    const url=settings.publicBaseUrl+job.message.path;
    if (job.channel==='whatsapp') {
      const template=['receipt_uploaded','receipt_reviewed'].includes(job.kind)?settings.paymentTemplate:settings.matchTemplate;
      const texts=[job.message.club,job.message.title,job.message.detail,url].map(t=>t.replace(/\s+/g,' ').trim().slice(0,900));
      let response: Response;
      try {
        response=await this.fetcher(`https://graph.facebook.com/${this.config.WHATSAPP_API_VERSION}/${this.config.WHATSAPP_PHONE_NUMBER_ID}/messages`,{
          method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
          headers:{Authorization:`Bearer ${this.config.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},
          body:JSON.stringify({messaging_product:'whatsapp',to:job.recipient.slice(1),type:'template',template:{name:template,language:{code:settings.templateLanguage},
            components:[{type:'body',parameters:texts.map(text=>({type:'text',text}))}]}}),
        });
      } catch { throw new NotificationDeliveryError('No se pudo confirmar la respuesta de WhatsApp; comprueba el proveedor antes de reenviar','uncertain'); }
      if (!response.ok) {
        let code=''; try { const body=await response.json() as any; if (Number.isSafeInteger(body.error?.code)) code=` (código ${body.error.code})`; } catch {}
        throw new NotificationDeliveryError(`WhatsApp rechazó el envío: HTTP ${response.status}${code}`,response.status===429?'retry':response.status>=500?'uncertain':'failed');
      }
      try {
        const data=await response.json() as any; const id=data.messages?.[0]?.id;
        if (typeof id==='string' && id.length) return id;
      } catch {}
      throw new NotificationDeliveryError('WhatsApp respondió sin identificador de mensaje; comprueba el proveedor','uncertain');
    }
    const port=Number(this.config.SMTP_PORT);
    const transport=nodemailer.createTransport({host:this.config.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,
      auth:{user:this.config.SMTP_USER,pass:this.config.SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
      disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false});
    try {
      const result=await transport.sendMail({from:this.config.SMTP_FROM,to:job.recipient,subject:`${job.message.club} · ${job.message.title}`,
        text:`${job.message.title}\n\n${job.message.detail}\n\n${url}\n\nAdministra tus avisos dentro de FutApp.`,
        messageId:`<futapp-notification-${job.id}@${this.config.SMTP_FROM?.split('@').pop()?.replace(/[^a-zA-Z0-9.-]/g,'') || 'futapp.local'}>`});
      if (!result.accepted?.length) throw new NotificationDeliveryError('El servidor de correo no aceptó al destinatario','failed');
      return result.messageId;
    } catch (error) {
      if (error instanceof NotificationDeliveryError) throw error;
      const code=(error as {responseCode?:number;code?:string});
      throw new NotificationDeliveryError('El servidor de correo no confirmó el envío',code.responseCode?code.responseCode<500?'retry':'failed':code.code==='EAUTH'?'failed':'uncertain');
    } finally { transport.close(); }
  }
}
