export type RefereePaymentStatus = 'sin_cobro' | 'no_asiste' | 'pendiente' | 'en_revision' | 'a_tiempo' | 'tardio';
export interface RefereePaymentRow {
  playerId:number;playerName:string;amount:number;paid:number;paidOnTime:number;pending:number;outstanding:number;credit:number;
  status:RefereePaymentStatus;starterEligible:boolean;benchEligible:boolean;
  directPaid:number;creditApplied:number;creditTransferred:number;walletCredit:number;
}
export interface MatchRefereeView {
  matchId:number;total:number;attendees:number;dueAt:string;rows:RefereePaymentRow[];
  collected?:number;pending?:number;outstanding?:number;credits?:number;
}
