import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import type { AiPlayerInsight, PlayerListItem } from '../types/api';
import { IndividualPreparation } from './IndividualPreparation';
import { Alert } from '../atoms/Alert';
import { Spinner } from '../atoms/Spinner';

/** Individual coaching remains accessible even before the first fixture exists. */
export function AdminPlayerPreparation() {
  const roster = useFetch<PlayerListItem[]>('/api/players');
  const [selectedId,setSelectedId] = useState('');
  const players = (roster.data??[]).filter(item=>item.user.active&&!item.pendingApproval);
  const selected = players.find(item=>String(item.player.id)===selectedId)??players.find(item=>item.player.position==='POR')??players[0];
  const analysis = useFetch<AiPlayerInsight>(selected?`/api/ai/players/${selected.player.id}`:null);
  const current = analysis.data?.playerId===selected?.player.id?analysis.data:null;
  return <section className="my-5 space-y-4" aria-label="Enfoque individual del plantel">
    <div className="rounded-2xl border border-base-200 bg-base-100 p-4 sm:p-5 flex flex-wrap gap-4 items-end">
      <div className="flex-1 min-w-0"><h2 className="font-bold text-lg">Enfoque individual del plantel</h2><p className="text-sm text-base-content/65">Portero, defensa, mediocampo y ataque: prepara a cada integrante aunque todavía no haya partido.</p></div>
      <label className="grid gap-2 text-sm w-full sm:w-72">Jugador para preparar<select className="select select-bordered w-full" value={selected?.player.id??''} disabled={!players.length} onChange={event=>setSelectedId(event.target.value)}>{players.length?players.map(item=><option key={item.player.id} value={item.player.id}>{item.player.position==='POR'?'Portero':'Jugador'} · {item.user.fullName} · #{item.player.shirtNumber??'—'}</option>):<option value="">Sin jugadores activos</option>}</select></label>
      <button className="btn btn-outline btn-sm" type="button" disabled={analysis.loading||roster.loading} onClick={()=>{roster.reload();analysis.reload();}}>Actualizar plantel</button>
    </div>
    {roster.error||analysis.error?<Alert tone="error">{roster.error??analysis.error}</Alert>:null}
    {(roster.loading||analysis.loading)&&!current?<div className="flex justify-center py-8"><Spinner/></div>:null}
    {current?<IndividualPreparation key={`${current.playerId}:${current.preparation.role}:${current.preparation.matchId}:${current.preparation.publishedAt}`} insight={current}/>:null}
  </section>;
}
