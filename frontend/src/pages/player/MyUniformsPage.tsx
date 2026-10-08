import {useState} from 'react';
import {useFetch} from '../../hooks/useFetch';
import {PageHeader} from '../../templates/PageHeader';
import {Alert} from '../../atoms/Alert';
import {Button} from '../../atoms/Button';
import {Spinner} from '../../atoms/Spinner';
import {UniformCatalog} from '../../organisms/UniformCatalog';
import {UniformOrderDialog} from '../../organisms/UniformOrderDialog';
import {UniformRequestsPanel} from '../../organisms/UniformRequestsPanel';
import {UniformIssueList} from '../../organisms/UniformIssueList';
import {QrPaymentPanel} from '../../organisms/QrPaymentPanel';
import type {MeUniformsResponse,Uniform} from '../../types/api';

export function MyUniformsPage() {
  const {data,loading,error,reload}=useFetch<MeUniformsResponse>('/api/me/uniforms');
  const [tab,setTab]=useState<'tienda'|'mis'>('tienda'),[selected,setSelected]=useState<Uniform|null>(null),[notice,setNotice]=useState<string|null>(null);
  if(loading)return <div className="flex justify-center py-20"><Spinner size="lg"/></div>;
  if(error)return <><PageHeader title="Tienda del equipo"/><Alert tone="error" onClose={reload}>{error}</Alert></>;
  return <>
    <PageHeader title="Tienda del equipo" subtitle="Tus colores, dentro y fuera de la cancha"/>
    <div role="tablist" aria-label="Uniformes y pedidos" className="tabs tabs-box mb-5 w-fit"><button type="button" role="tab" aria-selected={tab==='tienda'} className={`tab ${tab==='tienda'?'tab-active':''}`} onClick={()=>setTab('tienda')}>Tienda</button><button type="button" role="tab" aria-selected={tab==='mis'} className={`tab ${tab==='mis'?'tab-active':''}`} onClick={()=>setTab('mis')}>Mis pedidos ({data?.requests.length??0})</button></div>
    {notice?<div className="mb-5 space-y-2"><Alert tone="success" onClose={()=>setNotice(null)}>{notice}</Alert>{tab==='tienda'?<Button variant="outline" onClick={()=>setTab('mis')}>Ver QR y subir soporte →</Button>:null}</div>:null}
    {tab==='tienda'?<UniformCatalog uniforms={(data?.catalog??[]).filter(item=>item.active)} mode="player" onSelect={setSelected} emptyTitle="Próximamente: la colección del equipo" emptyMessage="El administrador está preparando las prendas."/>:<div className="space-y-6"><QrPaymentPanel kind="uniform" onSaved={reload} refreshKey={data}/><div><h2 className="font-semibold mb-3">Mis solicitudes</h2><UniformRequestsPanel requests={data?.requests??[]}/></div><div><h2 className="font-semibold mb-3">Prendas entregadas</h2><UniformIssueList issues={data?.issued??[]} showPlayer={false}/></div></div>}
    {selected?<UniformOrderDialog key={selected.id} uniform={selected} onClose={()=>setSelected(null)} onSaved={message=>{setNotice(message);setSelected(null);reload();}}/>:null}
  </>;
}
