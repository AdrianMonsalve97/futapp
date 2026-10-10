export interface RecoveryMail {email:string;name:string;url?:string;kind:'reset'|'changed'}
export interface RecoveryMailer {
  status():{ready:boolean;missing:string[]};
  send(message:RecoveryMail):Promise<void>;
}
