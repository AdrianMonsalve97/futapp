import { ValidationError } from './errors';

export interface RefereeCreditTransfer { receiptId:number;matchId:number;amount:number }
export interface RefereeCreditMatch {
  id:number;kickOff:string;status:string;charges:Map<number,number>;
}
export interface RefereeCreditReceipt {
  id:number;playerId:number;targetId:number;amount:number;paidAt:string;
}

/** Allocate each approved peso once, reserving its original charge before carrying surplus forward. */
export function allocateRefereeCredits(matches:RefereeCreditMatch[],receipts:RefereeCreditReceipt[],saved:RefereeCreditTransfer[]) {
  if(receipts.some(receipt=>!Number.isSafeInteger(receipt.amount)||receipt.amount<1))throw new ValidationError('El saldo de arbitraje debe registrarse en pesos enteros');
  const byMatch=new Map(matches.map(match=>[match.id,match]));
  const funds=new Map(receipts.map(receipt=>[receipt.id,{receipt,remaining:receipt.amount}]));
  const allocations:RefereeCreditTransfer[]=[];
  const incoming=new Map<string,number>();
  const key=(matchId:number,playerId:number)=>`${matchId}:${playerId}`;
  const apply=(transfer:RefereeCreditTransfer)=>{
    const fund=funds.get(transfer.receiptId);
    if(!fund||transfer.matchId===fund.receipt.targetId||!Number.isSafeInteger(transfer.amount)||transfer.amount<1||transfer.amount>fund.remaining)throw new ValidationError('El saldo de arbitraje contiene una aplicación inválida');
    fund.remaining-=transfer.amount;allocations.push(transfer);
    const target=key(transfer.matchId,fund.receipt.playerId);
    incoming.set(target,(incoming.get(target)??0)+transfer.amount);
  };
  // Completed matches retain the exact receipt portions already used, regardless of later schedule changes.
  for(const transfer of saved)if(byMatch.get(transfer.matchId)?.status==='jugado')apply(transfer);
  const ordered=[...funds.values()].sort((a,b)=>Date.parse(a.receipt.paidAt)-Date.parse(b.receipt.paidAt)||a.receipt.id-b.receipt.id);
  const reserved=new Map<string,number>();
  for(const fund of ordered) {
    const own=byMatch.get(fund.receipt.targetId),target=key(fund.receipt.targetId,fund.receipt.playerId);
    if(!own)throw new ValidationError('El pago de arbitraje no tiene un partido de origen');
    const debt=Math.max(0,(own.charges.get(fund.receipt.playerId)??0)-(incoming.get(target)??0)-(reserved.get(target)??0));
    const keep=Math.min(fund.remaining,debt);
    fund.remaining-=keep;reserved.set(target,(reserved.get(target)??0)+keep);
  }
  for(const match of [...matches].sort((a,b)=>a.kickOff.localeCompare(b.kickOff)||a.id-b.id)) {
    if(!['programado','pospuesto'].includes(match.status))continue;
    for(const [playerId,amount]of match.charges) {
      const target=key(match.id,playerId);
      let debt=Math.max(0,amount-(reserved.get(target)??0)-(incoming.get(target)??0));
      for(const fund of ordered) {
        if(!debt)break;
        const source=byMatch.get(fund.receipt.targetId)!;
        if(fund.receipt.playerId!==playerId||source.kickOff>=match.kickOff||fund.remaining<=0)continue;
        const amount=Math.min(debt,fund.remaining);
        apply({receiptId:fund.receipt.id,matchId:match.id,amount});debt-=amount;
      }
    }
  }
  const wallet=new Map<number,number>();
  for(const {receipt,remaining}of funds.values())wallet.set(receipt.playerId,(wallet.get(receipt.playerId)??0)+remaining);
  return {allocations,wallet};
}
