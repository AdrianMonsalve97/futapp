import {useState,type FormEvent} from 'react';
import {useFetch} from '../../hooks/useFetch';
import {api,errorMessage} from '../../services/api';
import {PageHeader} from '../../templates/PageHeader';
import {Alert} from '../../atoms/Alert';
import {Button} from '../../atoms/Button';
import {Card,CardBody} from '../../atoms/Card';
import {Input} from '../../atoms/Input';
import {Icon} from '../../atoms/Icon';
import {FormField} from '../../molecules/FormField';
import {MediaImage} from '../../atoms/MediaImage';
import {PaymentHistoryPanel} from '../../organisms/PaymentHistoryPanel';
import {PaymentDetailDialog} from '../../organisms/PaymentDetailDialog';
import {formatMoney,formatDate,formatColombiaDateTime} from '../../utils/format';
import type {QrPaymentView,PaymentHistoryEntry} from '../../types/payments';

export function PaymentReceiptsPage(){
  const view=useFetch<QrPaymentView>('/api/payment-receipts');
  const [tab,setTab]=useState<'history'|'pending'>('history'),[selected,setSelected]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[busy,setBusy]=useState<string|null>(null),[notes,setNotes]=useState('');
  const [recipient,setRecipient]=useState(''),[paymentKey,setPaymentKey]=useState(''),[file,setFile]=useState<File|null>(null);
  const history=view.data?.history??[],entry=history.find(row=>row.id===selected)??null,pending=history.filter(row=>row.status==='pendiente');
  const select=(row:PaymentHistoryEntry)=>{setSelected(row.id);setNotes('');setError(null);};
  const setQr=async(event:FormEvent)=>{event.preventDefault();if(!file||busy)return;setBusy('qr');setError(null);try{const body=new FormData();body.append('file',file);body.append('recipient',recipient.trim()||view.data?.qr.recipient||'');body.append('paymentKey',paymentKey.trim()||view.data?.qr.paymentKey||'');await api('/api/settings/payment-qr',{method:'POST',body});view.reload();setNotice('QR de pago actualizado.');}catch(err){setError(errorMessage(err));}finally{setBusy(null);}};
  const review=async(status:'aprobado'|'rechazado')=>{if(!entry?.receiptId||busy)return;setBusy('review');setError(null);setNotice(null);try{await api(`/api/payment-receipts/${entry.receiptId}/review`,{method:'PUT',json:{status,notes}});view.reload();setNotice(status==='aprobado'?'Pago confirmado. Ya aparece en el historial.':'Soporte rechazado. El registro se conserva en el historial.');setSelected(null);}catch(err){setError(errorMessage(err));}finally{setBusy(null);}};
  const debt=entry?view.data?.debts.find(row=>row.kind===entry.kind&&row.targetId===entry.targetId&&row.playerId===entry.playerId):null;
  return <>
    <PageHeader title="Pagos y comprobantes" subtitle="El historial del equipo, sin perder de vista lo pendiente" actions={<Button variant="outline" onClick={view.reload} disabled={view.loading}><Icon name="refresh" size={17}/> Actualizar</Button>}/>
    {view.error||error&&!entry?<Alert tone="error" className="mb-4">{view.error??error}</Alert>:null}{notice?<Alert tone="success" className="mb-4" onClose={()=>setNotice(null)}>{notice}</Alert>:null}
    <nav className="commerce-page-tabs" aria-label="Vistas de pagos"><button type="button" aria-pressed={tab==='history'} onClick={()=>setTab('history')}><Icon name="dinero" size={18}/> Historial completo</button><button type="button" aria-pressed={tab==='pending'} onClick={()=>setTab('pending')}><Icon name="clipboard" size={18}/> Por revisar <span>{pending.length}</span></button></nav>
    {tab==='history'?<PaymentHistoryPanel entries={history} onSelect={select} loading={view.loading}/>:<section className="payment-pending-workspace"><header className="commerce-heading"><div><span className="commerce-eyebrow">BANDEJA DE REVISIÓN</span><h2>Comprobantes pendientes<span>.</span></h2><p>Revisa el archivo antes de confirmar el pago.</p></div></header><div className="payment-pending-grid">{pending.map(row=><article key={row.id} className="commerce-mobile-card"><header><span>{row.kind==='inscription'?'Inscripción':row.kind==='referee'?'Arbitraje':'Uniforme'}</span><span className="commerce-status is-pendiente">En revisión</span></header><strong className="history-card-amount">{formatMoney(row.amount)}</strong><h3>{row.playerName}</h3><p>{row.concept}</p><div className="history-card-meta"><span>{formatDate(row.paidAt)}</span><span className="history-reference">{row.reference}</span></div><Button className="w-full mt-3" onClick={()=>select(row)}>Revisar comprobante <Icon name="eye" size={17}/></Button></article>)}</div>{!view.loading&&!pending.length?<div className="commerce-empty"><Icon name="check" size={38}/><h3>Todo revisado</h3><p>Los pagos anteriores siguen disponibles en Historial completo.</p></div>:null}</section>}
    <Card className="mt-6"><CardBody><details className="payment-qr-settings"><summary><Icon name="settings" size={18}/> Configurar QR del equipo <span>Ver configuración</span></summary><div className="grid gap-5 mt-5 sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)]">{view.data?.qr.assetId?<MediaImage src={'/api/media/'+view.data.qr.assetId} alt="QR de pago vigente" className="w-full bg-white rounded-xl"/>:<p className="text-sm">Sin QR configurado.</p>}<form className="space-y-4 min-w-0" onSubmit={event=>void setQr(event)}><FormField label="Titular"><Input value={recipient||view.data?.qr.recipient||''} onChange={event=>setRecipient(event.target.value)} maxLength={120}/></FormField><FormField label="Llave de pago"><Input value={paymentKey||view.data?.qr.paymentKey||''} onChange={event=>setPaymentKey(event.target.value)} maxLength={120}/></FormField><FormField label="Imagen del QR"><input type="file" required accept="image/jpeg,image/png,image/webp" className="file-input file-input-bordered w-full min-w-0" onChange={event=>setFile(event.target.files?.[0]??null)}/></FormField><Button loading={busy==='qr'} disabled={!!busy} type="submit">Actualizar QR</Button></form></div></details></CardBody></Card>
    <PaymentDetailDialog entry={entry} onClose={()=>setSelected(null)} busy={!!busy} footer={entry?.status==='pendiente'&&entry.receiptId?<><Button variant="ghost" disabled={!!busy} onClick={()=>setSelected(null)}>Cerrar</Button><Button variant="outline" disabled={!!busy} onClick={()=>void review('rechazado')}>Rechazar</Button><Button loading={busy==='review'} disabled={!!busy} onClick={()=>void review('aprobado')}>Confirmar abono</Button></>:undefined}>
      {entry?.kind==='referee'?<Alert tone="info" className="mt-4">Comprueba la fecha y hora contra el soporte. El plazo para ser titular es {debt?.dueAt?formatColombiaDateTime(debt.dueAt):'48 horas antes del partido'}.{debt?.creditApplied?` Saldo acumulado aplicado: ${formatMoney(debt.creditApplied)}.`:''}</Alert>:null}
      {entry?.status==='pendiente'?<label className="block mt-5 text-sm font-semibold">Observación para el jugador<Input className="mt-2" value={notes} maxLength={2000} disabled={!!busy} onChange={event=>setNotes(event.target.value)} placeholder="Motivo de rechazo o nota de validación"/></label>:null}{error&&entry?<Alert tone="error" className="mt-3">{error}</Alert>:null}
    </PaymentDetailDialog>
  </>;
}
