import { useId, useState } from 'react';
import { Button } from '../atoms/Button';
import type { LineupSlot } from '../types/api';
import type { TacticalPlay } from '../types/tactics';

export function TacticalPlayboard({play,slots}:{play:TacticalPlay;slots:LineupSlot[]}) {
  const [step,setStep]=useState(0);const arrow=useId().replaceAll(':','');
  const route=play.route.map(i=>slots.find(s=>s.slotIndex===i)).filter((s):s is LineupSlot=>Boolean(s));
  const ball=route[Math.min(step,route.length-1)];
  const colors={POR:'#f59e0b',DEF:'#60a5fa',MED:'#c084fc',DEL:'#f87171'};
  return <div className="space-y-3">
    <svg viewBox="0 0 100 100" role="img" aria-label={`${play.title}: ${slots.length} posiciones, paso ${step+1}`} className="w-full max-w-[360px] mx-auto rounded-2xl bg-[#123b2a] shadow-lg">
      <defs><marker id={arrow} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0 0 L4 2 L0 4" fill="#e8d193" /></marker></defs>
      <path d="M5 5H95V95H5Z M5 50H95 M32 5V20H68V5 M32 95V80H68V95" fill="none" stroke="#ffffff66" strokeWidth="0.5" /><circle cx="50" cy="50" r="9" fill="none" stroke="#ffffff66" strokeWidth="0.5" />
      {route.slice(1).map((to,index)=>{const from=route[index];return <path key={index} d={`M${from.x} ${from.y}L${to.x} ${to.y}`} stroke="#e8d193" strokeWidth="1" fill="none" strokeDasharray={play.phase==='Sin balón'?'2 2':undefined} opacity={index<step?1:0.3} markerEnd={`url(#${arrow})`} />;})}
      {slots.map(s=><g key={s.slotIndex}><circle cx={s.x} cy={s.y} r="3.1" fill={colors[s.role]} stroke={s.playerId?'#ffffffcc':'#ffffff55'} strokeDasharray={s.playerId?undefined:'1 1'} /><text x={s.x} y={s.y+1} textAnchor="middle" fontSize="2.8" fontWeight="bold" fill="#102016">{s.shirtNumber??s.label}</text><text x={s.x} y={s.y+6} textAnchor="middle" fontSize="2.6" fill="white">{s.playerName?.split(' ')[0]??'Vacante'}</text></g>)}
      {ball?<circle cx={ball.x+4} cy={ball.y-3} r="1.8" fill="white" stroke="#102016" strokeWidth="0.7" style={{transition:'cx 500ms ease, cy 500ms ease'}} />:null}
    </svg>
    <div className="flex items-center justify-center gap-3"><Button size="sm" variant="outline" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Anterior</Button><span className="text-sm">Paso {step+1}/{Math.max(1,route.length)}</span><Button size="sm" variant="outline" disabled={step>=route.length-1} onClick={()=>setStep(s=>s+1)}>Siguiente</Button></div>
  </div>;
}
