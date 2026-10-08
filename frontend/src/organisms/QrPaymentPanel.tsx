import { useState, type FormEvent } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api, apiBlob, errorMessage } from '../services/api';
import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { Card, CardBody, CardTitle } from '../atoms/Card';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from '../molecules/FormField';
import { MediaImage } from '../atoms/MediaImage';
import { Modal } from '../atoms/Modal';
import { formatMoney, formatDate,formatColombiaDateTime } from '../utils/format';
import type { PaymentReceipt, QrPaymentView } from '../types/payments';

export async function downloadReceipt(row: PaymentReceipt) {
  const blob = await apiBlob('/api/media/'+row.assetId);
  const url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url;link.download=`soporte-${row.id}.${blob.type==='application/pdf'?'pdf':'webp'}`;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function QrPaymentPanel({ kind, onSaved, refreshKey,matchId }: {kind:'inscription'|'uniform'|'referee';onSaved:()=>void;refreshKey?:unknown;matchId?:number}) {
  const view=useFetch<QrPaymentView>('/api/me/payment-receipts',[refreshKey]);
  const [target,setTarget]=useState(''),[amount,setAmount]=useState(''),[reference,setReference]=useState('');
  const [paidAt,setPaidAt]=useState(()=>{const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;return kind==='referee'?new Date(Date.now()-5*3600000).toISOString().slice(0,16):date;});
  const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  const [key,setKey]=useState(()=>crypto.randomUUID()),[inputKey,setInputKey]=useState(0);
  const [qrOpen,setQrOpen]=useState(false);
  const downloadQr=async()=>{
    if(!view.data?.qr.assetId)return;
    try{const blob=await apiBlob('/api/media/'+view.data.qr.assetId);const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='qr-equipo.png';link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch(err){setError(errorMessage(err));}
  };
  const matchesKind=(row:{kind:string;targetId:number})=>kind==='uniform'?['uniform_request','uniform_issue'].includes(row.kind):row.kind===kind&&(kind!=='referee'||matchId===undefined||row.targetId===matchId);
  const debts=(view.data?.debts??[]).filter(matchesKind);
  const options=debts.filter(d=>d.outstanding-d.pending>0.001);
  const selected=options.find(d=>`${d.kind}:${d.targetId}`===target)??options[0];
  const receipts=(view.data?.receipts??[]).filter(matchesKind);
  const submit=async(event:FormEvent)=>{
    event.preventDefault();setError(null);setNotice(null);
    if (!selected || !file) {setError('Selecciona el concepto y adjunta el soporte.');return;}
    setBusy(true);
    try{
      const body=new FormData();body.append('file',file);body.append('kind',selected.kind);body.append('targetId',String(selected.targetId));
      body.append('amount',amount);body.append('reference',reference.trim());body.append('paidAt',kind==='referee'?new Date(paidAt+'-05:00').toISOString():paidAt);
      await api('/api/me/payment-receipts',{method:'POST',headers:{'Idempotency-Key':key},body});
      setNotice('Soporte enviado. El administrador debe revisarlo para confirmar el pago.');
      setFile(null);setAmount('');setReference('');setKey(crypto.randomUUID());setInputKey(k=>k+1);view.reload();onSaved();
    }catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  };
  return <Card className="my-4"><CardBody className="gap-4">
    <CardTitle className="text-lg">Pagar {kind==='inscription'?'inscripción':kind==='referee'?'arbitraje del partido':'uniforme'} por QR</CardTitle>
    {view.error?<Alert tone="error">{view.error}</Alert>:null}
    {error?<Alert tone="error">{error}</Alert>:null}{notice?<Alert tone="success">{notice}</Alert>:null}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_1fr]">
      <div className="space-y-2">
        {view.data?.qr.assetId?<><MediaImage src={'/api/media/'+view.data.qr.assetId} alt="QR para pagar al equipo" className="w-full rounded-xl bg-white object-contain" />
          <p className="font-semibold">{view.data.qr.recipient}</p><p className="text-sm break-all">Llave: {view.data.qr.paymentKey}</p></>:<p className="text-sm text-base-content/60">El administrador debe cargar el QR de pago.</p>}
        {view.data?.qr.assetId?<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>setQrOpen(true)}>Ampliar QR</Button><Button size="sm" variant="outline" onClick={()=>void downloadQr()}>Descargar QR</Button></div>:null}
        <p className="text-sm text-base-content/60">Escanea el QR en tu aplicación bancaria. Después adjunta el comprobante de la transferencia.</p>
      </div>
      <div className="space-y-4">
        {options.length?<form onSubmit={event=>void submit(event)} className="space-y-3">
          <FormField label="Concepto que pagaste"><Select value={selected?`${selected.kind}:${selected.targetId}`:''} onChange={event=>{setTarget(event.target.value);setAmount('');setKey(crypto.randomUUID());}}>
            {options.map(d=><option key={`${d.kind}:${d.targetId}`} value={`${d.kind}:${d.targetId}`}>{d.concept} · saldo {formatMoney(d.outstanding-d.pending)}</option>)}
          </Select></FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Monto transferido" required><Input type="number" min={kind==='referee'?1:0.01} step={kind==='referee'?1:0.01} max={selected?Math.max(0,selected.outstanding-selected.pending):undefined} value={amount} required onChange={e=>{setAmount(e.target.value);setKey(crypto.randomUUID());}} />{kind==='referee'&&selected?<Button type="button" size="xs" variant="ghost" onClick={()=>{setAmount(String(Math.max(0,selected.outstanding-selected.pending)));setKey(crypto.randomUUID());}}>Usar saldo pendiente</Button>:null}</FormField>
            <FormField label={kind==='referee'?'Fecha y hora de la transferencia · Colombia':'Fecha del pago'} required hint={kind==='referee'?'Debe coincidir con el comprobante; el administrador verificará esta hora.':undefined}><Input type={kind==='referee'?'datetime-local':'date'} value={paidAt} required onChange={e=>{setPaidAt(e.target.value);setKey(crypto.randomUUID());}} /></FormField>
          </div>
          <FormField label="Referencia de la transferencia" required><Input value={reference} required maxLength={120} onChange={e=>{setReference(e.target.value);setKey(crypto.randomUUID());}} placeholder="Número de operación del comprobante" /></FormField>
          <FormField label="Soporte de pago" required hint="PDF, JPG, PNG o WEBP · hasta 8 MB · PDF hasta 10 páginas."><input key={inputKey} type="file" required disabled={busy} accept="application/pdf,image/jpeg,image/png,image/webp" className="file-input file-input-bordered w-full" onChange={e=>{setFile(e.target.files?.[0]??null);setKey(crypto.randomUUID());}} /></FormField>
          <Button type="submit" loading={busy} disabled={!view.data?.qr.assetId}>Enviar soporte a revisión</Button>
        </form>:<p className="text-sm text-base-content/60">{view.loading?'Cargando pagos…':kind==='uniform'&&!debts.length?'Solicita un uniforme en el catálogo para ver el concepto de pago.':'Sin saldo disponible para enviar otro soporte. Si hay uno pendiente, espera su revisión.'}</p>}
        {debts.length?<div className="space-y-2">{debts.map(d=><div key={`${d.kind}:${d.targetId}`} className="rounded-lg bg-base-200 p-3 text-sm"><p className="font-semibold">{d.concept}</p><p>Confirmado: {formatMoney(d.paid)} · saldo: {formatMoney(d.outstanding)}{d.pending>0?` · en revisión: ${formatMoney(d.pending)}`:''}{d.credit?` · saldo a favor: ${formatMoney(d.credit)}`:''}</p></div>)}</div>:null}
      </div>
    </div>
    {receipts.length?<div className="space-y-2"><h3 className="font-semibold">Mis soportes</h3>{receipts.map(row=><div key={row.id} className="rounded-xl border border-base-200 p-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><p className="font-semibold">{formatMoney(row.amount)} · {row.status}</p><p className="text-sm break-all">{row.reference} · {row.kind==='referee'?formatColombiaDateTime(row.paidAt)+' (Colombia)':formatDate(row.paidAt)}</p>{row.reviewNotes?<p className="text-sm">{row.reviewNotes}</p>:null}</div>
      <Button size="sm" variant="outline" onClick={()=>void downloadReceipt(row).catch(err=>setError(errorMessage(err)))}>Descargar soporte</Button>
    </div>)}</div>:null}
    <Modal title="QR de pago del equipo" open={qrOpen} onClose={()=>setQrOpen(false)} size="lg">
      <MediaImage src={view.data?.qr.assetId?'/api/media/'+view.data.qr.assetId:null} alt="QR de pago ampliado" className="w-full max-w-[600px] mx-auto bg-white rounded-lg" />
    </Modal>
  </CardBody></Card>;
}
