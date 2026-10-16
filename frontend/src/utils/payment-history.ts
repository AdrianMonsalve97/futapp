import type {PaymentHistoryEntry,PaymentTargetKind} from '../types/payments';
export type PaymentCategory='all'|'inscription'|'uniform'|'referee';
export interface HistoryFilters {search:string;category:PaymentCategory;status:string;from:string;to:string}
export const paymentCategory=(kind:PaymentTargetKind)=>kind==='inscription'?'Inscripción':kind==='referee'?'Arbitraje':'Uniforme';
export const paymentMethod=(method:string)=>({qr:'QR',efectivo:'Efectivo',transferencia:'Transferencia',tarjeta:'Tarjeta',saldo_anterior:'Saldo anterior'}[method]??method);
export const paymentStatus=(status:string)=>({pendiente:'En revisión',aprobado:'Confirmado',rechazado:'Rechazado'}[status]??status);
const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function paymentDay(value:string|null){
  if(!value)return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  const date=new Date(value.includes('T')?value:value.replace(' ','T')+'Z');if(!Number.isFinite(date.getTime()))return '';
  const parts=new Intl.DateTimeFormat('en',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),get=(key:string)=>parts.find(part=>part.type===key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function filterPaymentHistory(rows:PaymentHistoryEntry[],filters:HistoryFilters){
  const search=fold(filters.search.trim());
  return rows.filter(row=>{
    if(filters.category==='uniform'&&!['uniform_request','uniform_issue'].includes(row.kind))return false;
    if(filters.category!=='all'&&filters.category!=='uniform'&&row.kind!==filters.category)return false;
    if(filters.status&&filters.status!==row.status)return false;
    const day=paymentDay(row.paidAt);if((filters.from&&(!day||day<filters.from))||(filters.to&&(!day||day>filters.to)))return false;
    return !search||fold([row.playerName,row.concept,row.reference,row.notes,paymentCategory(row.kind),paymentMethod(row.method)].join(' ')).includes(search);
  });
}
