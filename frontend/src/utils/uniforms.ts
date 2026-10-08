import type {UniformKind,UniformVariant,UniformRecipientInput,UniformRequest,UniformRequestStatus,Uniform} from '../types/api';
import {humanize} from './format';

export const UNIFORM_SIZES=['XS','S','M','L','XL','XXL'];
export const CHILD_SIZES=['2','4','6','8','10','12','14','16'];
export const uniformVariantLabel=(variant:UniformVariant)=>({titular:'Local',alterna:'Visitante',entrenamiento:'Entrenamiento'}[variant]);
export const uniformKindLabel=(kind:UniformKind)=>kind==='completo'?'Uniforme completo con medias':kind==='camiseta'?'Solo camiseta':humanize(kind);
export function uniformRecipientLabel(order:UniformRecipientInput):string {
  return order.recipientType==='pareja'?`Pareja · ${order.recipientName??''}`:order.recipientType==='hijo'?`Hijo/a · ${order.recipientName??''}`:'Jugador';
}
export const uniformContents=(kind:UniformKind)=>kind==='completo'?'Camiseta + pantaloneta + medias':kind==='camiseta'?'Una camiseta. Para ti o tu familia.':`Equipamiento · ${uniformKindLabel(kind)}`;
export interface RequestFilters {search:string;status:UniformRequestStatus|'';variant:UniformVariant|''}
export const normalizeUniformSearch=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export function filterUniformRequests(requests:UniformRequest[],filters:RequestFilters):UniformRequest[] {
  const search=normalizeUniformSearch(filters.search);
  return requests.filter(row=>(!filters.status||row.status===filters.status)&&(!filters.variant||row.uniformVariant===filters.variant)&&(!search||normalizeUniformSearch([row.id,row.playerName,row.playerShirtNumber,row.playerEmail,row.uniformName,row.recipientName,row.size,row.reason].join(' ')).includes(search)));
}
export function uniformRequestExportUrl(filters:RequestFilters):string {
  const query=new URLSearchParams();if(filters.status)query.set('status',filters.status);if(filters.variant)query.set('variant',filters.variant);if(filters.search.trim())query.set('search',filters.search.trim());
  return '/api/uniform-requests/export'+(query.size?'?'+query.toString():'');
}
export function filterUniformCatalog(uniforms:Uniform[],variant:UniformVariant|'',category:'all'|'completo'|'camiseta'|'equipamiento',search:string,sort:'featured'|'priceAsc'|'priceDesc'|'name'):Uniform[] {
  const query=normalizeUniformSearch(search);
  return uniforms.filter(item=>(!variant||item.variant===variant)&&(category==='all'||(category==='equipamiento'?!['completo','camiseta'].includes(item.kind):item.kind===category))&&(!query||normalizeUniformSearch([item.name,uniformKindLabel(item.kind),uniformVariantLabel(item.variant)].join(' ')).includes(query))).sort((a,b)=>sort==='priceAsc'?a.price-b.price:sort==='priceDesc'?b.price-a.price:sort==='name'?a.name.localeCompare(b.name,'es'):Number(b.kind==='completo')-Number(a.kind==='completo')||Number(Boolean(b.imageUrl))-Number(Boolean(a.imageUrl))||a.id-b.id);
}
