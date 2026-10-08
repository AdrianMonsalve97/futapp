import type { Database } from 'better-sqlite3';
import type { SecurityRepository } from '../../../../application/ports/out/security.repository';
import { asAsyncDatabase, type ApplicationDatabase } from "../async-database";

export class SqliteSecurityRepository implements SecurityRepository {
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
