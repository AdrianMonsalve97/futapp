import type { Database } from 'better-sqlite3';
import type { QrPaymentRepository } from '../../../../application/ports/out/qr-payment.repository';
import type { PaymentDebt, PaymentQr, PaymentReceipt } from '../../../../domain/payments';
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

const RECEIPTS = `SELECT r.id, r.player_id AS playerId, u.full_name AS playerName, r.kind,
 r.target_id AS targetId, r.asset_id AS assetId, r.amount, r.reference, r.paid_at AS paidAt,
 r.status, r.review_notes AS reviewNotes, r.reviewed_by AS reviewedBy, r.reviewed_at AS reviewedAt,
 r.created_at AS createdAt, r.idempotency_key AS idempotencyKey, r.file_hash AS fileHash
 FROM payment_receipts r JOIN players p ON p.id=r.player_id JOIN users u ON u.id=p.user_id`;

export class SqliteQrPaymentRepository implements QrPaymentRepository {
  constructor(db: Database | ApplicationDatabase) {
      this.db = asAsyncDatabase(db);
  }
  async debts(playerId?: number): Promise<PaymentDebt[]> {
    const rows = (await this.db.prepare(`SELECT 'inscription' AS kind, i.id AS targetId, i.player_id AS playerId,
      u.full_name AS playerName, i.concept || ' · ' || i.season AS concept, i.amount, i.paid
      FROM inscriptions i JOIN players p ON p.id=i.player_id JOIN users u ON u.id=p.user_id
      UNION ALL SELECT 'uniform_request', r.id, r.player_id, u.full_name,
      'Solicitud: ' || f.name || ' · ' || r.size || CASE WHEN d.recipient_name IS NULL THEN '' ELSE ' · ' || d.recipient_name END, COALESCE(r.quoted_price,f.price), 0
      FROM uniform_requests r JOIN uniforms f ON f.id=r.uniform_id JOIN players p ON p.id=r.player_id JOIN users u ON u.id=p.user_id
      LEFT JOIN uniform_recipients d ON d.request_id=r.id
      WHERE r.status IN ('pendiente','aprobada') OR r.issue_id IS NOT NULL
      UNION ALL SELECT 'uniform_issue', i.id, i.player_id, u.full_name, f.name || ' · ' || i.size || CASE WHEN d.recipient_name IS NULL THEN '' ELSE ' · ' || d.recipient_name END, i.cost, 0
      FROM uniform_issues i JOIN uniforms f ON f.id=i.uniform_id JOIN players p ON p.id=i.player_id JOIN users u ON u.id=p.user_id
      LEFT JOIN uniform_recipients d ON d.issue_id=i.id
      WHERE NOT EXISTS(SELECT 1 FROM uniform_requests r WHERE r.issue_id=i.id)
    `).all()) as Omit<PaymentDebt, 'pending' | 'outstanding'>[];
    const receipts = (await this.receipts(playerId));
    return rows.filter(row => playerId === undefined || row.playerId === playerId).map(row => {
      const related = receipts.filter(r => r.kind === row.kind && r.targetId === row.targetId && r.playerId === row.playerId);
      const paid = row.kind === 'inscription' ? row.paid : related.filter(r => r.status === 'aprobado').reduce((a,r) => a+r.amount,0);
      const pending = related.filter(r => r.status === 'pendiente').reduce((a,r) => a+r.amount,0);
      return { ...row, paid, pending, outstanding: Math.round(Math.max(0,row.amount-paid)*100)/100 };
    });
  }
  async receipts(playerId?: number): Promise<PaymentReceipt[]> {
    return (await this.db.prepare(RECEIPTS + (playerId === undefined ? '' : ' WHERE r.player_id=?') + ' ORDER BY r.id DESC').all(...(playerId === undefined ? [] : [playerId]))) as PaymentReceipt[];
  }
  async find(id: number): Promise<PaymentReceipt | null> { return (await this.db.prepare(RECEIPTS + ' WHERE r.id=?').get(id)) as PaymentReceipt ?? null; }
  async findKey(playerId: number, key: string): Promise<PaymentReceipt | null> {
    return (await this.db.prepare(RECEIPTS + ' WHERE r.player_id=? AND r.idempotency_key=?').get(playerId,key)) as PaymentReceipt ?? null;
  }
  async create(input: Parameters<QrPaymentRepository['create']>[0]): Promise<PaymentReceipt> {
    const result = (await this.db.prepare(`INSERT INTO payment_receipts(player_id,kind,target_id,asset_id,amount,reference,paid_at,idempotency_key,file_hash)
      VALUES(@playerId,@kind,@targetId,@assetId,@amount,@reference,@paidAt,@idempotencyKey,@fileHash)`).run(input));
    return (await this.find(Number(result.lastInsertRowid)))!;
  }
  async review(id: number, status: 'aprobado' | 'rechazado', notes: string, adminId: number): Promise<PaymentReceipt> {
    (await this.db.prepare("UPDATE payment_receipts SET status=?, review_notes=?, reviewed_by=?, reviewed_at=datetime('now') WHERE id=?").run(status,notes,adminId,id));
    return (await this.find(id))!;
  }
  async qr(): Promise<PaymentQr> { return (await this.db.prepare('SELECT asset_id AS assetId, recipient, payment_key AS paymentKey FROM qr_payment_settings WHERE id=1').get()) as PaymentQr; }
  async setQr(input: PaymentQr): Promise<PaymentQr> {
    (await this.db.prepare('UPDATE qr_payment_settings SET asset_id=@assetId, recipient=@recipient, payment_key=@paymentKey WHERE id=1').run(input));
    return (await this.qr());
  }

    private readonly db: ApplicationDatabase;
}
