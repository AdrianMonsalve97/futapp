import {useState,type FormEvent} from 'react';
import {Modal} from '../atoms/Modal';
import {Button} from '../atoms/Button';
import {Input} from '../atoms/Input';
import {Alert} from '../atoms/Alert';
import {FormField} from '../molecules/FormField';
import {api,errorMessage} from '../services/api';
export function PlayerRecoveryDialog({userId,name}:{userId:number;name:string}){
  const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<{url:string;expiresAt:string}|null>(null),[copied,setCopied]=useState(false);
  const close=()=>{if(busy)return;setOpen(false);setPassword('');setResult(null);setError('');setCopied(false);};
  const submit=async(event:FormEvent)=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{setResult(await api('/auth/admin-reset',{method:'POST',json:{userId,password}}));setPassword('');}catch(err){setError(errorMessage(err));}finally{setBusy(false);}};
  return <><Button variant="outline" size="sm" onClick={()=>setOpen(true)}>Recuperar acceso</Button><Modal open={open} onClose={close} closeOnOutside={!busy} title={`Recuperar acceso · ${name}`}>
    <p className="text-sm mb-4">Verifica que quien pide ayuda sea el titular de esta cuenta. El enlace permite elegir una nueva contraseña: compártelo solo con ese jugador por un canal privado.</p>{error?<Alert tone="error">{error}</Alert>:null}
    {result?<div className="space-y-3 mt-3"><Alert tone="success">Enlace generado. Vence en 15 minutos y funciona una sola vez.</Alert><Input aria-label="Enlace privado de recuperación" readOnly value={result.url}/><p className="text-xs">Vence: {new Date(result.expiresAt).toLocaleString('es-CO')}</p><Button onClick={async()=>{try{await navigator.clipboard.writeText(result.url);setCopied(true);}catch{setError('Copia el enlace desde el campo.');}}}>{copied?'Copiado':'Copiar enlace privado'}</Button><p className="text-xs text-base-content/60">La contraseña actual sigue funcionando hasta usar el enlace. Generar otro invalida el anterior.</p></div>:<form className="auth-fields" onSubmit={event=>void submit(event)}><FormField label="Confirma tu contraseña de administrador" required><Input type="password" required autoComplete="current-password" value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/></FormField><Button type="submit" loading={busy}>Generar enlace temporal</Button></form>}
  </Modal></>;
}
