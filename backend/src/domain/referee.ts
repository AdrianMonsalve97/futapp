import { ValidationError } from './errors';
import rules from './referee-rules.json';
import type { PaymentReceipt } from './payments';

export const REFEREE_TOTAL = rules.total;
export const REFEREE_NOTICE_HOURS = rules.noticeHours;
export type RefereePaymentStatus = 'sin_cobro' | 'no_asiste' | 'pendiente' | 'en_revision' | 'a_tiempo' | 'tardio';
export interface RefereePaymentRow {
  playerId: number; playerName: string; amount: number; paid: number; paidOnTime: number;
  pending: number; outstanding: number; credit: number; status: RefereePaymentStatus;
  directPaid: number; creditApplied: number; creditTransferred: number; walletCredit: number;
  starterEligible: boolean; benchEligible: boolean;
}
/** Only approved payments/credits covering the full current share receive priority. */
export function refereePaymentCovered(row?: Pick<RefereePaymentRow, 'amount' | 'outstanding'> | null): boolean {
  return Boolean(row && row.amount > 0 && row.outstanding === 0);
}
export interface MatchRefereeView {
  isMatchDay: boolean; attendanceOnlyUntil: string | null;
  matchId: number; total: number; attendees: number; dueAt: string; rows: RefereePaymentRow[];
  collected?: number; pending?: number; outstanding?: number; credits?: number;
}
export interface SettledRefereeShare { playerId:number;playerName:string;amount:number }
export function parseSettledShares(value:string,total:number):SettledRefereeShare[] {
  let rows:unknown;
  try {rows=JSON.parse(value);}catch {throw new ValidationError('El historial de arbitraje contiene cuotas inválidas');}
  const ids=new Set<number>();
  if(!Array.isArray(rows)||rows.length>100000)throw new ValidationError('El historial de arbitraje contiene cuotas inválidas');
  for(const row of rows) {
    if(!row||!Number.isSafeInteger(row.playerId)||row.playerId<1||ids.has(row.playerId)||typeof row.playerName!=='string'||!Number.isSafeInteger(row.amount)||row.amount<1)throw new ValidationError('El historial de arbitraje contiene cuotas inválidas');
    ids.add(row.playerId);
  }
  const sum=rows.reduce((sum,row)=>sum+row.amount,0);
  if(rows.length&&sum!==total)throw new ValidationError('Las cuotas históricas no coinciden con el total de arbitraje');
  return rows;
}
/** Match schedules use Colombia local time, regardless of the host's time zone. */
export function refereeDeadline(kickOff: string): string {
  const value = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(kickOff) ? kickOff + '-05:00' : kickOff;
  return new Date(Date.parse(value) - REFEREE_NOTICE_HOURS * 3600000).toISOString();
}
/** SQL stores review timestamps in UTC without an offset; both events must meet the inclusive cutoff. */
export function refereeReceiptOnTime(receipt: Pick<PaymentReceipt, 'status' | 'paidAt' | 'reviewedAt'>, dueAt: string): boolean {
  if (receipt.status !== 'aprobado' || !receipt.reviewedAt) return false;
  const reviewed = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(receipt.reviewedAt)
    ? receipt.reviewedAt.replace(' ', 'T') + 'Z' : receipt.reviewedAt;
  const paid = Date.parse(receipt.paidAt), approved = Date.parse(reviewed), cutoff = Date.parse(dueAt);
  return Number.isFinite(paid) && Number.isFinite(approved) && Number.isFinite(cutoff) && paid <= cutoff && approved <= cutoff;
}
/** Whole Colombian pesos; the remainder is distributed in stable player-id order. */
export function splitReferee(total: number, playerIds: number[]): Map<number, number> {
  const ids = [...new Set(playerIds)].sort((a,b)=>a-b);
  return new Map(ids.map((id,index)=>[id, Math.floor(total/ids.length) + (index < total%ids.length ? 1 : 0)]));
}
