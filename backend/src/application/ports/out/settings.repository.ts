import type { TeamFormat } from '../../../domain/formats';

/** Fila de `team_settings` en formato de dominio. */
export interface TeamSettingsData {
  teamName: string;
  format: TeamFormat;
  season: string;
}

export type TeamSettingsPatch = Partial<TeamSettingsData>;

/** Puerto de salida para la configuración global del equipo (`team_settings`, §12.3). */
export interface SettingsRepository {
  /** Siempre devuelve la fila única (id = 1); la crea con defaults si no existe. */
  get(): TeamSettingsData;
  update(patch: TeamSettingsPatch): TeamSettingsData;
}
