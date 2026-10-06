import type {
  FormationCatalog,
  SettingsPort,
  SettingsUpdateInput,
} from '../ports/in/settings.port';
import type { SettingsRepository } from '../ports/out/settings.repository';
import type { TeamSettings } from '../../domain/entities';
import { ValidationError } from '../../domain/errors';
import { FORMAT_LIST, getFormat, isTeamFormat } from '../../domain/formats';
import { FORMATION_LIST } from '../../domain/formations';

const MAX_NAME_LENGTH = 80;

/** §12.4 · Configuración global (`GET/PUT /api/settings`) y catálogo (`GET /api/formations`). */
export class SettingsService implements SettingsPort {
  constructor(private readonly settings: SettingsRepository) {}

  get(): TeamSettings {
    return this.toResponse();
  }

  update(input: SettingsUpdateInput): TeamSettings {
    const patch: Parameters<SettingsRepository['update']>[0] = {};

    if (input.teamName !== undefined) {
      const name = String(input.teamName).trim();
      if (!name) throw new ValidationError('El nombre del equipo es obligatorio');
      if (name.length > MAX_NAME_LENGTH) {
        throw new ValidationError(`El nombre del equipo no puede superar ${MAX_NAME_LENGTH} caracteres`);
      }
      patch.teamName = name;
    }

    if (input.format !== undefined) {
      const format = Number(input.format);
      if (!isTeamFormat(format)) {
        throw new ValidationError('Formato inválido. Opciones: 5, 7, 8, 11');
      }
      patch.format = format;
    }

    if (input.season !== undefined) {
      const season = String(input.season).trim();
      if (!season) throw new ValidationError('La temporada es obligatoria');
      patch.season = season;
    }

    if (Object.keys(patch).length === 0) {
      throw new ValidationError('Debes indicar al menos un campo a actualizar');
    }

    this.settings.update(patch);
    return this.toResponse();
  }

  catalog(): FormationCatalog {
    return {
      formats: FORMAT_LIST,
      formations: FORMATION_LIST,
    };
  }

  private toResponse(): TeamSettings {
    const data = this.settings.get();
    return {
      teamName: data.teamName,
      format: data.format,
      season: data.season,
      profile: getFormat(data.format),
    };
  }
}
