import type { RefereeRepository } from '../ports/out/referee.repository';
import type { MatchRepository } from '../ports/out/match.repository';
import type { QrPaymentRepository } from '../ports/out/qr-payment.repository';
import type { PaymentDebt } from '../../domain/payments';
import { REFEREE_TOTAL, refereeDeadline, splitReferee,parseSettledShares, type MatchRefereeView } from '../../domain/referee';
import type { Match } from '../../domain/entities';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { allocateRefereeCredits } from '../../domain/referee-credit';

export class RefereeService {
  constructor(private fees:RefereeRepository,private matches:MatchRepository,private receipts:QrPaymentRepository,
    private now:()=>number=Date.now) {}
  async ensure(match:Match) { await this.fees.create(match.id,REFEREE_TOTAL); }
  normalizePaidAt(value:string):string {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new ValidationError('Indica fecha y hora del pago de arbitraje');
    const time=Date.parse(value);
    const day=new Date(value.slice(0,10)+'T00:00:00Z');
    if(!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==value.slice(0,10)||Number(value.slice(11,13))>23||Number(value.slice(14,16))>59)throw new ValidationError('Fecha del pago de arbitraje inválida');
    if (!Number.isFinite(time) || time>this.now()+60000) throw new ValidationError('La fecha del pago de arbitraje no puede estar en el futuro');
    return new Date(time).toISOString();
  }
  private async projection() {
    const allReceipts=(await this.receipts.receipts()).filter(row=>row.kind==='referee');
    const approved=allReceipts.filter(row=>row.status==='aprobado');
    const feeMap=new Map((await this.fees.list()).map(fee=>[fee.matchId,fee]));
    const source=await this.fees.attendance();
    const statuses=new Map(source.statuses.map(row=>[`${row.matchId}:${row.playerId}`,row.status]));
    const rosters=new Map<number,Set<number>>();
    for(const row of source.enrollments){if(!rosters.has(row.tournamentId))rosters.set(row.tournamentId,new Set());rosters.get(row.tournamentId)!.add(row.playerId);}
    const contexts=[];
    for(const match of await this.matches.list()) {
      const fee=feeMap.get(match.id),total=fee?.total??0;
      const attendance=source.players.map(row=>{const status=statuses.get(`${match.id}:${row.playerId}`)??'pendiente';return {...row,status,eligible:status!=='no_disponible'};});
      const enrolled=match.tournamentId?(rosters.get(match.tournamentId)??new Set<number>()):null;
      const cancelled=match.status==='cancelado';
      const confirmed=attendance.filter(row=>row.status==='confirmado'&&(!enrolled||enrolled.has(row.playerId))&&!cancelled);
      const settled=match.status==='jugado'&&fee?.settledShares?parseSettledShares(fee.settledShares,total):null;
      const shares=settled?new Map(settled.map(row=>[row.playerId,row.amount])):splitReferee(total,confirmed.map(row=>row.playerId));
      contexts.push({match,total,attendance,enrolled,cancelled,settled,shares});
    }
    const plan=allocateRefereeCredits(contexts.map(({match,shares})=>({...match,charges:shares})),approved,await this.fees.transfers());
    const views=new Map<number,MatchRefereeView>();
    for(const {match,total,attendance,enrolled,cancelled,settled,shares}of contexts) {
      const dueAt=refereeDeadline(match.kickOff),receipts=allReceipts.filter(row=>row.targetId===match.id);
      const incoming=plan.allocations.filter(row=>row.matchId===match.id).map(row=>({...row,receipt:approved.find(receipt=>receipt.id===row.receiptId)!}));
      const people=[...attendance.map(row=>({playerId:row.playerId,playerName:row.playerName,eligible:row.eligible})),
        ...[...new Map([...receipts,...(settled??[]),...incoming.map(row=>row.receipt)].filter(row=>!attendance.some(person=>person.playerId===row.playerId)).map(row=>[row.playerId,{playerId:row.playerId,playerName:row.playerName,eligible:false}])).values()]];
      const rows=people.map(row=>{
        const related=receipts.filter(receipt=>receipt.playerId===row.playerId);
        const deposited=related.filter(receipt=>receipt.status==='aprobado');
        const sent=(receiptId:number)=>plan.allocations.filter(part=>part.receiptId===receiptId).reduce((sum,part)=>sum+part.amount,0);
        const carried=incoming.filter(part=>part.receipt.playerId===row.playerId);
        const creditApplied=carried.reduce((sum,part)=>sum+part.amount,0);
        const creditTransferred=deposited.reduce((sum,receipt)=>sum+sent(receipt.id),0);
        const directPaid=deposited.reduce((sum,receipt)=>sum+receipt.amount,0)-creditTransferred;
        const paid=directPaid+creditApplied;
        const paidOnTime=deposited.filter(receipt=>Date.parse(receipt.paidAt)<=Date.parse(dueAt)).reduce((sum,receipt)=>sum+receipt.amount-sent(receipt.id),0)+
          carried.filter(part=>Date.parse(part.receipt.paidAt)<=Date.parse(dueAt)).reduce((sum,part)=>sum+part.amount,0);
        const pending=related.filter(receipt=>receipt.status==='pendiente').reduce((sum,receipt)=>sum+receipt.amount,0);
        const amount=shares.get(row.playerId)??0,attending=shares.has(row.playerId);
        const free=total===0&&!cancelled&&row.eligible&&(!enrolled||enrolled.has(row.playerId));
        const starterEligible=free||(attending&&paidOnTime>=amount),benchEligible=free||(attending&&paid>=amount);
        const status=free?'sin_cobro' as const:!attending?'no_asiste' as const:starterEligible?'a_tiempo' as const:benchEligible?'tardio' as const:pending>0?'en_revision' as const:'pendiente' as const;
        return {playerId:row.playerId,playerName:row.playerName,amount,paid,paidOnTime,pending,directPaid,creditApplied,creditTransferred,walletCredit:plan.wallet.get(row.playerId)??0,
          outstanding:Math.max(0,amount-paid),credit:Math.max(0,paid-amount),status,starterEligible,benchEligible};
      });
      views.set(match.id,{matchId:match.id,total,attendees:shares.size,dueAt,rows,
        collected:rows.reduce((sum,row)=>sum+row.paid,0),pending:rows.reduce((sum,row)=>sum+row.pending,0),
        outstanding:rows.reduce((sum,row)=>sum+row.outstanding,0),credits:rows.reduce((sum,row)=>sum+row.credit,0)});
    }
    return {views,plan,billableMatches:contexts.filter(({match})=>feeMap.has(match.id)).map(({match})=>match)};
  }
  async status(matchId:number):Promise<MatchRefereeView> {
    const view=(await this.projection()).views.get(matchId);
    if(!view)throw new NotFoundError('Partido no encontrado');return view;
  }
  /** Preserve historical charges when the match finishes, even if a player later becomes inactive. */
  async settle(matchId:number) {
    const {views,plan}=await this.projection(),view=views.get(matchId)!;
    await this.fees.settle(matchId,JSON.stringify(view.rows.filter(row=>row.amount>0).map(({playerId,playerName,amount})=>({playerId,playerName,amount}))));
    await this.fees.saveTransfers(matchId,plan.allocations.filter(row=>row.matchId===matchId));
  }
  async debts(playerId?:number):Promise<PaymentDebt[]> {
    const result:PaymentDebt[]=[];
    const {views,billableMatches}=await this.projection();
    for(const match of billableMatches) {
      const view=views.get(match.id)!;
      for(const row of view.rows.filter(row=>(playerId===undefined||row.playerId===playerId)&&(row.amount>0||row.paid>0||row.pending>0||row.creditTransferred>0))) {
        result.push({...row,kind:'referee',targetId:match.id,concept:`Arbitraje vs. ${match.opponent}`,dueAt:view.dueAt});
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
    if((await this.receipts.receipts()).some(row=>row.kind==='referee'&&row.targetId===matchId)||(await this.fees.transfers()).some(row=>row.matchId===matchId))throw new ValidationError('Este partido tiene historial de arbitraje; cancélalo para conservar los pagos y saldos');
  }
  /** Invalidate drafts and publications when attendance/review changes financial eligibility. */
  async reconcile(_matchId:number) {
    // One attendance change can move credits across several future dates.
    const {views}=await this.projection();
    for(const match of await this.matches.list()) {
      if(!['programado','pospuesto'].includes(match.status))continue;
      const matchId=match.id;
      const allowed=new Set(views.get(matchId)!.rows.filter(row=>row.starterEligible).map(row=>row.playerId));
      const draft=await this.matches.getLineup(matchId),published=await this.matches.getPublishedLineup(matchId);
      if(draft.some(slot=>slot.playerId!==null&&!allowed.has(slot.playerId)))await this.matches.replaceLineup(matchId,draft.map(slot=>allowed.has(slot.playerId!)?slot:{...slot,playerId:null}));
      if(published.some(slot=>slot.playerId!==null&&!allowed.has(slot.playerId)))await this.matches.unpublishLineup(matchId);
    }
  }
}
