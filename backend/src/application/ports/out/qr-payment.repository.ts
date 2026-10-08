import type { PaymentDebt, PaymentQr, PaymentReceipt } from '../../../domain/payments';
export interface QrPaymentRepository {
  debts(playerId?: number): Promise<PaymentDebt[]>;
  receipts(playerId?: number): Promise<PaymentReceipt[]>;
  find(id: number): Promise<PaymentReceipt | null>;
  findKey(playerId: number, key: string): Promise<PaymentReceipt | null>;
  create(input: Omit<PaymentReceipt, 'id' | 'playerName' | 'status' | 'reviewNotes' | 'reviewedBy' | 'reviewedAt' | 'createdAt'>): Promise<PaymentReceipt>;
  review(id: number, status: 'aprobado' | 'rechazado', notes: string, adminId: number): Promise<PaymentReceipt>;
  qr(): Promise<PaymentQr>;
  setQr(input: PaymentQr): Promise<PaymentQr>;
}
