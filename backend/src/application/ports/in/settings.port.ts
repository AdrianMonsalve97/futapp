import type { TeamSettings } from '../../../domain/entities';
import type { FormatProfile, TeamFormat } from '../../../domain/formats';
import type { FormationDef } from '../../../domain/formations';

export interface SettingsUpdateInput {
  brandColor?: string;
  defaultTournamentId?: number | null;
  teamName?: string;
  format?: number;
  season?: string;
}

export interface FormationCatalog {
  formats: FormatProfile[];
  formations: FormationDef[];
}

/** Casos de uso de configuración global y catálogo (§12.4). */
export interface SettingsPort {
  get(): TeamSettings;
  update(input: SettingsUpdateInput): TeamSettings;
  /** Catálogo completo: 4 perfiles de formato y 14 formaciones (§12.2). */
  catalog(): FormationCatalog;
}
