import type { SanctionPort, SanctionFiltersInput, CreateSanctionInput, UpdateSanctionInput } from '../ports/in/sanction.port';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { SanctionRepository } from '../ports/out/sanction.repository';
import type { Sanction, SanctionType } from '../../domain/entities';
import { NotFoundError, ValidationError } from '../../domain/errors';

const SANCTION_TYPES: SanctionType[] = [
  'tarjeta_amarilla',
  'tarjeta_roja',
  'suspension',
  'multa',
  'amonestacion',
];

export class SanctionService implements SanctionPort {
  constructor(
    private readonly sanctions: SanctionRepository,
    private readonly players: PlayerRepository,
  ) {}

  async list(filters: SanctionFiltersInput = {}): Promise<Sanction[]> {
    return (await this.sanctions.list(filters));
  }

  async create(input: CreateSanctionInput): Promise<Sanction> {
    if (!input.reason || !input.reason.trim()) {
      throw new ValidationError('El motivo de la sanción es obligatorio');
    }
    if (!SANCTION_TYPES.includes(input.type)) {
      throw new ValidationError(`Tipo de sanción inválido. Opciones: ${SANCTION_TYPES.join(', ')}`);
    }
    const player = (await this.players.findById(input.playerId));
    if (!player) throw new NotFoundError('Jugador no encontrado');
    if (input.amount !== undefined && input.amount < 0) {
      throw new ValidationError('El monto no puede ser negativo');
    }
    if (input.points !== undefined && input.points < 0) {
      throw new ValidationError('Los puntos no pueden ser negativos');
    }
    return (await this.sanctions.create(input));
  }

  async update(id: number, input: UpdateSanctionInput): Promise<Sanction> {
    const current = (await this.sanctions.findById(id));
    if (!current) throw new NotFoundError('Sanción no encontrada');
    if (input.reason !== undefined && !input.reason.trim()) {
      throw new ValidationError('El motivo de la sanción es obligatorio');
    }
    if (input.amount !== undefined && input.amount < 0) {
      throw new ValidationError('El monto no puede ser negativo');
    }
    if (input.points !== undefined && input.points < 0) {
      throw new ValidationError('Los puntos no pueden ser negativos');
    }
    return (await this.sanctions.update(id, input));
  }

  async remove(id: number): Promise<{ ok: true }> {
    const current = (await this.sanctions.findById(id));
    if (!current) throw new NotFoundError('Sanción no encontrada');
    (await this.sanctions.remove(id));
    return { ok: true };
  }
}
