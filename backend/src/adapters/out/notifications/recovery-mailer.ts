import type {RecoveryMailer,RecoveryMail} from '../../../application/ports/out/recovery-mailer';

/** HTTPS API: the free Render service cannot reach common SMTP ports. */
export class BrevoRecoveryMailer implements RecoveryMailer {
  constructor(private readonly config:NodeJS.ProcessEnv=process.env,private readonly request:typeof fetch=fetch){}
  status(){
    const missing=['BREVO_API_KEY','MAIL_FROM'].filter(key=>!this.config[key]?.trim());
    if(this.config.MAIL_FROM&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.config.MAIL_FROM))missing.push('MAIL_FROM válido');
    return {ready:missing.length===0,missing};
  }
  async send(message:RecoveryMail){
    if(!this.status().ready)throw new Error('Correo de recuperación no configurado');
    const text=message.kind==='reset'?`Hola ${message.name}.\n\nSolicitaste recuperar tu acceso a FutApp. Abre este enlace para elegir una contraseña nueva:\n\n${message.url}\n\nVence en 15 minutos y funciona una sola vez. Si no lo solicitaste, ignora este correo. Tu contraseña actual sigue funcionando.`:`Hola ${message.name}.\n\nTu contraseña de FutApp fue restablecida. Las sesiones anteriores se cerraron. Si no realizaste este cambio, contacta al administrador del equipo.`;
    let response:Response;
    try{response=await this.request('https://api.brevo.com/v3/smtp/email',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'api-key':this.config.BREVO_API_KEY!,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{email:this.config.MAIL_FROM,name:this.config.MAIL_FROM_NAME||'FutApp'},to:[{email:message.email,name:message.name}],subject:message.kind==='reset'?'Recupera tu acceso a FutApp':'Tu contraseña de FutApp cambió',textContent:text})});}catch{throw new Error('El servicio de correo no confirmó el envío');}
    if(!response.ok)throw new Error(`El servicio de correo rechazó el envío (${response.status})`);
    await response.arrayBuffer();
  }
}
