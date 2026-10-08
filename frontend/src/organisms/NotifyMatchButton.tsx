import { useState } from 'react';
import { api, errorMessage } from '../services/api';
export function NotifyMatchButton({matchId}:{matchId:number}) {
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  return <div className="grid gap-2 mb-4"><div className="flex flex-wrap gap-3 items-center">
    <button className="btn btn-outline btn-sm" disabled={busy} onClick={async()=>{
      setBusy(true);setError('');setNotice('');
      try{const result=await api<{queued:number;message:string}>(`/matches/${matchId}/notify`,{method:'POST',json:{}});setNotice(`${result.queued} avisos nuevos en cola. ${result.message}`);}
      catch(err){setError(errorMessage(err));}finally{setBusy(false);}
    }}>{busy?'Preparando avisos…':'Notificar partido al equipo'}</button>
    <a className="link text-sm" href="/admin/notificaciones">Configurar avisos y ver historial</a>
  </div>{notice?<p role="status" className="text-success text-sm">{notice}</p>:null}{error?<p role="alert" className="text-error text-sm">{error}</p>:null}</div>;
}
