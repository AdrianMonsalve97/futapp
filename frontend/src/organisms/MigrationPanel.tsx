import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { api, apiBlob, uploadFile, errorMessage } from '../services/api';
import { Card, CardBody, CardTitle } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { Alert } from '../atoms/Alert';
import { Input } from '../atoms/Input';
import { Modal } from '../atoms/Modal';
import { FormField } from '../molecules/FormField';
type Status = { enabled:boolean; canImport:boolean; importedAt:string|null; reason:string };
type Preview = { id:string; createdAt:string; counts:Record<string,number>; files:number; expiresAt:string };
const labels:Record<string,string> = { users:'Cuentas',players:'Jugadores',tournaments:'Torneos',tournament_players:'Inscritos en torneos',matches:'Partidos',inscriptions:'Inscripciones',payments:'Pagos',payment_receipts:'Comprobantes',media_assets:'Fotos y documentos' };
export function MigrationPanel() {
  const status = useFetch<Status>('/api/migration');
  const { logout } = useAuth();
  const [busy,setBusy] = useState(''), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [preview,setPreview] = useState<Preview|null>(null), [confirmation,setConfirmation] = useState(''), [done,setDone] = useState(false);
  async function run(name:string, action:()=>Promise<void>) { setBusy(name);setError('');try { await action(); } catch(err) {setError(errorMessage(err));}finally {setBusy('');} }
  return <Card className="mt-6"><CardBody className="gap-4">
    <div><CardTitle>Migración de datos</CardTitle><p className="mt-2 text-sm text-base-content/65">Lleva la información actual del equipo a Render como datos iniciales: cuentas, torneos, alineaciones, fotos y comprobantes.</p></div>
    {error || status.error ? <Alert tone="error">{error || status.error}</Alert> : null}
    {notice ? <Alert tone="success">{notice}</Alert> : null}
    {done ? <><Alert tone="success">Datos importados. Las cuentas y contraseñas del equipo se conservaron. Ingresa con tu cuenta habitual para continuar.</Alert><Button onClick={logout}>Ingresar con las cuentas importadas</Button></> : <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-base-300 p-4 space-y-3 min-w-0"><h3 className="font-semibold">1. Descargar desde esta app</h3>
        <p className="text-sm text-base-content/65">Genera un archivo privado .futapp con una copia de los datos actuales. Guárdalo en un lugar seguro: contiene información personal, de salud y pagos.</p>
        <Button variant="outline" disabled={!!busy} loading={busy==='export'} onClick={()=>void run('export',async()=>{
          const blob=await apiBlob('/api/migration/export'), url=URL.createObjectURL(blob), link=document.createElement('a');
          link.href=url;link.download=`futapp-${new Date().toISOString().slice(0,10)}.futapp`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
          setNotice('Archivo descargado. Para el traslado final, evita agregar datos en la app anterior después de exportarlo.');
        })}>Exportar datos para migración</Button>
      </section>
      <section className="rounded-xl border border-base-300 p-4 space-y-3 min-w-0"><h3 className="font-semibold">2. Ingesta en la nueva instalación</h3>
        <p className="text-sm text-base-content/65">{status.data?.reason || 'Comprobando si se pueden importar datos…'}</p>
        {status.data?.importedAt ? <p className="text-sm">Importación realizada: {new Date(status.data.importedAt).toLocaleString('es-CO')}</p> : null}
        <Button disabled={!!busy || !status.data?.canImport} loading={busy==='enable'} variant={status.data?.enabled?'outline':'primary'} onClick={()=>void run('enable',async()=>{
          await api('/migration',{method:'PUT',json:{enabled:!status.data?.enabled}});setPreview(null);status.reload();
        })}>{status.data?.enabled?'Desactivar ingesta de semilla':'Activar ingesta de semilla'}</Button>
        {status.data?.enabled && status.data.canImport ? <FormField label="Archivo del equipo" hint="Exportado desde FutApp con la misma versión. Máximo 25 MB.">
          <input type="file" accept=".futapp" className="file-input file-input-bordered w-full max-w-full" disabled={!!busy} onChange={event=>{
            const file=event.target.files?.[0];event.target.value='';if(!file)return;
            if(file.size>25*1024*1024){setError('El archivo supera 25 MB');return;}
            void run('preview',async()=>{setPreview(await uploadFile<Preview>('/migration/preview',file));setConfirmation('');});
          }}/>{busy==='preview'?<p className="text-sm">Validando datos y archivos…</p>:null}
        </FormField> : null}
      </section>
    </div>}
    <Modal open={!!preview} title="Importar datos iniciales del equipo" onClose={()=>{if(!busy)setPreview(null);}} closeOnOutside={!busy}
      footer={<><Button variant="ghost" disabled={!!busy} onClick={()=>setPreview(null)}>Cancelar</Button><Button disabled={!!busy || confirmation!=='IMPORTAR'} loading={busy==='import'} onClick={()=>void run('import',async()=>{
        await api('/migration/import',{method:'POST',json:{id:preview!.id,confirmation}});setPreview(null);setNotice('');setDone(true);
      })}>Importar datos</Button></>}>
      {preview ? <div className="space-y-4"><p className="text-sm">Copia del {new Date(preview.createdAt).toLocaleString('es-CO')}. Los datos pasarán a esta instalación. Se guardará una copia del administrador inicial antes de importar.</p>
        <dl className="grid grid-cols-2 gap-2">{Object.entries(preview.counts).map(([key,value])=><div key={key} className="rounded-lg bg-base-200 p-2"><dt className="text-xs text-base-content/65">{labels[key] || key}</dt><dd className="font-bold">{value}</dd></div>)}</dl>
        <p className="text-sm">Después de importar, vuelve a ingresar con las cuentas del equipo. Genera una nueva invitación para registrar integrantes; las sesiones e invitaciones anteriores se invalidan. Los envíos de notificaciones quedan desactivados.</p>
        {error?<Alert tone="error">{error}</Alert>:null}
        <FormField label="Escribe IMPORTAR para confirmar"><Input value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" disabled={!!busy}/></FormField>
      </div>:null}
    </Modal>
  </CardBody></Card>;
}
