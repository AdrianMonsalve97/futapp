import type { Database } from 'better-sqlite3';
import type { SecurityRepository } from '../../../../application/ports/out/security.repository';
export class SqliteSecurityRepository implements SecurityRepository {
  constructor(private readonly db:Database){}
  createSession(id:string,userId:number,stamp:string,expiresAt:number){
    this.db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(Date.now());
    this.db.prepare('INSERT INTO auth_sessions(id,user_id,stamp,expires_at) VALUES(?,?,?,?)').run(id,userId,stamp,expiresAt);
  }
  session(id:string){const row=this.db.prepare('SELECT user_id AS userId,stamp,expires_at AS expiresAt FROM auth_sessions WHERE id=?').get(id);return row as ReturnType<SecurityRepository['session']>;}
  revokeSession(id:string){this.db.prepare('DELETE FROM auth_sessions WHERE id=?').run(id);}
  invitation(){return (this.db.prepare('SELECT digest,expires_at AS expiresAt FROM registration_invitation WHERE id=1').get() as ReturnType<SecurityRepository['invitation']>)??null;}
  setInvitation(digest:string,expiresAt:number){this.db.prepare('INSERT INTO registration_invitation(id,digest,expires_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET digest=excluded.digest,expires_at=excluded.expires_at').run(digest,expiresAt);}
}
