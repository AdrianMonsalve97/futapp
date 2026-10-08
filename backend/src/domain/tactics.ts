import type { LineupSlot, Position } from './entities';
import type { TeamFormat } from './formats';
import type { LeagueContext } from './tournament';
export type TacticalStyle = 'equilibrado' | 'ofensivo' | 'defensivo';
export interface CoachingSource { title: string; url: string; topic: string; }
export interface TacticalPlay {
  id: string; title: string; objective: string; phase: string;
  route: number[]; steps: string[]; coaching: string; source: CoachingSource;
}
export interface TacticalPlan {
  match: {id:number;opponent:string;format:TeamFormat;minutes:number}; style:TacticalStyle;
  recommendation: {formation:string;lineup:LineupSlot[];explanation:string;bench:{playerId:number;playerName:string;position:string;predictedRating:number}[];leagueContext?:LeagueContext};
  formations:{key:string;score:number;avgRating:number;filled:number;naturalFit:number;slots:LineupSlot[]}[];
  positions:{role:Position;available:number;primary:number;needed:number;avgRating:number}[];
  plays:TacticalPlay[]; rotation:string; methodology:string;
}
export interface CoachingResearch {
  checkedAt:string;style:TacticalStyle;query:string;status:'consultado'|'parcial'|'no_disponible';
  sources:(CoachingSource & {verified:boolean})[];
}
