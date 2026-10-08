import type { NotificationChannel, NotificationJob, NotificationProviderStatus, NotificationSettings, WhatsAppGroup } from '../../../domain/notifications';
export interface NotificationTransport {
  status(channel: NotificationChannel, provider?: 'meta' | 'evolution'): NotificationProviderStatus;
  groups?(): Promise<WhatsAppGroup[]>;
  connection?(): Promise<{state: 'connected' | 'disconnected'}>;
  connect?(): Promise<{qr: string | null; state: 'connected' | 'scan_required'}>;
  send(job: NotificationJob, settings: NotificationSettings): Promise<string>;
}
