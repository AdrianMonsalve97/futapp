import { useState } from 'react';
import { api,errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card,CardBody,CardTitle } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { FormField } from '../molecules/FormField';
export function AccountSecurityPanel(){
  const {logout}=useAuth();const [link,setLink]=useState(''),[expires,setExpires]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState('');
  const [current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[copied,setCopied]=useState(false);
  return <div className="grid gap-5 lg:grid-cols-2 mt-6">
    <Card><CardBody><CardTitle>Invitar integrantes</CardTitle><p className="text-sm text-base-content/65">Comparte el enlace solo con el equipo. Cada integrante crea su propia cuenta de jugador. La invitación vence en 7 días; generar otra invalida la anterior.</p>
      <Button disabled={!!busy} loading={busy==='invite'} onClick={async()=>{setBusy('invite');setError('');try{const result=await api<{code:string;expiresAt:string}>('/auth/invitation',{method:'POST',json:{}});setLink(`${window.location.origin}/registro#invitacion=${result.code}`);setExpires(result.expiresAt);setCopied(false);}catch(err){setError(errorMessage(err));}finally{setBusy('');}}}>Generar enlace de registro</Button>
      {link?<><Input aria-label="Enlace de invitación" readOnly value={link}/><p className="text-xs">Vence: {new Date(expires).toLocaleString('es-CO')}</p><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(link);setCopied(true);}catch{setError('Copia el enlace desde el campo.');}}}>{copied?'Enlace copiado':'Copiar enlace'}</Button></>:null}
    </CardBody></Card>
    <Card><CardBody><CardTitle>Cambiar mi contraseña</CardTitle><p className="text-sm text-base-content/65">Usa al menos 15 caracteres. Al cambiarla, todas tus sesiones anteriores dejan de funcionar y debes volver a ingresar.</p>
      <form className="auth-fields" onSubmit={async e=>{e.preventDefault();setError('');if(password!==confirm){setError('Las contraseñas nuevas no coinciden');return;}setBusy('password');try{await api('/me/password',{method:'PUT',json:{currentPassword:current,newPassword:password}});logout();}catch(err){setError(errorMessage(err));}finally{setBusy('');}}}>
        <FormField label="Contraseña actual"><Input type="password" required autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)}/></FormField>
        <FormField label="Nueva contraseña"><Input type="password" required minLength={15} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></FormField>
        <FormField label="Confirmar nueva contraseña"><Input type="password" required minLength={15} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></FormField>
        <Button type="submit" disabled={!!busy} loading={busy==='password'}>Cambiar contraseña y cerrar sesiones</Button>
      </form>
    </CardBody></Card>{error?<p role="alert" className="text-error">{error}</p>:null}
  </div>;
}
