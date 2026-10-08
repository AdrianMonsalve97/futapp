import type { RefereeRepository } from '../ports/out/referee.repository';
import type { MatchRepository } from '../ports/out/match.repository';
import type { QrPaymentRepository } from '../ports/out/qr-payment.repository';
import type { TournamentRepository } from '../ports/out/tournament.repository';
import type { PaymentDebt } from '../../domain/payments';
import { REFEREE_TOTAL, refereeDeadline, splitReferee,parseSettledShares, type MatchRefereeView } from '../../domain/referee';
import type { Match } from '../../domain/entities';
import { NotFoundError, ValidationError } from '../../domain/errors';

export class RefereeService {
  constructor(private fees:RefereeRepository,private matches:MatchRepository,private receipts:QrPaymentRepository,
    private tournaments:TournamentRepository,private now:()=>number=Date.now) {}
  async ensure(match:Match) { await this.fees.create(match.id,REFEREE_TOTAL); }
  normalizePaidAt(value:string):string {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new ValidationError('Indica fecha y hora del pago de arbitraje');
    const time=Date.parse(value);
    const day=new Date(value.slice(0,10)+'T00:00:00Z');
    if(!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==value.slice(0,10)||Number(value.slice(11,13))>23||Number(value.slice(14,16))>59)throw new ValidationError('Fecha del pago de arbitraje inválida');
    if (!Number.isFinite(time) || time>this.now()+60000) throw new ValidationError('La fecha del pago de arbitraje no puede estar en el futuro');
    return new Date(time).toISOString();
  }
  async status(matchId:number):Promise<MatchRefereeView> {
    const match=await this.matches.findById(matchId);if(!match)throw new NotFoundError('Partido no encontrado');
    const fee=await this.fees.find(matchId),total=fee?.total??0,dueAt=refereeDeadline(match.kickOff);
    const attendance=await this.matches.listAttendance(matchId);
    const enrolled=match.tournamentId?new Set(await this.tournaments.playerIds(match.tournamentId)):null;
    const cancelled=match.status==='cancelado';
    const confirmed=attendance.filter(row=>row.status==='confirmado'&&(!enrolled||enrolled.has(row.playerId))&&!cancelled);
    const settled=match.status==='jugado'&&fee?.settledShares?parseSettledShares(fee.settledShares,total):null;
    const shares=settled?new Map(settled.map(row=>[row.playerId,row.amount])):splitReferee(total,confirmed.map(row=>row.playerId));
    const receipts=(await this.receipts.receipts()).filter(row=>row.kind==='referee'&&row.targetId===matchId);
    const people=[...attendance.map(row=>({playerId:row.playerId,playerName:row.playerName,eligible:row.eligible})),
      ...[...new Map([...receipts,...(settled??[])].filter(row=>!attendance.some(person=>person.playerId===row.playerId)).map(row=>[row.playerId,{playerId:row.playerId,playerName:row.playerName,eligible:false}])).values()]];
    const rows=people.map(row=>{
      const related=receipts.filter(receipt=>receipt.playerId===row.playerId);
      const approved=related.filter(receipt=>receipt.status==='aprobado');
      const paid=approved.reduce((sum,receipt)=>sum+receipt.amount,0);
      const paidOnTime=approved.filter(receipt=>Date.parse(receipt.paidAt)<=Date.parse(dueAt)).reduce((sum,receipt)=>sum+receipt.amount,0);
      const pending=related.filter(receipt=>receipt.status==='pendiente').reduce((sum,receipt)=>sum+receipt.amount,0);
      const amount=shares.get(row.playerId)??0;
      const attending=shares.has(row.playerId);
      const free=total===0&&!cancelled&&row.eligible&&(!enrolled||enrolled.has(row.playerId));
      const starterEligible=free||(attending&&paidOnTime>=amount);
      const benchEligible=free||(attending&&paid>=amount);
      const status=free?'sin_cobro' as const:!attending?'no_asiste' as const:starterEligible?'a_tiempo' as const:benchEligible?'tardio' as const:pending>0?'en_revision' as const:'pendiente' as const;
      return {playerId:row.playerId,playerName:row.playerName,amount,paid,paidOnTime,pending,
        outstanding:Math.max(0,amount-paid),credit:Math.max(0,paid-amount),status,starterEligible,benchEligible};
    });
    return {matchId,total,attendees:shares.size,dueAt,rows,
      collected:rows.reduce((sum,row)=>sum+row.paid,0),pending:rows.reduce((sum,row)=>sum+row.pending,0),
      outstanding:rows.reduce((sum,row)=>sum+row.outstanding,0),credits:rows.reduce((sum,row)=>sum+row.credit,0)};
  }
  /** Preserve historical charges when the match finishes, even if a player later becomes inactive. */
  async settle(matchId:number) {
    const view=await this.status(matchId);
    await this.fees.settle(matchId,JSON.stringify(view.rows.filter(row=>row.amount>0).map(({playerId,playerName,amount})=>({playerId,playerName,amount}))));
  }
  async debts(playerId?:number):Promise<PaymentDebt[]> {
    const result:PaymentDebt[]=[];
    for(const fee of await this.fees.list()) {
      const match=await this.matches.findById(fee.matchId);if(!match)continue;
      const view=await this.status(fee.matchId);
      for(const row of view.rows.filter(row=>(playerId===undefined||row.playerId===playerId)&&(row.amount>0||row.paid>0||row.pending>0))) {
        result.push({...row,kind:'referee',targetId:fee.matchId,concept:`Arbitraje vs. ${match.opponent}`,dueAt:view.dueAt});
      }
    }
    return result;
  }
  async publishedLineup(matchId:number) {
    const lineup=await this.matches.getPublishedLineup(matchId),match=await this.matches.findById(matchId);
    if(!match||!['programado','pospuesto'].includes(match.status))return lineup;
    const allowed=new Set((await this.status(matchId)).rows.filter(row=>row.starterEligible).map(row=>row.playerId));
    return lineup.map(slot=>slot.playerId===null||allowed.has(slot.playerId)?slot:{...slot,playerId:null,playerName:null,shirtNumber:null,playerPosition:null});
  }
  async assertRemovable(matchId:number) {
    if((await this.receipts.receipts()).some(row=>row.kind==='referee'&&row.targetId===matchId))throw new ValidationError('Este partido tiene soportes de arbitraje; cancélalo para conservar el historial de pagos');
  }
  /** Invalidate drafts and publications when attendance/review changes financial eligibility. */
  async reconcile(matchId:number) {
    const match=await this.matches.findById(matchId);
    if(!match||!['programado','pospuesto'].includes(match.status))return;
    const allowed=new Set((await this.status(matchId)).rows.filter(row=>row.starterEligible).map(row=>row.playerId));
    const draft=await this.matches.getLineup(matchId),published=await this.matches.getPublishedLineup(matchId);
    if(draft.some(slot=>slot.playerId!==null&&!allowed.has(slot.playerId)))await this.matches.replaceLineup(matchId,draft.map(slot=>allowed.has(slot.playerId!)?slot:{...slot,playerId:null}));
    if(published.some(slot=>slot.playerId!==null&&!allowed.has(slot.playerId)))await this.matches.unpublishLineup(matchId);
  }
}
