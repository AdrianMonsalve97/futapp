import type { Database } from 'better-sqlite3';
import type { QrPaymentRepository } from '../../../../application/ports/out/qr-payment.repository';
import type { PaymentDebt, PaymentQr, PaymentReceipt,PaymentHistoryEntry } from '../../../../domain/payments';
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

const RECEIPTS = `SELECT r.id, r.player_id AS playerId, u.full_name AS playerName, r.kind,
 r.target_id AS targetId, r.asset_id AS assetId, r.amount, r.reference, r.paid_at AS paidAt,
 r.status, r.review_notes AS reviewNotes, r.reviewed_by AS reviewedBy, r.reviewed_at AS reviewedAt,
 r.created_at AS createdAt, r.idempotency_key AS idempotencyKey, r.file_hash AS fileHash,
 CASE WHEN r.kind='inscription' THEN COALESCE(ins.concept || ' · ' || ins.season,'Inscripción #' || r.target_id)
 WHEN r.kind='referee' THEN COALESCE('Arbitraje · ' || m.opponent || ' · ' || m.kick_off,'Arbitraje #' || r.target_id)
 ELSE COALESCE(f.name || ' · ' || COALESCE(ur.size,ui.size) || CASE WHEN d.recipient_name IS NULL THEN '' ELSE ' · ' || d.recipient_name END,'Uniforme #' || r.target_id) END AS concept,
 CASE WHEN x.request_id IS NULL THEN 0 ELSE 1 END AS requestDeleted
 FROM payment_receipts r JOIN players p ON p.id=r.player_id JOIN users u ON u.id=p.user_id
 LEFT JOIN inscriptions ins ON r.kind='inscription' AND ins.id=r.target_id AND ins.player_id=r.player_id
 LEFT JOIN matches m ON r.kind='referee' AND m.id=r.target_id
 LEFT JOIN uniform_requests ur ON r.kind='uniform_request' AND ur.id=r.target_id AND ur.player_id=r.player_id
 LEFT JOIN uniform_issues ui ON r.kind='uniform_issue' AND ui.id=r.target_id AND ui.player_id=r.player_id
 LEFT JOIN uniforms f ON f.id=COALESCE(ur.uniform_id,ui.uniform_id)
 LEFT JOIN uniform_recipients d ON (r.kind='uniform_request' AND d.request_id=ur.id) OR (r.kind='uniform_issue' AND d.issue_id=ui.id)
 LEFT JOIN uniform_request_deletions x ON x.request_id=ur.id`;

export class SqliteQrPaymentRepository implements QrPaymentRepository {
  constructor(db: Database | ApplicationDatabase) {
      this.db = asAsyncDatabase(db);
  }
  async debts(playerId?: number): Promise<PaymentDebt[]> {
    const rows = (await this.db.prepare(`SELECT 'inscription' AS kind, i.id AS targetId, i.player_id AS playerId,
      u.full_name AS playerName, i.concept || ' · ' || i.season AS concept, i.amount, i.paid, 0 AS cancelled
      FROM inscriptions i JOIN players p ON p.id=i.player_id JOIN users u ON u.id=p.user_id
      UNION ALL SELECT 'uniform_request', r.id, r.player_id, u.full_name,
      'Solicitud: ' || f.name || ' · ' || r.size || CASE WHEN d.recipient_name IS NULL THEN '' ELSE ' · ' || d.recipient_name END, COALESCE(r.quoted_price,f.price), 0,
      CASE WHEN r.issue_id IS NULL AND EXISTS(SELECT 1 FROM uniform_request_deletions x WHERE x.request_id=r.id) THEN 1 ELSE 0 END
      FROM uniform_requests r JOIN uniforms f ON f.id=r.uniform_id JOIN players p ON p.id=r.player_id JOIN users u ON u.id=p.user_id
      LEFT JOIN uniform_recipients d ON d.request_id=r.id
      WHERE r.status IN ('pendiente','aprobada') OR r.issue_id IS NOT NULL
      UNION ALL SELECT 'uniform_issue', i.id, i.player_id, u.full_name, f.name || ' · ' || i.size || CASE WHEN d.recipient_name IS NULL THEN '' ELSE ' · ' || d.recipient_name END, i.cost, 0, 0
      FROM uniform_issues i JOIN uniforms f ON f.id=i.uniform_id JOIN players p ON p.id=i.player_id JOIN users u ON u.id=p.user_id
      LEFT JOIN uniform_recipients d ON d.issue_id=i.id
      WHERE NOT EXISTS(SELECT 1 FROM uniform_requests r WHERE r.issue_id=i.id)
    `).all()) as Omit<PaymentDebt, 'pending' | 'outstanding'>[];
    const receipts = (await this.receipts(playerId));
    return rows.filter(row => playerId === undefined || row.playerId === playerId).map(row => {
      const related = receipts.filter(r => r.kind === row.kind && r.targetId === row.targetId && r.playerId === row.playerId);
      const paid = row.kind === 'inscription' ? row.paid : related.filter(r => r.status === 'aprobado').reduce((a,r) => a+r.amount,0);
      const pending = related.filter(r => r.status === 'pendiente').reduce((a,r) => a+r.amount,0);
      return { ...row,cancelled:!!row.cancelled, paid, pending, outstanding: row.cancelled?0:Math.round(Math.max(0,row.amount-paid)*100)/100 };
    });
  }
  async receipts(playerId?: number): Promise<PaymentReceipt[]> {
    return ((await this.db.prepare(RECEIPTS + (playerId === undefined ? '' : ' WHERE r.player_id=?') + ' ORDER BY r.id DESC').all(...(playerId === undefined ? [] : [playerId]))) as PaymentReceipt[]).map(row=>({...row,requestDeleted:!!row.requestDeleted}));
  }
  async history(playerId?:number):Promise<PaymentHistoryEntry[]>{
    const receipts=await this.receipts(playerId),where=playerId===undefined?'':' WHERE i.player_id=?',params=playerId===undefined?[]:[playerId];
    const payments=await this.db.prepare(`SELECT p.id,p.inscription_id AS targetId,i.player_id AS playerId,u.full_name AS playerName,
      i.concept || ' · ' || i.season AS concept,p.amount,p.method,p.reference,p.paid_at AS paidAt,p.notes,p.idempotency_key AS paymentKey
      FROM payments p JOIN inscriptions i ON i.id=p.inscription_id JOIN players t ON t.id=i.player_id JOIN users u ON u.id=t.user_id${where}`).all(...params);
    const matched=new Set<number>();
    const history:PaymentHistoryEntry[]=payments.map(row=>{
      const receipt=receipts.find(item=>item.kind==='inscription'&&item.status==='aprobado'&&item.targetId===row.targetId&&item.playerId===row.playerId&&row.paymentKey==='receipt_'+item.id);
      if(receipt)matched.add(receipt.id);
      return {id:'payment:'+row.id,kind:'inscription',targetId:row.targetId,playerId:row.playerId,playerName:row.playerName,concept:row.concept,amount:row.amount,method:row.method,
        reference:row.reference??'',paidAt:row.paidAt,status:'aprobado',notes:[row.notes,receipt?.reviewNotes].filter(Boolean).join(' · '),receiptId:receipt?.id??null,assetId:receipt?.assetId??null,reviewedAt:receipt?.reviewedAt??null,requestDeleted:false,openingBalance:false};
    });
    for(const row of receipts)if(!matched.has(row.id))history.push({id:'receipt:'+row.id,kind:row.kind,targetId:row.targetId,playerId:row.playerId,playerName:row.playerName,concept:row.concept??'Pago #'+row.targetId,amount:row.amount,paidAt:row.paidAt,status:row.status,method:'qr',reference:row.reference,notes:row.reviewNotes,receiptId:row.id,assetId:row.assetId,reviewedAt:row.reviewedAt,requestDeleted:!!row.requestDeleted,openingBalance:false});
    const openings=await this.db.prepare(`SELECT i.id,i.player_id AS playerId,u.full_name AS playerName,i.concept || ' · ' || i.season AS concept,
      i.paid-COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.inscription_id=i.id),0)
      -COALESCE((SELECT SUM(r.amount) FROM payment_receipts r WHERE r.kind='inscription' AND r.target_id=i.id AND r.player_id=i.player_id AND r.status='aprobado'
        AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.inscription_id=i.id AND p.idempotency_key='receipt_' || r.id)),0) AS amount
      FROM inscriptions i JOIN players t ON t.id=i.player_id JOIN users u ON u.id=t.user_id${where}`).all(...params);
    for(const row of openings)if(row.amount>0.001)history.push({id:'opening:'+row.id,kind:'inscription',targetId:row.id,playerId:row.playerId,playerName:row.playerName,concept:row.concept,amount:row.amount,paidAt:null,status:'aprobado',method:'saldo_anterior',reference:'',notes:'Saldo anterior registrado sin movimiento ni comprobante detallado. No es una transferencia nueva.',receiptId:null,assetId:null,reviewedAt:null,requestDeleted:false,openingBalance:true});
    return history.sort((a,b)=>(b.paidAt??'').localeCompare(a.paidAt??'')||b.id.localeCompare(a.id));
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
