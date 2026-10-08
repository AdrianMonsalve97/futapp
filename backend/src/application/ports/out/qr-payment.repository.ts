import type { PaymentDebt, PaymentQr, PaymentReceipt } from '../../../domain/payments';
export interface QrPaymentRepository {
  debts(playerId?: number): PaymentDebt[];
  receipts(playerId?: number): PaymentReceipt[];
  find(id: number): PaymentReceipt | null;
  findKey(playerId: number, key: string): PaymentReceipt | null;
  create(input: Omit<PaymentReceipt, 'id' | 'playerName' | 'status' | 'reviewNotes' | 'reviewedBy' | 'reviewedAt' | 'createdAt'>): PaymentReceipt;
  review(id: number, status: 'aprobado' | 'rechazado', notes: string, adminId: number): PaymentReceipt;
  qr(): PaymentQr;
  setQr(input: PaymentQr): PaymentQr;
}
