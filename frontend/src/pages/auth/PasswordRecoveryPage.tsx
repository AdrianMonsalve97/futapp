import {useEffect,useState,type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {api,errorMessage} from '../../services/api';
import {useFetch} from '../../hooks/useFetch';
import {Card,CardBody} from '../../atoms/Card';
import {Alert} from '../../atoms/Alert';
import {Button} from '../../atoms/Button';
import {Input} from '../../atoms/Input';
import {FormField} from '../../molecules/FormField';
import {Icon} from '../../atoms/Icon';

export function ForgotPasswordPage(){
  const status=useFetch<{ready:boolean}>('/api/auth/recovery-status');
  const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const submit=async(event:FormEvent)=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{const result=await api<{message:string}>('/auth/forgot-password',{method:'POST',json:{email:email.trim()}});setMessage(result.message);}catch(err){setError(errorMessage(err));}finally{setBusy(false);}};
  return <Card className="auth-entry-card border border-base-300"><CardBody className="p-6 sm:p-8"><div className="w-12 h-12 rounded-xl bg-primary/10 grid place-items-center mb-3"><Icon name="shield" size={24}/></div><h2 className="text-xl font-bold">Recupera tu acceso</h2><p className="text-sm text-base-content/65">Tu equipo te espera. Elige una contraseña nueva sin perder tus datos.</p>
    {status.error?<Alert tone="error">No se pudo comprobar el correo. Intenta de nuevo o contacta al administrador.</Alert>:status.data&&!status.data.ready?<Alert tone="info">El envío automático de correo aún no está habilitado. Contacta al administrador del equipo: puede generar un enlace temporal desde tu ficha en Jugadores. Verificará tu identidad antes de compartirlo.</Alert>:null}
    {message?<Alert tone="success">{message}</Alert>:<form className="auth-fields" onSubmit={event=>void submit(event)}>{error?<Alert tone="error">{error}</Alert>:null}<FormField label="Correo de tu cuenta" required><Input type="email" required maxLength={254} autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="tu.correo@equipo.com" disabled={busy}/></FormField><Button type="submit" loading={busy} disabled={status.loading||!status.data?.ready}>Enviar enlace de recuperación</Button></form>}
    <p className="text-xs text-base-content/50">El enlace dura 15 minutos y se usa una sola vez. Nunca te pediremos tu contraseña por correo.</p><Link to="/login" className="link link-primary text-sm mt-3">← Volver a ingresar</Link>
  </CardBody></Card>;
}
export function ResetPasswordPage(){
  const [token]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('token')||''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
  useEffect(()=>{window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);},[]);
  const valid=/^[A-Za-z0-9_-]{43}$/.test(token);
  const submit=async(event:FormEvent)=>{event.preventDefault();if(busy)return;setError('');if(password!==confirmation){setError('Las contraseñas no coinciden.');return;}setBusy(true);try{await api('/auth/reset-password',{method:'POST',json:{token,password,confirmation}});setPassword('');setConfirmation('');setDone(true);}catch(err){setError(errorMessage(err));}finally{setBusy(false);}};
  return <Card className="auth-entry-card border border-base-300"><CardBody className="p-6 sm:p-8"><h2 className="text-xl font-bold">Nueva contraseña</h2><p className="text-sm text-base-content/65">Usa una frase de al menos 15 caracteres. Se cerrarán las sesiones anteriores.</p>
    {done?<><Alert tone="success">Contraseña actualizada. Ya puedes volver a ingresar con la nueva.</Alert><Link className="btn btn-primary mt-3" to="/login">Ingresar con mi nueva contraseña →</Link></>:!valid?<><Alert tone="warning">Este enlace no contiene una clave válida. Abre el enlace completo que recibiste o solicita uno nuevo.</Alert><Link className="btn btn-outline mt-3" to="/recuperar-contrasena">Solicitar otro enlace</Link></>:<form className="auth-fields" onSubmit={event=>void submit(event)}>{error?<Alert tone="error">{error} <Link to="/recuperar-contrasena" className="link">Solicitar otro enlace</Link></Alert>:null}<FormField label="Nueva contraseña" required><Input type="password" autoComplete="new-password" required minLength={15} value={password} disabled={busy} onChange={event=>setPassword(event.target.value)}/></FormField><FormField label="Confirma la nueva contraseña" required><Input type="password" autoComplete="new-password" required minLength={15} value={confirmation} disabled={busy} onChange={event=>setConfirmation(event.target.value)}/></FormField><Button type="submit" loading={busy}>Guardar contraseña y cerrar sesiones</Button></form>}
    <Link to="/login" className="link link-primary text-sm mt-3">← Volver al inicio de sesión</Link>
  </CardBody></Card>;
}
