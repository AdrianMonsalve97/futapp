import type { Database } from 'better-sqlite3';
import type { QrPaymentRepository } from '../../../../application/ports/out/qr-payment.repository';
import type { PaymentDebt, PaymentQr, PaymentReceipt } from '../../../../domain/payments';

const RECEIPTS = `SELECT r.id, r.player_id AS playerId, u.full_name AS playerName, r.kind,
 r.target_id AS targetId, r.asset_id AS assetId, r.amount, r.reference, r.paid_at AS paidAt,
 r.status, r.review_notes AS reviewNotes, r.reviewed_by AS reviewedBy, r.reviewed_at AS reviewedAt,
 r.created_at AS createdAt, r.idempotency_key AS idempotencyKey, r.file_hash AS fileHash
 FROM payment_receipts r JOIN players p ON p.id=r.player_id JOIN users u ON u.id=p.user_id`;

export class SqliteQrPaymentRepository implements QrPaymentRepository {
  constructor(private readonly db: Database) {}
  debts(playerId?: number): PaymentDebt[] {
    const rows = this.db.prepare(`SELECT 'inscription' AS kind, i.id AS targetId, i.player_id AS playerId,
      u.full_name AS playerName, i.concept || ' · ' || i.season AS concept, i.amount, i.paid
      FROM inscriptions i JOIN players p ON p.id=i.player_id JOIN users u ON u.id=p.user_id
      UNION ALL SELECT 'uniform_request', r.id, r.player_id, u.full_name,
      'Solicitud: ' || f.name || ' · ' || r.size, COALESCE(r.quoted_price,f.price), 0
      FROM uniform_requests r JOIN uniforms f ON f.id=r.uniform_id JOIN players p ON p.id=r.player_id JOIN users u ON u.id=p.user_id
      WHERE r.status IN ('pendiente','aprobada') OR r.issue_id IS NOT NULL
      UNION ALL SELECT 'uniform_issue', i.id, i.player_id, u.full_name, f.name || ' · ' || i.size, i.cost, 0
      FROM uniform_issues i JOIN uniforms f ON f.id=i.uniform_id JOIN players p ON p.id=i.player_id JOIN users u ON u.id=p.user_id
      WHERE NOT EXISTS(SELECT 1 FROM uniform_requests r WHERE r.issue_id=i.id)
    `).all() as Omit<PaymentDebt, 'pending' | 'outstanding'>[];
    const receipts = this.receipts(playerId);
    return rows.filter(row => playerId === undefined || row.playerId === playerId).map(row => {
      const related = receipts.filter(r => r.kind === row.kind && r.targetId === row.targetId && r.playerId === row.playerId);
      const paid = row.kind === 'inscription' ? row.paid : related.filter(r => r.status === 'aprobado').reduce((a,r) => a+r.amount,0);
      const pending = related.filter(r => r.status === 'pendiente').reduce((a,r) => a+r.amount,0);
      return { ...row, paid, pending, outstanding: Math.round(Math.max(0,row.amount-paid)*100)/100 };
    });
  }
  receipts(playerId?: number): PaymentReceipt[] {
    return this.db.prepare(RECEIPTS + (playerId === undefined ? '' : ' WHERE r.player_id=?') + ' ORDER BY r.id DESC').all(...(playerId === undefined ? [] : [playerId])) as PaymentReceipt[];
  }
  find(id: number): PaymentReceipt | null { return this.db.prepare(RECEIPTS + ' WHERE r.id=?').get(id) as PaymentReceipt ?? null; }
  findKey(playerId: number, key: string): PaymentReceipt | null {
    return this.db.prepare(RECEIPTS + ' WHERE r.player_id=? AND r.idempotency_key=?').get(playerId,key) as PaymentReceipt ?? null;
  }
  create(input: Parameters<QrPaymentRepository['create']>[0]): PaymentReceipt {
    const result = this.db.prepare(`INSERT INTO payment_receipts(player_id,kind,target_id,asset_id,amount,reference,paid_at,idempotency_key,file_hash)
      VALUES(@playerId,@kind,@targetId,@assetId,@amount,@reference,@paidAt,@idempotencyKey,@fileHash)`).run(input);
    return this.find(Number(result.lastInsertRowid))!;
  }
  review(id: number, status: 'aprobado' | 'rechazado', notes: string, adminId: number): PaymentReceipt {
    this.db.prepare("UPDATE payment_receipts SET status=?, review_notes=?, reviewed_by=?, reviewed_at=datetime('now') WHERE id=?").run(status,notes,adminId,id);
    return this.find(id)!;
  }
  qr(): PaymentQr { return this.db.prepare('SELECT asset_id AS assetId, recipient, payment_key AS paymentKey FROM qr_payment_settings WHERE id=1').get() as PaymentQr; }
  setQr(input: PaymentQr): PaymentQr {
    this.db.prepare('UPDATE qr_payment_settings SET asset_id=@assetId, recipient=@recipient, payment_key=@paymentKey WHERE id=1').run(input);
    return this.qr();
  }
}
