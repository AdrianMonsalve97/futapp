import type { TeamFormat } from '../types/api';

export type PitchPhase = 'estructura' | 'ataque' | 'repliegue';
export const PITCH_HEIGHT: Record<TeamFormat, number> = {5:100,7:125,8:125,11:150};

/** Display geometry only. Saved positions and official selections remain untouched. */
export function layoutPitch<T extends {x:number;y:number;role:string}>(slots:T[],format:TeamFormat,phase:PitchPhase='estructura'):T[] {
  const rows:number[][]=[];
  for(const y of [...new Set(slots.map(slot=>slot.y))].sort((a,b)=>a-b)) {
    const previous=rows.at(-1);
    if(previous && y-previous[0]<=7)previous.push(y);else rows.push([y]);
  }
  return slots.map(slot=>{
    const row=rows.findIndex(values=>values.includes(slot.y));
    const structured=format===11?slot.y:rows.length<2?50:18+row*71/(rows.length-1);
    const shift=slot.role==='POR'?0:phase==='ataque'?-5:phase==='repliegue'?5:0;
    return {...slot,y:Math.max(10,Math.min(90,structured+shift))};
  });
}
