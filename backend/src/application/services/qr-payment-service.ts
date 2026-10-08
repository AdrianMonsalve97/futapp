import { createHash } from 'node:crypto';
import type { QrPaymentRepository } from '../ports/out/qr-payment.repository';
import type { MediaStorage } from '../ports/out/media.storage';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { InscriptionPort } from '../ports/in/inscription.port';
import type { UnitOfWork } from '../ports/out/unit-of-work';
import type { PaymentQr, PaymentReceipt, PaymentTargetKind } from '../../domain/payments';
import { NotFoundError, ValidationError } from '../../domain/errors';
import type { NotificationEvents } from '../../domain/notifications';

export class QrPaymentService {
  constructor(private readonly repository: QrPaymentRepository, private readonly storage: MediaStorage,
    private readonly players: PlayerRepository, private readonly inscriptions: InscriptionPort, private readonly uow: UnitOfWork,
    private readonly notifications?: NotificationEvents) {}
  view(userId: number, admin: boolean) {
    const playerId = admin ? undefined : this.playerId(userId);
    return { qr: this.repository.qr(), debts: this.repository.debts(playerId), receipts: this.repository.receipts(playerId).map(this.publicReceipt) };
  }
  private publicReceipt(row: PaymentReceipt) { const { fileHash: _hash, idempotencyKey: _key, ...data } = row; return data; }
  private playerId(userId: number): number {
    const player = this.players.findByUserId(userId);
    if (!player) throw new NotFoundError('Ficha de jugador no encontrada');
    return player.id;
  }
  private debt(playerId: number, kind: PaymentTargetKind, targetId: number) {
    const debt = this.repository.debts(playerId).find(d => d.kind === kind && d.targetId === targetId);
    if (!debt) throw new NotFoundError('Concepto de pago no encontrado');
    return debt;
  }
  async submit(userId: number, input: { kind: PaymentTargetKind; targetId: number; amount: number; reference: string; paidAt: string; idempotencyKey: string }, name: string, bytes: Uint8Array) {
    const playerId = this.playerId(userId);
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new ValidationError('El monto debe ser mayor que cero');
    const fileHash = createHash('sha256').update(bytes).digest('hex');
    const clean = { ...input, reference: input.reference.trim().toUpperCase(), playerId, fileHash };
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(input.idempotencyKey)) throw new ValidationError('Identificador de soporte inválido');
    const previous = this.repository.findKey(playerId, input.idempotencyKey);
    if (previous) {
      if (['kind','targetId','amount','reference','paidAt','fileHash'].some(key => previous[key as keyof PaymentReceipt] !== clean[key as keyof typeof clean])) throw new ValidationError('El identificador ya pertenece a otro soporte');
      return this.publicReceipt(previous);
    }
    const checkDebt = () => {
      const debt = this.debt(playerId,input.kind,input.targetId);
      if (input.amount > debt.outstanding-debt.pending+0.001) throw new ValidationError('El importe supera el saldo disponible; revisa los soportes pendientes');
      if (this.repository.receipts().some(r => r.reference===clean.reference && r.status!=='rechazado')) throw new ValidationError('Esta referencia ya tiene un soporte pendiente o aprobado');
    };
    checkDebt();
    const asset = await this.storage.store(userId,'receipt',name,bytes);
    let reused = false;
    try { const result = this.uow.run(() => {
      const existing = this.repository.findKey(playerId,input.idempotencyKey);
      if (existing) {
        if (['kind','targetId','amount','reference','paidAt','fileHash'].some(key => existing[key as keyof PaymentReceipt] !== clean[key as keyof typeof clean])) throw new ValidationError('El identificador ya pertenece a otro soporte');
        reused = true; return this.publicReceipt(existing);
      }
      // Recheck after the asynchronous upload to prevent simultaneous submissions from exceeding the debt.
      checkDebt();
      const receipt = this.repository.create({ ...clean, assetId: asset.id });
      this.notifications?.receiptUploaded(receipt);
      return this.publicReceipt(receipt);
    }); if (reused) await this.storage.discard(asset); return result;
    } catch (error) { await this.storage.discard(asset); throw error; }
  }
  review(id: number, adminId: number, status: 'aprobado' | 'rechazado', notes: string) {
    return this.uow.run(() => {
      const row = this.repository.find(id);
      if (!row) throw new NotFoundError('Soporte no encontrado');
      if (row.status === status) return this.publicReceipt(row);
      if (row.status !== 'pendiente') throw new ValidationError('El soporte ya fue revisado');
      if (status === 'aprobado') {
        const debt = this.debt(row.playerId,row.kind,row.targetId);
        if (row.amount > debt.outstanding+0.001) throw new ValidationError('El saldo cambió; este soporte supera lo pendiente');
        if (row.kind === 'inscription') this.inscriptions.addPayment(row.targetId,{ amount: row.amount, method: 'qr', reference: row.reference,
          paidAt: row.paidAt, registeredBy: adminId, idempotencyKey: 'receipt_'+row.id, notes: 'Soporte QR #'+row.id });
      }
      const reviewed = this.repository.review(id,status,notes.trim(),adminId);
      this.notifications?.receiptReviewed(reviewed);
      return this.publicReceipt(reviewed);
    });
  }
  async setQr(userId: number, recipient: string, paymentKey: string, name: string, data: Uint8Array): Promise<PaymentQr> {
    const asset = await this.storage.store(userId,'payment_qr',name,data);
    try { return this.repository.setQr({assetId:asset.id,recipient:recipient.trim(),paymentKey:paymentKey.trim()}); }
    catch (error) { await this.storage.discard(asset); throw error; }
  }
}
