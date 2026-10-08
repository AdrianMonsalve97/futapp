export type NotificationChannel = 'whatsapp' | 'email';
export type NotificationKind = 'match' | 'reminder_24h' | 'reminder_2h' | 'receipt_uploaded' | 'receipt_reviewed' | 'test';
export type NotificationStatus = 'pendiente' | 'enviando' | 'aceptado' | 'bloqueado' | 'fallido' | 'incierto' | 'cancelado';
export interface NotificationSettings {
  whatsappProvider: 'meta' | 'evolution';
  matchDestination: 'players' | 'group';
  matchGroupId: string; matchGroupName: string;
  whatsappEnabled: boolean; emailEnabled: boolean;
  matchAnnouncements: boolean; reminder24h: boolean; reminder2h: boolean; paymentAlerts: boolean;
  adminWhatsapp: string; adminEmail: string; publicBaseUrl: string;
  matchTemplate: string; paymentTemplate: string; templateLanguage: string;
}
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  whatsappProvider: 'evolution', matchDestination: 'group', matchGroupId: '', matchGroupName: '',
  whatsappEnabled: false, emailEnabled: false, matchAnnouncements: true,
  reminder24h: true, reminder2h: true, paymentAlerts: true,
  adminWhatsapp: '', adminEmail: '', publicBaseUrl: '',
  matchTemplate: 'futapp_partido', paymentTemplate: 'futapp_pago', templateLanguage: 'es',
};
export interface NotificationPreferences {
  whatsapp: boolean; email: boolean; whatsappNumber: string; matchAlerts: boolean; paymentUpdates: boolean;
}
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  whatsapp: false, email: false, whatsappNumber: '', matchAlerts: true, paymentUpdates: true,
};
export interface NotificationRecipient extends NotificationPreferences { userId: number; emailAddress: string; }
export interface NotificationMessage { club: string; title: string; detail: string; path: string; matchRevision?: string; audience?: 'group' | 'admin' | 'player'; }
export interface NotificationJob {
  id: number; eventKey: string; kind: NotificationKind; channel: NotificationChannel;
  recipient: string; userId: number | null; matchId: number | null; receiptId: number | null;
  message: NotificationMessage; status: NotificationStatus; attempts: number;
  nextAttemptAt: number; createdAt: number; updatedAt: number; providerId: string | null; error: string | null;
}
export type NewNotificationJob = Omit<NotificationJob, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt' | 'providerId' | 'error'>;
export interface NotificationProviderStatus { ready: boolean; missing: string[]; }
export interface WhatsAppGroup { id: string; name: string; }
export const GROUP_JID=/^\d{5,30}(?:-\d{5,20})?@g\.us$/;
export class NotificationDeliveryError extends Error {
  constructor(message: string, public readonly outcome: 'blocked' | 'retry' | 'failed' | 'uncertain') { super(message); }
}
export interface NotificationEvents {
  matchChanged(match: import('./entities').Match, previous?: import('./entities').Match): Promise<void>;
  receiptUploaded(receipt: import('./payments').PaymentReceipt): Promise<void>;
  receiptReviewed(receipt: import('./payments').PaymentReceipt): Promise<void>;
}
