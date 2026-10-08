import { useState } from 'react';
import { api, errorMessage } from '../services/api';
import type { NotificationSettings } from '../types/notifications';
export function WhatsAppGroupConnection({settings,ready,onGroup}:{settings:NotificationSettings;ready:boolean;onGroup:(id:string,name:string)=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[qr,setQr]=useState<string|null>(null),[state,setState]=useState(''),[groups,setGroups]=useState<{id:string;name:string}[]>([]);
  async function action(kind:'connect'|'connection'|'groups') {
    setBusy(true);setError('');
    try {
      if(kind==='connect') {
        const result=await api<{qr:string|null;state:string}>('/notifications/whatsapp/connect',{method:'POST',json:{}});
        setQr(result.qr);setState(result.state==='connected'?'Conectado':'Escanea el QR con el teléfono del bot');
      } else if(kind==='connection') {
        const result=await api<{state:string}>('/notifications/whatsapp/connection');
        setState(result.state==='connected'?'Conectado':'El bot sigue desconectado');if(result.state==='connected')setQr(null);
      } else {
        setGroups(await api<{id:string;name:string}[]>('/notifications/whatsapp/groups'));setState('Conectado');setQr(null);
      }
    } catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  }
  return <section className="rounded-xl border border-success/25 bg-success/5 p-4 grid gap-4">
    <div><h3 className="font-bold">Grupo deportivo del equipo</h3><p className="text-sm text-base-content/65 mt-1">Conecta un número exclusivo del bot, agrégalo al grupo existente y selecciona ese grupo. Los pagos y comprobantes se envían únicamente a tu contacto privado.</p></div>
    <p className="text-sm rounded-lg bg-base-100 p-3">Vincular tu número personal puede dar al servicio acceso a conversaciones sincronizadas de esa cuenta. Un número exclusivo permite mantener tus chats personales fuera de la sesión del bot.</p>
    <div className="flex gap-2 flex-wrap">
      <button type="button" className="btn btn-outline btn-sm" disabled={busy||!ready} onClick={()=>void action('connect')}>Generar QR del bot</button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy||!ready} onClick={()=>void action('connection')}>Comprobar conexión</button>
      <button type="button" className="btn btn-outline btn-sm" disabled={busy||!ready} onClick={()=>void action('groups')}>Cargar grupos del bot</button>
    </div>
    {!ready?<p className="text-sm text-warning">Falta conectar Evolution API en el servidor. Guarda este proveedor y configura la instancia antes de generar el QR.</p>:null}
    {state?<p className="text-sm" role="status">{state}</p>:null}
    {error?<p className="text-error text-sm" role="alert">{error}</p>:null}
    {qr?<div className="grid justify-items-start gap-2"><img src={qr} alt="QR para vincular el WhatsApp del bot" className="w-72 max-w-full rounded-xl bg-white"/><p className="text-sm">Desde el teléfono exclusivo: WhatsApp → Dispositivos vinculados → Vincular dispositivo.</p><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setQr(null)}>Ocultar QR</button></div>:null}
    <label className="grid gap-1 text-sm">Grupo que recibirá los partidos<select className="select select-bordered w-full" value={settings.matchGroupId} onChange={e=>{const group=groups.find(g=>g.id===e.target.value);onGroup(group?.id??'',group?.name??'');}}>
      <option value="">Selecciona el grupo del equipo</option>
      {settings.matchGroupId&&!groups.some(g=>g.id===settings.matchGroupId)?<option value={settings.matchGroupId}>{settings.matchGroupName||'Grupo guardado · vuelve a comprobar la conexión'}</option>:null}
      {groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}
    </select></label>
    {!groups.length?<p className="text-xs text-base-content/60">Cuando el teléfono esté conectado y pertenezca al grupo, carga sus grupos para seleccionarlo.</p>:null}
  </section>;
}
