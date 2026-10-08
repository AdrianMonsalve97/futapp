import type {UniformRequest,UniformRequestStatus,UniformVariant} from './entities';
export interface UniformRequestFilters { search?:string;status?:UniformRequestStatus;variant?:UniformVariant }
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export function filterUniformRequests(requests:UniformRequest[],filters:UniformRequestFilters):UniformRequest[] {
  const search=normalized(filters.search??'');
  return requests.filter(row=>(!filters.status||row.status===filters.status)&&(!filters.variant||row.uniformVariant===filters.variant)&&(!search||normalized([row.id,row.playerName,row.playerShirtNumber,row.playerEmail,row.uniformName,row.recipientName,row.size,row.reason].join(' ')).includes(search)));
}
