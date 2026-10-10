import type { Database } from 'better-sqlite3';
import type { SecurityRepository } from '../../../../application/ports/out/security.repository';
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

export class SqliteSecurityRepository implements SecurityRepository {
  async claimPasswordReset(emailKey:string,now:number){
    await this.db.prepare('DELETE FROM password_reset_requests WHERE last_requested_at<?').run(now-86400000);
    const result=await this.db.prepare(`INSERT INTO password_reset_requests(email_key,window_start,last_requested_at,attempts) VALUES(?,?,?,1)
      ON CONFLICT(email_key) DO UPDATE SET window_start=CASE WHEN password_reset_requests.window_start<=? THEN ? ELSE password_reset_requests.window_start END,
      attempts=CASE WHEN password_reset_requests.window_start<=? THEN 1 ELSE password_reset_requests.attempts+1 END,last_requested_at=?
      WHERE password_reset_requests.last_requested_at<=? AND (password_reset_requests.window_start<=? OR password_reset_requests.attempts<5)`).run(emailKey,now,now,now-3600000,now,now-3600000,now,now-60000,now-3600000);
    return result.changes>0;
  }
  async savePasswordReset(input:Parameters<SecurityRepository['savePasswordReset']>[0]){
    await this.db.prepare('DELETE FROM password_reset_tokens WHERE expires_at<=?').run(input.issuedAt);
    await this.db.prepare(`INSERT INTO password_reset_tokens(user_id,token_hash,stamp,expires_at,issued_at,created_by,delivery_state) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,stamp=excluded.stamp,expires_at=excluded.expires_at,issued_at=excluded.issued_at,created_by=excluded.created_by,delivery_state=excluded.delivery_state`).run(input.userId,input.tokenHash,input.stamp,input.expiresAt,input.issuedAt,input.createdBy,input.createdBy===null?'pending':'manual');
  }
  async consumePasswordReset(tokenHash:string,now:number){return (await this.db.prepare('DELETE FROM password_reset_tokens WHERE token_hash=? AND expires_at>? RETURNING user_id AS "userId",stamp').get(tokenHash,now))??null;}
  async resetDelivery(tokenHash:string,state:'sent'|'failed'){await this.db.prepare('UPDATE password_reset_tokens SET delivery_state=? WHERE token_hash=?').run(state,tokenHash);}
  async requestRegistration(userId:number){await this.db.prepare('INSERT INTO registration_requests(user_id) VALUES(?)').run(userId);}
  async pendingRegistration(userId:number){return !!await this.db.prepare("SELECT user_id FROM registration_requests WHERE user_id=? AND status='pendiente'").get(userId);}
  async approveRegistration(userId:number,reviewerId:number){await this.db.prepare("UPDATE registration_requests SET status='aprobada',reviewed_by=?,reviewed_at=? WHERE user_id=? AND status='pendiente'").run(reviewerId,new Date().toISOString(),userId);}
  constructor(db:Database | ApplicationDatabase){
      this.db = asAsyncDatabase(db);
  }
  async createSession(id:string,userId:number,stamp:string,expiresAt:number){
    (await this.db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(Date.now()));
    (await this.db.prepare('INSERT INTO auth_sessions(id,user_id,stamp,expires_at,last_activity_at) VALUES(?,?,?,?,?)').run(id,userId,stamp,expiresAt,Date.now()));
  }
  async session(id:string){const row=(await this.db.prepare('SELECT user_id AS userId,stamp,expires_at AS expiresAt,last_activity_at AS lastActivityAt FROM auth_sessions WHERE id=?').get(id));return row as Awaited<ReturnType<SecurityRepository['session']>>??null;}
  async touchSession(id:string,now:number,idleTimeoutMs:number){
    const result=await this.db.prepare('UPDATE auth_sessions SET last_activity_at=CASE WHEN last_activity_at>? THEN last_activity_at ELSE ? END WHERE id=? AND last_activity_at>? AND expires_at>?').run(now,now,id,now-idleTimeoutMs,now);
    return result.changes>0;
  }
  async expireIdleSession(id:string,cutoff:number){return (await this.db.prepare('DELETE FROM auth_sessions WHERE id=? AND last_activity_at<=?').run(id,cutoff)).changes>0;}
  async revokeSession(id:string){(await this.db.prepare('DELETE FROM auth_sessions WHERE id=?').run(id));}
  async invitation(){return ((await this.db.prepare('SELECT digest,expires_at AS expiresAt FROM registration_invitation WHERE id=1').get()) as Awaited<ReturnType<SecurityRepository['invitation']>>)??null;}
  async setInvitation(digest:string,expiresAt:number){(await this.db.prepare('INSERT INTO registration_invitation(id,digest,expires_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET digest=excluded.digest,expires_at=excluded.expires_at').run(digest,expiresAt));}

    private readonly db: ApplicationDatabase;
}
