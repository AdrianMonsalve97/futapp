import type { DashboardAdmin, DashboardPlayer } from '../../../domain/entities';

/** Casos de uso de dashboards (§7.9). */
export interface DashboardPort {
  admin(): Promise<DashboardAdmin>;
  player(userId: number): Promise<DashboardPlayer>;
}
