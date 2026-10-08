export interface SecurityRepository {
  requestRegistration(userId:number):Promise<void>;
  pendingRegistration(userId:number):Promise<boolean>;
  approveRegistration(userId:number,reviewerId:number):Promise<void>;
  createSession(id:string,userId:number,stamp:string,expiresAt:number):Promise<void>;
  session(id:string):Promise<{userId:number;stamp:string;expiresAt:number;lastActivityAt:number}|null>;
  touchSession(id:string,now:number,idleTimeoutMs:number):Promise<boolean>;
  expireIdleSession(id:string,cutoff:number):Promise<boolean>;
  revokeSession(id:string):Promise<void>;
  invitation():Promise<{digest:string;expiresAt:number}|null>;
  setInvitation(digest:string,expiresAt:number):Promise<void>;
}
