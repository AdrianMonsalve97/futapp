export interface SecurityRepository {
  claimPasswordReset(emailKey:string,now:number):Promise<boolean>;
  savePasswordReset(input:{userId:number;tokenHash:string;stamp:string;expiresAt:number;issuedAt:number;createdBy:number|null}):Promise<void>;
  consumePasswordReset(tokenHash:string,now:number):Promise<{userId:number;stamp:string}|null>;
  resetDelivery(tokenHash:string,state:'sent'|'failed'):Promise<void>;
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
