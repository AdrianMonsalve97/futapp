import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../templates/PageHeader';
import { useFetch } from '../../hooks/useFetch';
import { api, errorMessage } from '../../services/api';
import type { NotificationSettings, NotificationsView, NotificationJob } from '../../types/notifications';
import { WhatsAppGroupConnection } from '../../organisms/WhatsAppGroupConnection';

const labels: Record<NotificationJob['status'],string>={pendiente:'En cola',enviando:'Enviando',aceptado:'Aceptado por el proveedor',bloqueado:'Necesita configuración',fallido:'Falló',incierto:'Envío sin confirmar',cancelado:'Cancelado'};
function SettingsForm({view,onSaved}:{view:NotificationsView;onSaved:()=>void}) {
  const [form,setForm]=useState<NotificationSettings>(view.settings),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const fields: {key:keyof Pick<NotificationSettings,'adminWhatsapp'|'adminEmail'|'publicBaseUrl'|'matchTemplate'|'paymentTemplate'|'templateLanguage'>;label:string;placeholder:string}[]=[
    {key:'adminWhatsapp',label:'Tu WhatsApp privado para administración',placeholder:'+573001234567'},
    {key:'adminEmail',label:'Tu correo privado para administración',placeholder:'administrador@equipo.com'},
    {key:'publicBaseUrl',label:'URL pública de FutApp',placeholder:window.location.origin},
    {key:'matchTemplate',label:'Plantilla aprobada para partidos',placeholder:'futapp_partido'},
    {key:'paymentTemplate',label:'Plantilla aprobada para pagos',placeholder:'futapp_pago'},
    {key:'templateLanguage',label:'Idioma de las plantillas',placeholder:'es'},
  ];
  const toggles: {key:keyof Pick<NotificationSettings,'whatsappEnabled'|'emailEnabled'|'matchAnnouncements'|'reminder24h'|'reminder2h'|'paymentAlerts'>;label:string}[]=[
    {key:'whatsappEnabled',label:'Activar WhatsApp'},{key:'emailEnabled',label:'Activar correo'},
    {key:'matchAnnouncements',label:'Avisar al crear o cambiar partidos'},
    {key:'reminder24h',label:'Recordatorio 24 horas antes'},{key:'reminder2h',label:'Recordatorio 2 horas antes'},
    {key:'paymentAlerts',label:'Avisarme al subir un comprobante'},
  ];
  return <form className="card bg-base-100 border border-base-200 shadow-sm" onSubmit={async event=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{await api('/notifications/settings',{method:'PUT',json:form});setNotice('Configuración guardada.');onSaved();}
    catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  }}><div className="card-body gap-5">
    <h2 className="card-title">Partidos al grupo · administración solo para ti</h2>
    <label className="grid gap-1 text-sm">Conexión de WhatsApp<select className="select select-bordered w-full" value={form.whatsappProvider} onChange={e=>setForm({...form,whatsappProvider:e.target.value as NotificationSettings['whatsappProvider']})}>
      <option value="evolution">Evolution · número vinculado y grupo existente</option><option value="meta">Meta Cloud API · mensajes individuales</option>
    </select></label>
    <label className="grid gap-1 text-sm">Destino de los avisos deportivos<select className="select select-bordered w-full" value={form.matchDestination} onChange={e=>setForm({...form,matchDestination:e.target.value as NotificationSettings['matchDestination']})}>
      <option value="group">Grupo del equipo</option><option value="players">Jugadores suscritos individualmente</option>
    </select></label>
    {form.matchDestination==='group'?(form.whatsappProvider==='evolution'?<WhatsAppGroupConnection settings={form} ready={view.settings.whatsappProvider==='evolution'&&view.providers.whatsapp.ready} onGroup={(matchGroupId,matchGroupName)=>setForm({...form,matchGroupId,matchGroupName})}/>:<p className="text-warning text-sm">Para conectar este grupo existente, elige Evolution. El adaptador de Meta disponible aquí envía mensajes individuales.</p>):null}
    <div className="grid gap-4 md:grid-cols-2">{fields.filter(field=>form.whatsappProvider==='meta'||!['matchTemplate','paymentTemplate','templateLanguage'].includes(field.key)).map(field=><label className="grid gap-1 text-sm" key={field.key}>{field.label}
      <input className="input input-bordered w-full" value={form[field.key]} placeholder={field.placeholder} maxLength={field.key==='publicBaseUrl'?500:field.key==='adminEmail'?254:100}
        type={field.key==='adminEmail'?'email':field.key==='publicBaseUrl'?'url':field.key==='adminWhatsapp'?'tel':'text'} onChange={e=>setForm({...form,[field.key]:e.target.value})}/>
    </label>)}</div>
    <div className="grid gap-4 sm:grid-cols-2">{toggles.map(toggle=><label key={toggle.key} className="flex gap-3 items-center text-sm">
      <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={form[toggle.key]} onChange={e=>setForm({...form,[toggle.key]:e.target.checked})}/>{toggle.label}
    </label>)}</div>
    <p className="text-sm text-base-content/65">{form.matchDestination==='group'?'Los partidos, cambios y recordatorios van al grupo seleccionado.':'Los partidos se avisan a jugadores activos que aceptaron recibir mensajes.'} Los comprobantes y sus revisiones llegan solo a tu WhatsApp o correo privado. El grupo nunca recibe referencias de pago ni soportes.</p>
    {form.paymentAlerts && ((form.whatsappEnabled&&!form.adminWhatsapp)||(form.emailEnabled&&!form.adminEmail))?<p className="text-warning">Falta tu destinatario de comprobantes para uno de los canales activados.</p>:null}
    {error?<p className="text-error" role="alert">{error}</p>:null}{notice?<p className="text-success" role="status">{notice}</p>:null}
    <button className="btn btn-primary self-start" disabled={busy}>{busy?'Guardando…':'Guardar configuración'}</button>
  </div></form>;
}
export function NotificationsPage() {
  const {data,error,reload}=useFetch<NotificationsView>('/notifications');
  const [filter,setFilter]=useState('todos'),[notice,setNotice]=useState(''),[actionError,setActionError]=useState(''),[busy,setBusy]=useState(false),[retryId,setRetryId]=useState<number|null>(null);
  useEffect(()=>{const timer=setInterval(reload,30000);return ()=>clearInterval(timer);},[reload]);
  async function act(path:string,json:unknown={}) {setBusy(true);setActionError('');setNotice('');
    try{await api(path,{method:'POST',json});setNotice('Aviso agregado a la cola. El historial mostrará la respuesta del proveedor.');setRetryId(null);reload();}
    catch(err){setActionError(errorMessage(err));}finally{setBusy(false);}
  }
  const history=data?.history.filter(job=>filter==='todos'||job.status===filter)??[];
  return <>
    <PageHeader title="Notificaciones y bot" subtitle="Partidos, recordatorios y comprobantes en WhatsApp o correo" actions={<button className="btn btn-outline btn-sm" onClick={reload}>Actualizar historial</button>}/>
    {error||actionError?<p role="alert" className="alert alert-error mb-4">{error||actionError}</p>:null}
    {notice?<p role="status" className="alert alert-success mb-4">{notice}</p>:null}
    {!data?<p>Cargando bot…</p>:<div className="grid gap-5">
      <div className="grid gap-4 lg:grid-cols-3">
        {(['whatsapp','email'] as const).map(channel=><section key={channel} className="card bg-base-100 border border-base-200"><div className="card-body gap-3">
          <h2 className="font-bold text-lg">{channel==='whatsapp'?data.settings.whatsappProvider==='evolution'?'WhatsApp del bot':'WhatsApp Business':'Correo electrónico'}</h2>
          <span className={`badge ${data.providers[channel].ready?'badge-success':'badge-warning'}`}>{data.providers[channel].ready?'Proveedor configurado':'Pendiente de conexión'}</span>
          <p className="text-sm text-base-content/60">{data.providers[channel].ready?'Comprueba el destinatario con una prueba privada.':channel==='whatsapp'?data.settings.whatsappProvider==='evolution'?'Conecta Evolution y vincula el número exclusivo del bot.':'Conecta tu número de empresa y token de Meta en el servidor.':'Configura el servidor SMTP del club.'}</p>
          <button className="btn btn-outline btn-sm self-start" disabled={busy||!data.providers[channel].ready||!(channel==='whatsapp'?data.settings.whatsappEnabled&&data.settings.adminWhatsapp:data.settings.emailEnabled&&data.settings.adminEmail)} onClick={()=>void act('/notifications/test',{channel})}>Enviar prueba {channel==='whatsapp'?'privada de WhatsApp':'de correo'}</button>
        </div></section>)}
        <section className="card bg-primary text-primary-content"><div className="card-body gap-3"><h2 className="font-bold text-lg">El equipo al día</h2><p className="text-4xl font-black">24 h / 2 h</p><p className="text-sm">Recordatorios antes de jugar, usando la hora de Colombia.</p><p className="text-sm">{data.settings.matchDestination==='group'?data.settings.matchGroupName||'Grupo por conectar':`${data.recipients} jugadores con preferencias guardadas.`}</p>
          {data.settings.matchDestination==='group'?<button className="btn btn-sm btn-outline self-start" disabled={busy||!data.providers.whatsapp.ready||!data.settings.whatsappEnabled||!data.settings.matchGroupId} onClick={()=>void act('/notifications/test-group')}>Enviar prueba deportiva al grupo</button>:null}
        </div></section>
      </div>
      <SettingsForm key={JSON.stringify(data.settings)} view={data} onSaved={()=>{setNotice('Configuración guardada.');reload();}}/>
      <details className="collapse collapse-arrow bg-base-100 border border-base-200"><summary className="collapse-title font-semibold">Cómo conectar el bot y proteger tus conversaciones</summary><div className="collapse-content space-y-3 text-sm">
        <p>Para un grupo existente usa una instancia WHATSAPP-BAILEYS de Evolution API con un número exclusivo. En el servidor configura EVOLUTION_API_URL, EVOLUTION_API_KEY y EVOLUTION_INSTANCE. Escanea el QR con ese teléfono, agrégalo al grupo y selecciona el grupo aquí. Guarda tu número personal como destinatario privado; no necesitas vincularlo.</p>
        <p>Una sesión vinculada al WhatsApp personal puede acceder a los chats que sincronice esa cuenta. FutApp consulta nombres de grupos y envía avisos; no consulta el historial de conversaciones. El proveedor de la sesión conserva capacidades más amplias, por eso recomendamos un teléfono exclusivo.</p>
        <p>En Meta configura WhatsApp Business Cloud API, un número de empresa y dos plantillas de utilidad aprobadas. Ambas deben tener cuatro variables de texto en el cuerpo, en este orden: equipo, asunto, detalle y enlace.</p>
        <pre className="bg-base-200 p-3 rounded-xl whitespace-pre-wrap">{'{{1}}\n{{2}}\n{{3}}\nAbre FutApp: {{4}}'}</pre>
        <p>Guarda en el servidor WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_API_VERSION. Para correo: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD y SMTP_FROM. Las claves permanecen en el servidor.</p>
        <p>Guarda tu destinatario privado y la URL de FutApp, activa el canal y prueba por separado el grupo y tu contacto. Las respuestas y asistencia se gestionan en la plataforma.</p>
        <a className="link" href="https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started" target="_blank" rel="noreferrer">Configuración oficial de Meta</a>
      </div></details>
      <section className="card bg-base-100 border border-base-200"><div className="card-body gap-4">
        <div className="flex flex-wrap justify-between items-center gap-3"><h2 className="card-title">Historial de avisos</h2><label className="text-sm flex gap-2 items-center">Estado<select aria-label="Filtrar avisos" className="select select-bordered select-sm" value={filter} onChange={e=>setFilter(e.target.value)}><option value="todos">Todos</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
        <p className="text-sm text-base-content/60">Últimos 200 avisos. “Aceptado” confirma la recepción por el proveedor; la entrega al teléfono o bandeja se verifica con el proveedor. Un fallo no cambia el pago ni el partido.</p>
        {history.length?history.map(job=><article key={job.id} className="rounded-xl border border-base-200 p-4 grid gap-2">
          <div className="flex gap-2 flex-wrap justify-between"><h3 className="font-semibold">{job.message.title}</h3><span className={`badge ${job.status==='aceptado'?'badge-success':job.status==='fallido'||job.status==='incierto'?'badge-error':'badge-ghost'}`}>{labels[job.status]}</span></div>
          <p className="text-xs text-base-content/60">{job.channel==='whatsapp'?'WhatsApp':'Correo'} · {job.recipient.endsWith('@g.us')?'Grupo deportivo':job.receiptId?'Administración privada':job.recipient} · {new Date(job.createdAt).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</p>
          <p className="text-sm break-words">{job.message.detail}</p>
          {job.error?<p className="text-sm text-warning">{job.error}</p>:null}
          <div className="flex flex-wrap gap-3 items-center">
            {job.matchId?<Link className="link text-sm" to={`/admin/partidos/${job.matchId}`}>Ver partido</Link>:null}
            {job.receiptId?<Link className="link text-sm" to="/admin/pagos-qr">Revisar soporte #{job.receiptId}</Link>:null}
            {['fallido','bloqueado','incierto'].includes(job.status)?<button disabled={busy} className="btn btn-outline btn-xs" onClick={()=>job.status==='incierto'?setRetryId(job.id):void act(`/notifications/${job.id}/retry`)}>Reintentar</button>:null}
          </div>
          {retryId===job.id?<div className="rounded-lg bg-warning/15 p-3 text-sm"><p>El proveedor podría haber enviado este mensaje. Revisa su historial antes de reenviar para evitar un duplicado.</p><div className="flex gap-2 mt-2"><button className="btn btn-warning btn-sm" disabled={busy} onClick={()=>void act(`/notifications/${job.id}/retry`)}>Reenviar tras comprobar</button><button className="btn btn-ghost btn-sm" onClick={()=>setRetryId(null)}>Cancelar</button></div></div>:null}
        </article>):<p className="text-base-content/60 py-6 text-center">Todavía no hay avisos en este estado. Conecta el canal y activa tus destinatarios para empezar.</p>}
      </div></section>
    </div>}
  </>;
}
