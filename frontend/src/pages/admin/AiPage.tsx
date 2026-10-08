import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { api, errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Badge } from '../../atoms/Badge';
import { Button } from '../../atoms/Button';
import { Card,CardBody,CardTitle } from '../../atoms/Card';
import { Select } from '../../atoms/Select';
import { Spinner } from '../../atoms/Spinner';
import { FormField } from '../../molecules/FormField';
import { LeagueContextPanel } from '../../molecules/LeagueContextPanel';
import { FormationPitch,pitchSlotsFrom } from '../../organisms/FormationPitch';
import { TacticalPlayboard } from '../../organisms/TacticalPlayboard';
import { RatingTrendChart } from '../../organisms/RatingTrendChart';
import { ProbabilityBars } from '../../organisms/ProbabilityBars';
import { AiInsightsPanel } from '../../organisms/AiInsightsPanel';
import { formatDateTime,formatRating } from '../../utils/format';
import type { AiInsights,Match,ModelInfo } from '../../types/api';
import type { TacticalPlan,TacticalStyle,CoachingResearch,TacticalPlay } from '../../types/tactics';

const styleNames={equilibrado:'Equilibrado',ofensivo:'Ofensivo',defensivo:'Defensivo'};
const roleNames={POR:'Portería',DEF:'Defensa',MED:'Mediocampo',DEL:'Ataque'};

export function AiPage(){
  const matches=useFetch<Match[]>('/api/matches'),insights=useFetch<AiInsights>('/api/ai/insights');
  const [targetId,setTargetId]=useState<number|null>(null),[style,setStyle]=useState<TacticalStyle|null>(null),[formation,setFormation]=useState('');
  const [plan,setPlan]=useState<TacticalPlan|null>(null),[loading,setLoading]=useState(false),[refresh,setRefresh]=useState(0);
  const [research,setResearch]=useState<CoachingResearch|null>(null),[playId,setPlayId]=useState('salida');
  const [error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[busy,setBusy]=useState<string|null>(null);
  const list=matches.data??[];
  const defaultMatch=[...list].filter(m=>m.status==='programado'&&new Date(m.kickOff+'-05:00').getTime()>=Date.now()).sort((a,b)=>a.kickOff.localeCompare(b.kickOff))[0];
  const selected=list.find(m=>m.id===(targetId??defaultMatch?.id));
  const selectedId=selected?.id;
  const activeStyle=style??selected?.tournamentRules?.tacticalStyle??'equilibrado';
  useEffect(()=>{
    if(!selectedId)return;
    let current=true;setLoading(true);setPlan(null);setResearch(null);setError(null);setNotice(null);
    api<TacticalPlan>('/api/ai/tactical-plan',{method:'POST',json:{matchId:selectedId,style:activeStyle,...(formation?{formation}: {})}})
      .then(data=>{if(current)setPlan(data);}).catch(err=>{if(current)setError(errorMessage(err));}).finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[selectedId,activeStyle,formation,refresh]);
  const editable=selected?.status==='programado'||selected?.status==='pospuesto';
  const apply=async()=>{
    if(!plan || !editable)return;setBusy('apply');setError(null);setNotice(null);
    try{
      if(plan.recommendation.lineup.length!==plan.match.format)throw new Error('La alineación no corresponde al formato del partido.');
      await api(`/api/matches/${plan.match.id}/formation`,{method:'PUT',json:{formation:plan.recommendation.formation}});
      await api(`/api/matches/${plan.match.id}/lineup`,{method:'PUT',json:{slots:plan.recommendation.lineup.map(s=>({slotIndex:s.slotIndex,playerId:s.playerId,x:s.x,y:s.y,role:s.role,label:s.label}))}});
      setNotice(`${plan.match.format} inicial guardado como borrador. Revisa y publica desde el tablero del partido.`);matches.reload();
    }catch(err){setError(errorMessage(err));}finally{setBusy(null);}
  };
  const lookup=async()=>{
    if(!plan)return;setBusy('research');setError(null);
    const requested=plan.match.id,requestedStyle=plan.style;
    try{const result=await api<CoachingResearch>('/api/ai/research',{method:'POST',json:{matchId:requested,style:requestedStyle}});setResearch(result);}
    catch(err){setError(errorMessage(err));}finally{setBusy(null);}
  };
  const savePlay=async(play:TacticalPlay)=>{
    if(!plan||!editable)return;setBusy(play.id);setError(null);
    try{await api(`/api/matches/${plan.match.id}/strategies`,{method:'POST',json:{title:play.title,kind:play.id==='transicion'?'transicion':play.phase==='Sin balón'?'defensa':'ataque',
      content:[`Fútbol ${plan.match.format} · ${plan.recommendation.formation} · ${plan.match.minutes} min · ${styleNames[plan.style]}`,play.objective,...play.steps.map((s,i)=>`${i+1}. ${s}`),play.coaching,`Referencia: ${play.source.url}`].join('\n')}});
      setNotice('Jugada guardada en las estrategias del partido y disponible para sus jugadores.');
    }catch(err){setError(errorMessage(err));}finally{setBusy(null);}
  };
  const train=async()=>{setBusy('train');setError(null);try{await api<ModelInfo>('/api/ai/model/train',{method:'POST'});insights.reload();setRefresh(r=>r+1);setNotice('Modelo reentrenado.');}catch(err){setError(errorMessage(err));}finally{setBusy(null);}};
  const activePlay=plan?.plays.find(p=>p.id===playId)??plan?.plays[0];
  const prediction=insights.data?.nextMatchPrediction;
  return <>
    <PageHeader title="Laboratorio deportivo" subtitle={selected?`Fútbol ${selected.format} · ${selected.minutes} minutos · preparación de vs ${selected.opponent}`:'Alineaciones, formaciones y jugadas para el equipo'} actions={selected?<Badge tone="primary">{selected.format} inicial</Badge>:undefined} />
    <Card className="mb-4"><CardBody><div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] items-end">
      <FormField label="Partido a analizar"><Select value={selectedId??''} disabled={busy!==null} onChange={e=>{setTargetId(Number(e.target.value));setFormation('');setStyle(null);}}>
        {!selected?<option value="">{list.length?'Elige un partido para revisar':'Sin partidos'}</option>:null}{list.map(m=><option key={m.id} value={m.id}>{m.kickOff.slice(0,10)} · {m.opponent} · F{m.format} · {m.minutes} min · {m.status}</option>)}
      </Select></FormField>
      <FormField label="Estilo a evaluar"><Select value={activeStyle} disabled={busy!==null} onChange={e=>{setStyle(e.target.value as TacticalStyle);setFormation('');}}>{Object.entries(styleNames).map(([value,label])=><option value={value} key={value}>{label}</option>)}</Select></FormField>
      <Button variant="outline" disabled={!selected||loading||busy!==null} onClick={()=>setRefresh(r=>r+1)}>Actualizar análisis</Button>
    </div><p className="text-xs text-base-content/60">El estilo permite comparar escenarios. Las reglas del torneo y su duración se mantienen en el análisis.</p></CardBody></Card>
    {error||matches.error?<Alert tone="error" className="mb-4">{error??matches.error}</Alert>:null}{notice?<Alert tone="success" className="mb-4">{notice}</Alert>:null}
    {loading||matches.loading?<div className="flex justify-center p-12"><Spinner size="lg" /></div>:null}
    {!matches.loading&&!selected?<Alert tone="info">Programa un partido para preparar la alineación y las jugadas.</Alert>:null}
    {plan?<>
      <LeagueContextPanel context={plan.recommendation.leagueContext} />
      <Card className="my-4"><CardBody className="gap-4">
        <div className="flex flex-wrap justify-between items-center gap-3"><div><CardTitle>{plan.match.format} inicial recomendado</CardTitle><p className="text-sm text-base-content/60">{plan.recommendation.formation} · {styleNames[plan.style]} · {plan.recommendation.lineup.filter(s=>s.playerId!==null).length}/{plan.match.format} puestos cubiertos</p></div><div className="flex flex-wrap gap-2"><Link className="btn btn-outline btn-sm" to={`/admin/partidos/${plan.match.id}`}>Ver tablero</Link><Button onClick={()=>void apply()} disabled={!editable||busy!==null} loading={busy==='apply'}>Guardar como borrador</Button></div></div>
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <FormationPitch slots={pitchSlotsFrom(plan.recommendation.formation,plan.recommendation.lineup,plan.match.format)} format={plan.match.format} />
          <div className="space-y-3"><p className="text-sm">{plan.recommendation.explanation}</p>
            <ul className="space-y-2">{plan.recommendation.lineup.map(s=><li key={s.slotIndex} className="flex items-center gap-3 rounded-lg bg-base-200 px-3 py-2"><span className="badge badge-neutral w-12">{s.label}</span><span className="text-sm flex-1">{s.playerName??'Vacante'}{s.playerPosition&&s.playerPosition!==s.role?' · posición adaptada':''}</span><span className="font-semibold">{s.shirtNumber??'—'}</span></li>)}</ul>
            <p className="text-sm"><strong>Banco:</strong> {plan.recommendation.bench.map(p=>p.playerName).join(', ')||'Sin suplentes disponibles'}</p>
          </div>
        </div>
      </CardBody></Card>
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Card><CardBody><CardTitle className="text-base">Cobertura por posición</CardTitle><p className="text-xs text-base-content/60">Disponible incluye posición secundaria; un jugador puede aparecer en más de una posición.</p>
          {plan.positions.map(p=>{const max=Math.max(...plan.positions.map(r=>Math.max(r.available,r.needed)),1);return <div key={p.role} className="space-y-1"><div className="flex justify-between text-sm"><span>{roleNames[p.role]}</span><span>{p.available} disponibles / {p.needed} necesarios</span></div><div className="h-3 rounded-full bg-base-200 relative"><div className="h-full rounded-full bg-primary" style={{width:`${p.available/max*100}%`}} /><span className="absolute top-0 h-3 border-r-2 border-base-content" style={{left:`${p.needed/max*100}%`}} /></div><p className="text-xs text-base-content/60">{p.primary} de posición principal · rendimiento previsto {formatRating(p.avgRating,2)}</p></div>;})}
        </CardBody></Card>
        <Card><CardBody><CardTitle className="text-base">Comparación de formaciones</CardTitle><p className="text-xs text-base-content/60">Se evalúan solo las formaciones permitidas en el torneo. El índice combina encaje, vacantes y estilo; no es una probabilidad de ganar.</p>
          {plan.formations.map(f=><div key={f.key} className="rounded-xl border border-base-200 p-3 space-y-2"><div className="flex justify-between gap-2 items-center"><strong>{f.key}</strong><Button size="xs" variant={f.key===plan.recommendation.formation?'primary':'outline'} disabled={loading||busy!==null} onClick={()=>setFormation(f.key)}>{f.key===plan.recommendation.formation?'En cancha':'Evaluar'}</Button></div><progress className="progress progress-primary w-full" aria-label={`Encaje ${f.key}`} value={Math.max(0,f.score)} max={plan.match.format*10} /><p className="text-xs">Índice {f.score.toFixed(2)} · {f.filled}/{plan.match.format} cubiertos · {f.naturalFit} en posición principal · rating {f.avgRating.toFixed(2)}</p></div>)}
        </CardBody></Card>
      </div>
      <Card className="mb-4"><CardBody className="gap-4"><div className="flex flex-wrap justify-between gap-3"><div><CardTitle>Jugar con una idea</CardTitle><p className="text-sm text-base-content/60">Jugadas adaptadas al {plan.match.format} inicial y a sus posiciones.</p></div><Button variant="outline" onClick={()=>void lookup()} disabled={busy!==null} loading={busy==='research'}>Consultar recursos en internet</Button></div>
        <div className="flex gap-2 flex-wrap">{plan.plays.map(p=><Button key={p.id} size="sm" variant={activePlay?.id===p.id?'primary':'outline'} onClick={()=>setPlayId(p.id)}>{p.title}</Button>)}</div>
        {activePlay?<div className="grid gap-5 lg:grid-cols-2 items-start"><TacticalPlayboard key={`${plan.match.id}:${plan.recommendation.formation}:${activePlay.id}`} play={activePlay} slots={plan.recommendation.lineup} /><div className="space-y-3"><h3 className="font-semibold text-lg">{activePlay.title}</h3><p>{activePlay.objective}</p><ol className="list-decimal pl-5 space-y-3 text-sm">{activePlay.steps.map((s,i)=><li key={i}>{s}</li>)}</ol><p className="rounded-xl bg-base-200 p-3 text-sm">{activePlay.coaching}</p><a className="link text-sm" href={activePlay.source.url} target="_blank" rel="noreferrer">Referencia: {activePlay.source.title} · FIFA</a><div><Button size="sm" onClick={()=>void savePlay(activePlay)} disabled={!editable||busy!==null} loading={busy===activePlay.id}>Guardar jugada en el partido</Button></div></div></div>:null}
        <div className="rounded-xl bg-primary/10 p-4"><h3 className="font-semibold">Rotación durante el partido</h3><p className="text-sm mt-1">{plan.rotation}</p></div>
        {research&&research.style===plan.style?<div className="space-y-2 border-t border-base-200 pt-4"><h3 className="font-semibold">Recursos del FIFA Training Centre</h3><p className="text-sm">{research.query} · consulta {formatDateTime(research.checkedAt)}</p>{research.status!=='consultado'?<Alert tone="info">{research.status==='parcial'?'Algunos recursos no respondieron.':'La consulta web no estuvo disponible.'} Conservamos los enlaces de referencia para que puedas abrirlos.</Alert>:null}{research.sources.map(s=><div key={s.url}><a className="link text-sm" href={s.url} target="_blank" rel="noreferrer">{s.title}</a><p className="text-xs text-base-content/60">{s.topic} · {s.verified?'Consultado en línea':'Referencia; acceso sin confirmar'}</p></div>)}</div>:null}
        <p className="text-xs text-base-content/60">{plan.methodology} La búsqueda se realiza en la biblioteca oficial de FIFA por estilo y conserva referencias si no hay conexión. Las jugadas requieren revisión del entrenador.</p>
      </CardBody></Card>
    </>:null}
    {insights.error?<Alert tone="error">{insights.error}</Alert>:null}
    {insights.data?<details className="mt-4"><summary className="cursor-pointer font-semibold p-4 rounded-xl bg-base-200">Rendimiento del equipo y métricas del modelo</summary><div className="grid gap-4 lg:grid-cols-2 mt-4">
      <Card><CardBody><CardTitle className="text-base">Forma del equipo</CardTitle><RatingTrendChart title="Rating promedio por partido" points={insights.data.formTrend.map(f=>({label:f.opponent,value:f.rating}))} /><AiInsightsPanel insights={insights.data.insights} /></CardBody></Card>
      <Card><CardBody><CardTitle className="text-base">Próximo partido programado</CardTitle>{prediction?<><p>{prediction.opponent} · F{prediction.format} · {formatDateTime(prediction.kickOff)}</p><ProbabilityBars {...prediction} /></>:<p>Sin próximo partido.</p>}
        <h3 className="font-semibold">Modelo de rendimiento</h3><p className="text-sm">{insights.data.model.metrics.samples} muestras · MAE de entrenamiento {formatRating(insights.data.model.metrics.mae,3)}</p>
        {insights.data.model.validation?<p className="text-sm">Evaluación en partidos posteriores: {insights.data.model.validation.samples} muestras · MAE {formatRating(insights.data.model.validation.mae,3)} · RMSE {formatRating(insights.data.model.validation.rmse,3)}</p>:null}
        <Button size="sm" disabled={busy!==null} loading={busy==='train'} onClick={()=>void train()}>Reentrenar modelo</Button>
        <h3 className="font-semibold">Jugadores mejor valorados</h3>{insights.data.topPlayers.map(p=><p className="text-sm" key={p.playerId}>{p.playerName} · previsto {formatRating(p.predictedRating,2)} · promedio {formatRating(p.avgRating,2)}</p>)}
      </CardBody></Card>
    </div></details>:null}
  </>;
}
