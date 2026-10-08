import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AiPlayerInsight } from '../types/api';
import { Card, CardBody, CardTitle } from '../atoms/Card';
import { Button } from '../atoms/Button';
import { FormationPitch, pitchSlotsFrom } from './FormationPitch';
import { TacticalPlayboard } from './TacticalPlayboard';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../atoms/Avatar';
import type { PitchPhase } from '../utils/pitch-layout';

const roles = {POR:'portero',DEF:'defensor',MED:'mediocampista',DEL:'delantero'};
const phases: {id:PitchPhase;title:string;hint:string}[] = [
  {id:'estructura',title:'Posición base',hint:'Reconoce tu zona y los apoyos de tus compañeros.'},
  {id:'ataque',title:'Con balón',hint:'El bloque avanza: ofrece una línea de pase y conserva cobertura.'},
  {id:'repliegue',title:'Sin balón',hint:'El bloque retrocede: protege el centro y coordina las marcas.'},
];

export function IndividualPreparation({insight}:{insight:AiPlayerInsight}) {
  const {user} = useAuth();
  const plan = insight.preparation;
  const [playId,setPlayId] = useState(plan.role==='POR'?'portero':'salida');
  const [phase,setPhase] = useState<PitchPhase>('estructura');
  const [lesson,setLesson] = useState(0);
  const [completed,setCompleted] = useState<string[]>([]);
  const official = Boolean(plan.publishedAt);
  const slots = pitchSlotsFrom(plan.formation,official?plan.lineup:plan.trainingLineup,plan.format)
    .map(slot=>({...slot,playerId:slot.playerId??null,highlighted:slot.playerId===insight.playerId}));
  const assigned = new Set(slots.map(slot=>slot.playerId));
  const remaining = (plan.teammates??[]).filter(player=>!assigned.has(player.playerId));
  const play = plan.plays.find(item=>item.id===playId)??plan.plays[0];
  const activeLesson = plan.individual[lesson]??plan.individual[0];
  const toggle = (item:string) => setCompleted(current=>current.includes(item)?current.filter(value=>value!==item):[...current,item]);
  const goalkeeperHint = phase==='ataque'?'Ofrece una salida por detrás del balón y mira ambos lados antes de recibir.':phase==='repliegue'?'Reajusta el ángulo, comunica las marcas y decide la salida junto con la defensa.':'Alinea balón, cuerpo y arco; comprueba la posición de tu defensa.';

  return <Card className="preparation-lab"><CardBody className="gap-5">
    <div className="preparation-heading">
      <Avatar name={insight.playerName} src={insight.avatarUrl} size="lg"/>
      <div className="flex-1 min-w-0"><p className="text-xs uppercase tracking-widest text-primary mb-1">Tu sesión deportiva · {insight.playerName}</p>
        <CardTitle>Enfoque de {roles[plan.role]}</CardTitle>
        <p className="text-sm text-base-content/65">{plan.opponent?`vs. ${plan.opponent}`:'Entrenamiento del plantel'} · F{plan.format} · {plan.minutes} min · {plan.style}</p>
      </div>
      {plan.matchId?<Link className="btn btn-outline btn-sm" to={`/${user?.role==='admin'?'admin':'jugador'}/partidos/${plan.matchId}`}>Ver partido</Link>:null}
    </div>
    <div className="rounded-xl bg-primary/10 p-4 text-sm">
      {official ? plan.assignment==='titular'?'Estás en el inicial publicado. Tu ubicación se resalta en dorado.':'No figuras en el inicial publicado. Prepara tu rol y coordina tu posible relevo con el entrenador.' :
        plan.trainingScope==='partido'?'Mapa de entrenamiento con jugadores habilitados para este partido. El entrenador todavía debe decidir y publicar el inicial.':'Mapa de entrenamiento del plantel disponible. Los puestos se cubren por posición; esta propuesta no es una convocatoria ni una inscripción a un torneo.'}
    </div>
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <div className="space-y-4 min-w-0">
        <h3 className="font-semibold">{official?'Alineación publicada':'Mapa de entrenamiento'} · {plan.formation}</h3>
        <div className="flex gap-2 flex-wrap" aria-label="Escenarios de posición">
          {phases.map(item=><button key={item.id} type="button" className="btn btn-sm min-h-11" aria-pressed={phase===item.id} onClick={()=>setPhase(item.id)} data-active={phase===item.id}>{item.title}</button>)}
        </div>
        <div className="w-full max-w-[500px] mx-auto"><FormationPitch slots={slots} format={plan.format} phase={phase} focusRole={plan.role}/></div>
        <p className="preparation-scenario" aria-live="polite">{plan.role==='POR'?goalkeeperHint:phases.find(item=>item.id===phase)?.hint} El movimiento es esquemático; las distancias reales dependen de la cancha.</p>
        {!insight.avatarUrl?<p className="text-xs text-base-content/65">Falta la foto de este jugador. {user?.role!=='admin'?<Link className="link" to="/jugador/perfil">Sube tu foto en Mi perfil.</Link>:'Puede subirla desde Mi perfil al entrar con su cuenta.'}</p>:null}
        {remaining.length ? <div><h4 className="text-sm font-semibold mb-2">{official?'Otros jugadores habilitados':'Más compañeros para rotar'} · {remaining.length}</h4><div className="preparation-teammates">
          {remaining.map(player=><div key={player.playerId} className="flex items-center gap-2 rounded-xl bg-base-200 p-3"><Avatar name={player.playerName} src={player.avatarUrl} size="sm"/><div className="min-w-0"><p className="text-xs font-semibold break-words">{player.playerName}</p><span className="text-xs text-base-content/65">#{player.shirtNumber??'—'} · {roles[player.position]}</span></div></div>)}
        </div></div>:null}
        {plan.publishedAt?<p className="text-xs text-base-content/55">Publicación: {new Date(plan.publishedAt).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</p>:null}
      </div>
      <div className="space-y-5 min-w-0">
        <div><h3 className="font-semibold mb-3">{plan.role==='POR'?'Laboratorio del portero':'Tu misión en cancha'}</h3>
          <div className="flex flex-wrap gap-2" aria-label="Objetivos individuales">
            {plan.individual.map((item,index)=><button type="button" key={item.title} aria-pressed={lesson===index} className="preparation-objective" onClick={()=>setLesson(index)}><span>{String(index+1).padStart(2,'0')}</span>{item.title}</button>)}
          </div>
          {activeLesson?<div key={activeLesson.title} className="preparation-lesson mt-4 p-5 rounded-xl bg-base-200" aria-live="polite"><h4 className="font-bold">{activeLesson.title}</h4><p className="text-sm text-base-content/75 mt-2 leading-relaxed">{activeLesson.detail}</p></div>:null}
        </div>
        <div><h3 className="font-semibold mb-3">Tu rol para el equipo</h3><ul className="space-y-3 text-sm">{plan.team.map(item=><li key={item} className="border-l-2 border-primary/40 pl-3">{item}</li>)}</ul></div>
        <div className="rounded-2xl border border-primary/20 p-4 space-y-3">
          <div className="flex justify-between gap-3"><h3 className="font-semibold">Mi rutina de preparación</h3><span className="text-sm font-semibold">{completed.length}/{plan.training.length}</span></div>
          <progress className="progress progress-primary w-full" aria-label="Ejercicios completados en esta sesión" value={completed.length} max={Math.max(1,plan.training.length)}/>
          {plan.training.map(item=><label key={item} className="preparation-task"><input className="checkbox checkbox-primary checkbox-sm shrink-0" type="checkbox" checked={completed.includes(item)} onChange={()=>toggle(item)}/><span>{item}</span></label>)}
          <p className="text-xs text-base-content/55" aria-live="polite">{completed.length===plan.training.length?'Rutina marcada como completada. Repasa ahora una jugada con tus compañeros.':'Marca lo que practiques. Este progreso corresponde a la sesión abierta.'}</p>
        </div>
      </div>
    </div>
    <div className="border-t border-base-200 pt-5 space-y-4"><h3 className="font-semibold">Ensaya la jugada con tus compañeros</h3>
      <div className="flex flex-wrap gap-3">{plan.plays.map(item=><Button key={item.id} size="sm" variant={item.id===play?.id?'primary':'outline'} aria-pressed={item.id===play?.id} onClick={()=>setPlayId(item.id)}>{item.title}</Button>)}</div>
      {play?<div className="grid gap-5 lg:grid-cols-2 items-start"><TacticalPlayboard key={`${plan.matchId}:${play.id}`} play={play} slots={slots}/><div className="space-y-3"><h4 className="font-semibold">{play.title}</h4><p>{play.objective}</p><ol className="list-decimal pl-5 space-y-3 text-sm">{play.steps.map(item=><li key={item}>{item}</li>)}</ol><p className="text-sm rounded-xl bg-base-200 p-4">{play.coaching}</p><a className="link text-sm" href={play.source.url} target="_blank" rel="noreferrer">Referencia deportiva: FIFA Training Centre</a></div></div>:null}
    </div>
    <p className="text-xs text-base-content/60">{plan.metricNote} El entrenador decide la aplicación de estas estrategias.</p>
  </CardBody></Card>;
}
