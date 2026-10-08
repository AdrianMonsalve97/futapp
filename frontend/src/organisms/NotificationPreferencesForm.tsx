import { useState } from 'react';
import { api, errorMessage } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import type { NotificationPreferences } from '../types/notifications';
function PreferencesEditor({initial}:{initial:NotificationPreferences}) {
  const [form,setForm]=useState(initial),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  return <form className="grid gap-4" onSubmit={async event=>{
    event.preventDefault();setBusy(true);setNotice('');setError('');
    try {setForm(await api<NotificationPreferences>('/me/notifications',{method:'PUT',json:form}));setNotice('Preferencias guardadas.');}
    catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  }}>
    <p className="text-sm text-base-content/65">Activa los canales donde quieres recibir los avisos del club. Podrás desactivarlos aquí cuando quieras.</p>
    <label className="flex gap-3 items-center"><input type="checkbox" className="checkbox checkbox-primary" checked={form.whatsapp} onChange={e=>setForm({...form,whatsapp:e.target.checked})}/>Quiero recibir avisos por WhatsApp</label>
    <label className="grid gap-1 text-sm">Mi WhatsApp con indicativo<input className="input input-bordered w-full" type="tel" placeholder="+573001234567" value={form.whatsappNumber} maxLength={20} required={form.whatsapp} pattern="\+[1-9][0-9]{7,14}" onChange={e=>setForm({...form,whatsappNumber:e.target.value})}/></label>
    <label className="flex gap-3 items-center"><input type="checkbox" className="checkbox checkbox-primary" checked={form.email} onChange={e=>setForm({...form,email:e.target.checked})}/>Recibir también en el correo de mi cuenta</label>
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="flex gap-3 items-center"><input type="checkbox" className="checkbox checkbox-sm" checked={form.matchAlerts} onChange={e=>setForm({...form,matchAlerts:e.target.checked})}/>Partidos y recordatorios</label>
    </div>
    <p className="text-xs text-base-content/60">Si el club usa el grupo deportivo, los avisos de partidos llegan al grupo. Los pagos y comprobantes se consultan en FutApp; sus alertas externas son privadas para el administrador.</p>
    {error?<p className="text-error" role="alert">{error}</p>:null}{notice?<p className="text-success" role="status">{notice}</p>:null}
    <button className="btn btn-primary justify-self-start" disabled={busy}>{busy?'Guardando…':'Guardar mis avisos'}</button>
  </form>;
}
export function NotificationPreferencesForm() {
  const {data,error}=useFetch<NotificationPreferences>('/me/notifications');
  if(error)return <p role="alert" className="text-error">{error}</p>;
  return data?<PreferencesEditor initial={data}/>:<p>Cargando preferencias…</p>;
}
