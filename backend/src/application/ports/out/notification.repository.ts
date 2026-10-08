import type { NotificationJob, NotificationSettings, NotificationPreferences, NotificationRecipient, NewNotificationJob, NotificationStatus } from '../../../domain/notifications';
export interface NotificationRepository {
  settings(): NotificationSettings;
  setSettings(settings: NotificationSettings): void;
  preferences(userId: number): NotificationPreferences;
  setPreferences(userId: number, preferences: NotificationPreferences): void;
  recipients(): NotificationRecipient[];
  revisionKey(matchId: number, revision: string): string;
  enqueue(job: NewNotificationJob, now: number): number;
  history(): NotificationJob[];
  find(id: number): NotificationJob | null;
  claim(now: number): NotificationJob | null;
  beginAttempt(id: number, now: number): NotificationJob;
  finish(id: number, status: NotificationStatus, now: number, error?: string | null, providerId?: string | null, nextAttemptAt?: number): void;
  cancelMatch(matchId: number, now: number): void;
  cancelUser(userId: number, now: number): void;
  recoverInterrupted(now: number): void;
  retry(id: number, now: number): boolean;
}
