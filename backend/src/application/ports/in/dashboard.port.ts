import type { DashboardAdmin, DashboardPlayer } from '../../../domain/entities';

/** Casos de uso de dashboards (§7.9). */
export interface DashboardPort {
  admin(): DashboardAdmin;
  player(userId: number): DashboardPlayer;
}
