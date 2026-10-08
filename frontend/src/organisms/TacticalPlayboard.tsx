import { useEffect, useId, useState } from 'react';
import { PitchPortrait } from './PitchPortrait';
import { Button } from '../atoms/Button';
import type { LineupSlot } from '../types/api';
import type { TacticalPlay } from '../types/tactics';

export function TacticalPlayboard({play,slots}:{play:TacticalPlay;slots:LineupSlot[]}) {
  const [step,setStep]=useState(0);const arrow=useId().replaceAll(':','');
  const [playing,setPlaying]=useState(false);
  const route=play.route.map(i=>slots.find(s=>s.slotIndex===i)).filter((s):s is LineupSlot=>Boolean(s));
  const ball=route[Math.min(step,route.length-1)];
  useEffect(()=>{
    if (!playing || route.length<2) return;
    const timer=setTimeout(()=>{
      const next=Math.min(step+1,route.length-1);setStep(next);
      if(next>=route.length-1)setPlaying(false);
    },1800);
    return ()=>clearTimeout(timer);
  },[playing,route.length,step]);
  return <div className="space-y-3">
    <svg viewBox="0 0 100 100" role="img" aria-label={`${play.title}: ${slots.length} posiciones, paso ${step+1}`} className="tactical-playboard w-full max-w-[360px] mx-auto rounded-2xl shadow-lg">
      <defs><marker id={arrow} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0 0 L4 2 L0 4" fill="#e8d193" /></marker></defs>
      <path d="M5 5H95V95H5Z M5 50H95 M32 5V20H68V5 M32 95V80H68V95" fill="none" stroke="#ffffff66" strokeWidth="0.5" /><circle cx="50" cy="50" r="9" fill="none" stroke="#ffffff66" strokeWidth="0.5" />
      {route.slice(1).map((to,index)=>{const from=route[index];return <path key={index} d={`M${from.x} ${from.y}L${to.x} ${to.y}`} stroke="#e8d193" strokeWidth="1" fill="none" strokeDasharray={play.phase==='Sin balón'?'2 2':undefined} opacity={index<step?1:0.3} markerEnd={`url(#${arrow})`} />;})}
      {slots.map(s=><g key={s.slotIndex} transform={`translate(${s.x} ${s.y})`}><title>{s.playerName??'Vacante'} · {s.label}</title>{ball?.slotIndex===s.slotIndex?<circle className="pitch-own-ring" r="5.4" stroke="#e9c76e" fill="none" strokeWidth="0.6"/>:null}<PitchPortrait src={s.avatarUrl} name={s.playerName} number={s.shirtNumber} label={s.label} role={s.role} radius={3.9} occupied={!!s.playerId}/><text y="7.3" textAnchor="middle" fontSize="2.6" fill="white" stroke="#082219" strokeWidth="0.5" paintOrder="stroke">{s.playerName?.split(' ')[0]??'Vacante'}</text></g>)}
      {ball?<circle className="tactical-ball" cx={ball.x+5} cy={ball.y-3} r="1.8" fill="white" stroke="#102016" strokeWidth="0.7"/>:null}
    </svg>
    <div className="flex flex-wrap items-center justify-center gap-3"><Button size="sm" variant="outline" disabled={step===0} onClick={()=>{setPlaying(false);setStep(s=>s-1);}}>Anterior</Button><span className="text-sm" aria-live="polite">Paso {step+1}/{Math.max(1,route.length)}</span><Button size="sm" variant="outline" disabled={step>=route.length-1} onClick={()=>{setPlaying(false);setStep(s=>s+1);}}>Siguiente</Button><Button size="sm" disabled={route.length<2} variant={playing?'outline':'primary'} onClick={()=>{if(!playing && step>=route.length-1)setStep(0);setPlaying(value=>!value);}}>{playing?'Pausar':'Reproducir jugada'}</Button></div>
  </div>;
}
