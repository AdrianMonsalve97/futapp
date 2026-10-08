export interface SecurityRepository {
  createSession(id:string,userId:number,stamp:string,expiresAt:number):Promise<void>;
  session(id:string):Promise<{userId:number;stamp:string;expiresAt:number}|null>;
  revokeSession(id:string):Promise<void>;
  invitation():Promise<{digest:string;expiresAt:number}|null>;
  setInvitation(digest:string,expiresAt:number):Promise<void>;
}
