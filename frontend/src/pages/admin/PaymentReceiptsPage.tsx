import { useState, type FormEvent } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Button } from '../../atoms/Button';
import { Card, CardBody } from '../../atoms/Card';
import { Input } from '../../atoms/Input';
import { Select } from '../../atoms/Select';
import { FormField } from '../../molecules/FormField';
import { MediaImage } from '../../atoms/MediaImage';
import { downloadReceipt } from '../../organisms/QrPaymentPanel';
import { formatMoney,formatDate,formatColombiaDateTime as formatDateTime } from '../../utils/format';
import type { QrPaymentView } from '../../types/payments';

export function PaymentReceiptsPage(){
  const view=useFetch<QrPaymentView>('/api/payment-receipts');
  const [error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[busy,setBusy]=useState<string|null>(null);
  const [notes,setNotes]=useState<Record<number,string>>({}),[filter,setFilter]=useState('pendiente');
  const [recipient,setRecipient]=useState(''),[paymentKey,setPaymentKey]=useState(''),[file,setFile]=useState<File|null>(null);
  const setQr=async(event:FormEvent)=>{
    event.preventDefault(); if(!file)return;setBusy('qr');setError(null);
    try{const body=new FormData();body.append('file',file);body.append('recipient',recipient.trim()||view.data?.qr.recipient||'');body.append('paymentKey',paymentKey.trim()||view.data?.qr.paymentKey||'');
      await api('/api/settings/payment-qr',{method:'POST',body});view.reload();setNotice('QR de pago actualizado.');
    }catch(err){setError(errorMessage(err));}finally{setBusy(null);}
  };
  const review=async(id:number,status:'aprobado'|'rechazado')=>{
    setBusy(String(id));setError(null);setNotice(null);
    try{await api(`/api/payment-receipts/${id}/review`,{method:'PUT',json:{status,notes:notes[id]??''}});view.reload();setNotice(`Soporte ${status}.`);}
    catch(err){setError(errorMessage(err));}finally{setBusy(null);}
  };
  return <><PageHeader title="Pagos por QR y soportes" subtitle="Revisa los comprobantes antes de confirmar el abono" />
    {error||view.error?<Alert tone="error" className="mb-4">{error??view.error}</Alert>:null}{notice?<Alert tone="success" className="mb-4">{notice}</Alert>:null}
    <Card className="mb-4"><CardBody>
      <details><summary className="cursor-pointer font-semibold">QR de pago del equipo</summary><div className="grid gap-4 mt-4 sm:grid-cols-[220px_1fr]">
        {view.data?.qr.assetId?<MediaImage src={'/api/media/'+view.data.qr.assetId} alt="QR de pago vigente" className="w-full bg-white rounded-xl" />:<p>Sin QR configurado.</p>}
        <form className="space-y-3" onSubmit={e=>void setQr(e)}>
          <FormField label="Titular"><Input value={recipient||view.data?.qr.recipient||''} onChange={e=>setRecipient(e.target.value)} maxLength={120} /></FormField>
          <FormField label="Llave de pago"><Input value={paymentKey||view.data?.qr.paymentKey||''} onChange={e=>setPaymentKey(e.target.value)} maxLength={120} /></FormField>
          <FormField label="Imagen del QR"><input type="file" required accept="image/jpeg,image/png,image/webp" className="file-input file-input-bordered w-full" onChange={e=>setFile(e.target.files?.[0]??null)} /></FormField>
          <Button loading={busy==='qr'} type="submit">Actualizar QR</Button>
        </form>
      </div></details>
    </CardBody></Card>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Soportes recibidos</h2><Select aria-label="Filtrar soportes" className="w-48" value={filter} onChange={e=>setFilter(e.target.value)}><option value="pendiente">Pendientes</option><option value="aprobado">Aprobados</option><option value="rechazado">Rechazados</option><option value="todos">Todos</option></Select></div>
    <div className="space-y-4">{(view.data?.receipts??[]).filter(r=>filter==='todos'||r.status===filter).map(row=>{
      const debt=view.data?.debts.find(d=>d.kind===row.kind&&d.targetId===row.targetId&&d.playerId===row.playerId);
      return <Card key={row.id}><CardBody>
        {row.kind==='referee'&&debt?<p className="text-sm">Saldo de fechas anteriores aplicado: {formatMoney(debt.creditApplied)} · saldo acumulado disponible: {formatMoney(debt.walletCredit)}{debt.creditTransferred?` · de este partido aplicado a otras fechas: ${formatMoney(debt.creditTransferred)}`:''}</p>:null}
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{row.playerName} · {formatMoney(row.amount)}</h3><p>{debt?.concept??(row.kind==='inscription'?'Inscripción':row.kind==='referee'?'Arbitraje':'Uniforme')}</p><p className="text-sm break-all">{row.reference} · {row.kind==='referee'?formatDateTime(row.paidAt):formatDate(row.paidAt)} · {row.status}</p></div>
          <Button variant="outline" size="sm" onClick={()=>void downloadReceipt(row).catch(e=>setError(errorMessage(e)))}>Descargar comprobante</Button>
        </div>
        {row.kind==='referee'?<Alert tone="info">Verifica que la fecha y hora declaradas coincidan con la transferencia del comprobante. El plazo para ser titular es {debt?.dueAt?formatDateTime(debt.dueAt):'48 horas antes del partido'}. Si el soporte no coincide, recházalo para que el jugador lo corrija.{debt?.credit?` Saldo a favor: ${formatMoney(debt.credit)}.`:''}</Alert>:null}
        {row.status==='pendiente'?<><FormField label={`Observación para ${row.playerName}`}><Input value={notes[row.id]??''} maxLength={2000} onChange={e=>setNotes(prev=>({...prev,[row.id]:e.target.value}))} placeholder="Motivo de rechazo o nota de validación" /></FormField>
          <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy!==null} onClick={()=>void review(row.id,'rechazado')}>Rechazar</Button><Button loading={busy===String(row.id)} disabled={busy!==null} onClick={()=>void review(row.id,'aprobado')}>Aprobar y registrar abono</Button></div></>:<p className="text-sm">{row.reviewNotes}</p>}
      </CardBody></Card>;
    })}{!view.loading && !(view.data?.receipts??[]).some(r=>filter==='todos'||r.status===filter)?<p className="text-base-content/60">No hay soportes en este estado.</p>:null}</div>
  </>;
}
