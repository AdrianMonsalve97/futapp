import type { NotificationJob, NotificationSettings, NotificationPreferences, NotificationRecipient, NewNotificationJob, NotificationStatus } from '../../../domain/notifications';
export interface NotificationRepository {
  settings(): Promise<NotificationSettings>;
  setSettings(settings: NotificationSettings): Promise<void>;
  preferences(userId: number): Promise<NotificationPreferences>;
  setPreferences(userId: number, preferences: NotificationPreferences): Promise<void>;
  recipients(): Promise<NotificationRecipient[]>;
  revisionKey(matchId: number, revision: string): Promise<string>;
  enqueue(job: NewNotificationJob, now: number): Promise<number>;
  history(): Promise<NotificationJob[]>;
  find(id: number): Promise<NotificationJob | null>;
  claim(now: number): Promise<NotificationJob | null>;
  beginAttempt(id: number, now: number): Promise<NotificationJob>;
  finish(id: number, status: NotificationStatus, now: number, error?: string | null, providerId?: string | null, nextAttemptAt?: number): Promise<void>;
  cancelMatch(matchId: number, now: number): Promise<void>;
  cancelUser(userId: number, now: number): Promise<void>;
  recoverInterrupted(now: number): Promise<void>;
  retry(id: number, now: number): Promise<boolean>;
}
