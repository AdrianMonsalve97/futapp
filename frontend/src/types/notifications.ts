export interface NotificationSettings {
  whatsappProvider:'meta'|'evolution';matchDestination:'players'|'group';matchGroupId:string;matchGroupName:string;
  whatsappEnabled:boolean;emailEnabled:boolean;matchAnnouncements:boolean;reminder24h:boolean;reminder2h:boolean;paymentAlerts:boolean;
  adminWhatsapp:string;adminEmail:string;publicBaseUrl:string;matchTemplate:string;paymentTemplate:string;templateLanguage:string;
}
export interface NotificationPreferences {whatsapp:boolean;email:boolean;whatsappNumber:string;matchAlerts:boolean;paymentUpdates:boolean;}
export interface NotificationJob {
  id:number;kind:string;channel:'whatsapp'|'email';recipient:string;matchId:number|null;receiptId:number|null;
  message:{club:string;title:string;detail:string;path:string};
  status:'pendiente'|'enviando'|'aceptado'|'bloqueado'|'fallido'|'incierto'|'cancelado';attempts:number;
  createdAt:number;updatedAt:number;providerId:string|null;error:string|null;
}
export interface NotificationsView {
  settings:NotificationSettings;providers:Record<'whatsapp'|'email',{ready:boolean;missing:string[]}>;
  history:NotificationJob[];recipients:number;
}
