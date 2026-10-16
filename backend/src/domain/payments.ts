export type PaymentTargetKind = 'inscription' | 'uniform_request' | 'uniform_issue' | 'referee';
export interface PaymentDebt {
  cancelled?:boolean;
  dueAt?: string; credit?: number; paidOnTime?: number; starterEligible?: boolean; benchEligible?: boolean;
  directPaid?:number;creditApplied?:number;creditTransferred?:number;walletCredit?:number;
  kind: PaymentTargetKind; targetId: number; playerId: number; playerName: string;
  concept: string; amount: number; paid: number; pending: number; outstanding: number;
}
export interface PaymentReceipt {
  concept?:string;requestDeleted?:boolean;
  id: number; playerId: number; playerName: string; kind: PaymentTargetKind; targetId: number;
  assetId: string; amount: number; reference: string; paidAt: string;
  status: 'pendiente' | 'aprobado' | 'rechazado'; reviewNotes: string;
  reviewedBy: number | null; reviewedAt: string | null; createdAt: string;
  idempotencyKey: string; fileHash: string;
}
export interface PaymentQr { assetId: string | null; recipient: string; paymentKey: string; }
export interface PaymentHistoryEntry {
  id:string;kind:PaymentTargetKind;targetId:number;playerId:number;playerName:string;concept:string;
  amount:number;paidAt:string|null;status:'pendiente'|'aprobado'|'rechazado';method:string;
  reference:string;notes:string;receiptId:number|null;assetId:string|null;reviewedAt:string|null;
  requestDeleted:boolean;openingBalance:boolean;
}
