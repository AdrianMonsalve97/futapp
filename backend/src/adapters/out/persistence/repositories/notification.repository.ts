import type { Database } from 'better-sqlite3';
import type { NotificationRepository } from '../../../../application/ports/out/notification.repository';
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_NOTIFICATION_PREFERENCES } from '../../../../domain/notifications';
import type { NotificationJob, NotificationSettings, NotificationPreferences, NotificationRecipient, NewNotificationJob, NotificationStatus } from '../../../../domain/notifications';
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

// Applied by migrate() on both new and existing databases. No notification secrets are persisted here.
export function migrateNotifications(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS notification_settings (id INTEGER PRIMARY KEY CHECK(id=1), config TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notification_preferences (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, preferences TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notification_match_versions (match_id INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE, revision TEXT NOT NULL, sequence INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS notification_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, event_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('whatsapp','email')), recipient TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
      receipt_id INTEGER REFERENCES payment_receipts(id) ON DELETE CASCADE, message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','enviando','aceptado','bloqueado','fallido','incierto','cancelado')),
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, provider_id TEXT, error TEXT
    ); CREATE INDEX IF NOT EXISTS notification_jobs_due ON notification_jobs(status,next_attempt_at);`);
  db.prepare('INSERT OR IGNORE INTO notification_settings(id,config) VALUES(1,?)').run(JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS));
}
function mapJob(row: any): NotificationJob {
  return { id:row.id,eventKey:row.event_key,kind:row.kind,channel:row.channel,recipient:row.recipient,userId:row.user_id,
    matchId:row.match_id,receiptId:row.receipt_id,message:JSON.parse(row.message),status:row.status,attempts:row.attempts,
    nextAttemptAt:row.next_attempt_at,createdAt:row.created_at,updatedAt:row.updated_at,providerId:row.provider_id,error:row.error };
}
export class SqliteNotificationRepository implements NotificationRepository {
  constructor(db: Database | ApplicationDatabase) {
      this.db = asAsyncDatabase(db);
  }
  async settings(): Promise<NotificationSettings> { return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(((await this.db.prepare('SELECT config FROM notification_settings WHERE id=1').get()) as any).config) }; }
  async setSettings(settings: NotificationSettings) { (await this.db.prepare('UPDATE notification_settings SET config=? WHERE id=1').run(JSON.stringify(settings))); }
  async preferences(userId: number): Promise<NotificationPreferences> {
    const row=(await this.db.prepare('SELECT preferences FROM notification_preferences WHERE user_id=?').get(userId)) as any;
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(row?JSON.parse(row.preferences):{}) };
  }
  async setPreferences(userId: number, prefs: NotificationPreferences) {
    (await this.db.prepare('INSERT INTO notification_preferences(user_id,preferences) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET preferences=excluded.preferences').run(userId,JSON.stringify(prefs)));
  }
  async recipients(): Promise<NotificationRecipient[]> {
    return ((await this.db.prepare(`SELECT u.id,u.email,n.preferences FROM notification_preferences n JOIN users u ON u.id=n.user_id
      JOIN players p ON p.user_id=u.id WHERE u.active=1 AND u.role='player'`).all()) as any[])
      .map(row=>({...DEFAULT_NOTIFICATION_PREFERENCES,...JSON.parse(row.preferences),userId:row.id,emailAddress:row.email}));
  }
  async revisionKey(matchId: number, revision: string): Promise<string> {
    return (await this.db.transaction(async ()=>{
          (await this.db.prepare(`INSERT INTO notification_match_versions(match_id,revision,sequence) VALUES(?,?,1)
        ON CONFLICT(match_id) DO UPDATE SET revision=excluded.revision,sequence=notification_match_versions.sequence+1 WHERE notification_match_versions.revision<>excluded.revision`).run(matchId,revision));
          const row=(await this.db.prepare('SELECT sequence FROM notification_match_versions WHERE match_id=?').get(matchId)) as {sequence:number};
          return `${revision}:${row.sequence}`;
        })());
  }
  async enqueue(job: NewNotificationJob, now: number): Promise<number> {
    return (await this.db.prepare(`INSERT INTO notification_jobs(event_key,kind,channel,recipient,user_id,match_id,receipt_id,message,next_attempt_at,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_key) DO UPDATE SET status='pendiente',recipient=excluded.recipient,
        message=excluded.message,next_attempt_at=excluded.next_attempt_at,updated_at=excluded.updated_at,error=NULL
        WHERE notification_jobs.status='cancelado'`).run(job.eventKey,job.kind,job.channel,job.recipient,job.userId,job.matchId,job.receiptId,JSON.stringify(job.message),job.nextAttemptAt,now,now)).changes;
  }
  async history() { return ((await this.db.prepare('SELECT * FROM notification_jobs ORDER BY id DESC LIMIT 200').all()) as any[]).map(mapJob); }
  async find(id: number) { const row=(await this.db.prepare('SELECT * FROM notification_jobs WHERE id=?').get(id)); return row?mapJob(row):null; }
  async claim(now: number): Promise<NotificationJob | null> {
    return (await this.db.transaction(async ()=>{
          const row=(await this.db.prepare("SELECT * FROM notification_jobs WHERE status IN ('pendiente','bloqueado') AND next_attempt_at<=? ORDER BY id LIMIT 1").get(now)) as any;
          if (!row) return null;
          (await this.db.prepare("UPDATE notification_jobs SET status='enviando',updated_at=? WHERE id=?").run(now,row.id));
          return (await this.find(row.id));
        }).immediate());
  }
  async beginAttempt(id: number, now: number): Promise<NotificationJob> {
    (await this.db.prepare("UPDATE notification_jobs SET attempts=attempts+1,updated_at=? WHERE id=? AND status='enviando'").run(now,id));
    return (await this.find(id))!;
  }
  async finish(id: number, status: NotificationStatus, now: number, error: string|null=null, providerId: string|null=null, nextAttemptAt=now) {
    (await this.db.prepare('UPDATE notification_jobs SET status=?,updated_at=?,error=?,provider_id=?,next_attempt_at=? WHERE id=?').run(status,now,error,providerId,nextAttemptAt,id));
  }
  async cancelMatch(matchId: number, now: number) { (await this.db.prepare("UPDATE notification_jobs SET status='cancelado',updated_at=?,error='Información del partido actualizada' WHERE match_id=? AND status IN ('pendiente','bloqueado')").run(now,matchId)); }
  async cancelUser(userId: number, now: number) { (await this.db.prepare("UPDATE notification_jobs SET status='cancelado',updated_at=?,error='Preferencias del destinatario actualizadas' WHERE user_id=? AND status IN ('pendiente','bloqueado')").run(now,userId)); }
  async recoverInterrupted(now: number) { (await this.db.prepare("UPDATE notification_jobs SET status='incierto',error='El proceso se interrumpió durante el envío. Comprueba el proveedor antes de reintentar.',updated_at=? WHERE status='enviando' AND updated_at<?").run(now,now-120000)); }
  async retry(id: number, now: number) { return (await this.db.prepare("UPDATE notification_jobs SET status='pendiente',next_attempt_at=?,updated_at=?,attempts=0,error=NULL WHERE id=? AND status IN ('fallido','bloqueado','incierto')").run(now,now,id)).changes>0; }

    private readonly db: ApplicationDatabase;
}
