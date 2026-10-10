import {useFetch} from '../hooks/useFetch';
import {Card,CardBody,CardTitle} from '../atoms/Card';
import {Alert} from '../atoms/Alert';
export function RecoverySettingsPanel(){
  const {data,error}=useFetch<{ready:boolean;missing:string[];expiresInMinutes:number}>('/api/auth/recovery-settings');
  return <Card className="mt-6"><CardBody><CardTitle>Recuperación de contraseñas</CardTitle>{error?<Alert tone="error">No se pudo comprobar el servicio de recuperación.</Alert>:data?<Alert tone={data.ready?'success':'info'}>{data.ready?'Correo configurado mediante Brevo. Completa la verificación del remitente y comprueba la entrega con tu propia cuenta.':'Correo pendiente de configurar. La recuperación asistida está disponible en la ficha del jugador.'}</Alert>:null}
    <p className="text-sm">El jugador puede usar «¿Olvidaste tu contraseña?» en el login. Los enlaces duran 15 minutos, funcionan una vez y cierran las sesiones anteriores al cambiar la contraseña.</p>
    {!data?.ready?<><p className="text-sm">Crea una cuenta gratuita en <a className="link" href="https://www.brevo.com/" target="_blank" rel="noreferrer">Brevo</a>, verifica el remitente y configura los secretos <code>BREVO_API_KEY</code> y <code>MAIL_FROM</code> en GitHub Actions. Después ejecuta FutApp CI/CD para aplicarlos a Render.</p>{data?.missing.length?<p className="text-xs text-base-content/60">Pendiente: {data.missing.join(', ')}</p>:null}</>:null}
    <p className="text-xs text-base-content/60">En Jugadores → ficha → Recuperar acceso puedes generar un enlace privado tras confirmar tu contraseña. Verifica la identidad del jugador antes de compartirlo.</p>
  </CardBody></Card>;
}
