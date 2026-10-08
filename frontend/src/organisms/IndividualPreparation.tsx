import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AiPlayerInsight } from '../types/api';
import { Card,CardBody,CardTitle } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { FormationPitch,pitchSlotsFrom } from './FormationPitch';
import { TacticalPlayboard } from './TacticalPlayboard';
import { useAuth } from '../context/AuthContext';
const roles={POR:'portero',DEF:'defensor',MED:'mediocampista',DEL:'delantero'};
export function IndividualPreparation({insight}:{insight:AiPlayerInsight}){
  const {user}=useAuth();
  const plan=insight.preparation;const [playId,setPlayId]=useState(plan.role==='POR'?'portero':'salida');
  const slots=pitchSlotsFrom(plan.formation,plan.lineup,plan.format).map(s=>({...s,playerId:s.playerId??null,highlighted:s.playerId===insight.playerId}));
  const play=plan.plays.find(p=>p.id===playId)??plan.plays[0];
  return <Card><CardBody className="gap-5"><div className="flex flex-wrap justify-between gap-4"><div><CardTitle>Enfoque de {roles[plan.role]}</CardTitle><p className="text-sm text-base-content/65">{plan.opponent?`vs. ${plan.opponent}`:'Preparación del equipo'} · F{plan.format} · {plan.minutes} min · {plan.style}</p></div>{plan.matchId?<Link className="btn btn-outline btn-sm" to={`/${user?.role==='admin'?'admin':'jugador'}/partidos/${plan.matchId}`}>Ver partido</Link>:null}</div>
    <div className="grid gap-5 xl:grid-cols-2"><div className="space-y-3"><h3 className="font-semibold">Alineación publicada · {plan.formation}</h3><FormationPitch slots={slots} format={plan.format}/>
      <p className="text-sm text-base-content/65">{plan.assignment==='sin_partido'?'Programa un partido para vincular este enfoque a una alineación.':plan.assignment==='sin_publicar'?'La alineación aún no está publicada. Se muestran posiciones de referencia; los nombres aparecerán cuando el entrenador la publique.':plan.assignment==='titular'?'Estás en el inicial; tu posición aparece resaltada.':'No figuras en el inicial publicado. Prepara tu rol y coordina el posible relevo con el entrenador.'}</p>
      {plan.publishedAt?<p className="text-xs text-base-content/55">Publicación: {new Date(plan.publishedAt).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</p>:null}
    </div><div className="grid gap-3">{plan.individual.map(item=><div key={item.title} className="rounded-xl bg-base-200 p-4"><h3 className="font-semibold text-sm">{item.title}</h3><p className="text-sm text-base-content/70 mt-1">{item.detail}</p></div>)}</div></div>
    <div className="grid gap-5 sm:grid-cols-2"><div><h3 className="font-semibold mb-3">Tu rol para el equipo</h3><ul className="list-disc pl-5 space-y-3 text-sm">{plan.team.map(item=><li key={item}>{item}</li>)}</ul></div><div><h3 className="font-semibold mb-3">Qué practicar</h3><ul className="list-disc pl-5 space-y-3 text-sm">{plan.training.map(item=><li key={item}>{item}</li>)}</ul></div></div>
    <h3 className="font-semibold">Ensaya la jugada</h3><div className="flex flex-wrap gap-3">{plan.plays.map(p=><Button key={p.id} size="sm" variant={p.id===play?.id?'primary':'outline'} onClick={()=>setPlayId(p.id)}>{p.title}</Button>)}</div>
    {play?<div className="grid gap-5 lg:grid-cols-2"><TacticalPlayboard key={`${plan.matchId}:${play.id}`} play={play} slots={slots}/><div className="space-y-3"><p>{play.objective}</p><ol className="list-decimal pl-5 space-y-3 text-sm">{play.steps.map(s=><li key={s}>{s}</li>)}</ol><p className="text-sm">{play.coaching}</p><a className="link text-sm" href={play.source.url} target="_blank" rel="noreferrer">Referencia deportiva: FIFA Training Centre</a></div></div>:null}
    <p className="text-xs text-base-content/60">{plan.metricNote} Estas estrategias son una guía de preparación basada en el rol y la normativa; el entrenador decide su aplicación.</p>
  </CardBody></Card>;
}
