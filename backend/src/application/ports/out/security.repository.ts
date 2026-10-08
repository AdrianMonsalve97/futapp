export interface SecurityRepository {
  createSession(id:string,userId:number,stamp:string,expiresAt:number):void;
  session(id:string):{userId:number;stamp:string;expiresAt:number}|null;
  revokeSession(id:string):void;
  invitation():{digest:string;expiresAt:number}|null;
  setInvitation(digest:string,expiresAt:number):void;
}
