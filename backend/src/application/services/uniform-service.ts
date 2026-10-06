import type {
  CreateIssueInput,
  CreateUniformInput,
  UniformPort,
  UpdateIssueInput,
  UpdateRequestInput,
  UpdateUniformInput,
} from '../ports/in/uniform.port';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { UniformIssueRepository } from '../ports/out/uniform-issue.repository';
import type { UniformRequestRepository } from '../ports/out/uniform-request.repository';
import type { UniformRepository } from '../ports/out/uniform.repository';
import type {
  Uniform,
  UniformCondition,
  UniformIssue,
  UniformKind,
  UniformRequest,
  UniformRequestStatus,
  UniformVariant,
} from '../../domain/entities';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { nowIso } from './shared';

const UNIFORM_KINDS: UniformKind[] = ['camiseta', 'pantalon', 'medias', 'buzo', 'entrenamiento', 'guantes'];
const UNIFORM_VARIANTS: UniformVariant[] = ['titular', 'alterna', 'entrenamiento'];
const CONDITIONS: UniformCondition[] = ['nuevo', 'bueno', 'regular', 'danado'];
const REQUEST_STATUSES: UniformRequestStatus[] = ['pendiente', 'aprobada', 'rechazada', 'entregada'];

export class UniformService implements UniformPort {
  constructor(
    private readonly uniforms: UniformRepository,
    private readonly issues: UniformIssueRepository,
    private readonly requests: UniformRequestRepository,
    private readonly players: PlayerRepository,
  ) {}

  listUniforms(): Uniform[] {
    return this.uniforms.list();
  }

  createUniform(input: CreateUniformInput): Uniform {
    this.validateUniform(input);
    if (!input.name || !input.name.trim()) throw new ValidationError('El nombre es obligatorio');
    if (!UNIFORM_KINDS.includes(input.kind)) {
      throw new ValidationError(`Tipo de uniforme inválido. Opciones: ${UNIFORM_KINDS.join(', ')}`);
    }
    if (input.variant && !UNIFORM_VARIANTS.includes(input.variant)) {
      throw new ValidationError(`Variante inválida. Opciones: ${UNIFORM_VARIANTS.join(', ')}`);
    }
    return this.uniforms.create(input);
  }

  updateUniform(id: number, input: UpdateUniformInput): Uniform {
    const current = this.uniforms.findById(id);
    if (!current) throw new NotFoundError('Uniforme no encontrado');
    this.validateUniform(input);
    if (input.kind && !UNIFORM_KINDS.includes(input.kind)) {
      throw new ValidationError(`Tipo de uniforme inválido. Opciones: ${UNIFORM_KINDS.join(', ')}`);
    }
    if (input.variant && !UNIFORM_VARIANTS.includes(input.variant)) {
      throw new ValidationError(`Variante inválida. Opciones: ${UNIFORM_VARIANTS.join(', ')}`);
    }
    return this.uniforms.update(id, input);
  }

  removeUniform(id: number): { ok: true } {
    const current = this.uniforms.findById(id);
    if (!current) throw new NotFoundError('Uniforme no encontrado');
    this.uniforms.remove(id);
    return { ok: true };
  }

  listIssues(playerId?: number): UniformIssue[] {
    return this.issues.list(playerId);
  }

  createIssue(input: CreateIssueInput): UniformIssue {
    const player = this.players.findById(input.playerId);
    if (!player) throw new NotFoundError('Jugador no encontrado');
    const uniform = this.uniforms.findById(input.uniformId);
    if (!uniform) throw new NotFoundError('Uniforme no encontrado');
    if (!uniform.active) throw new ValidationError('El uniforme está inactivo');
    if (uniform.stock <= 0) {
      throw new ValidationError(`Sin stock disponible de "${uniform.name}"`);
    }
    if (input.condition && !CONDITIONS.includes(input.condition)) {
      throw new ValidationError(`Condición inválida. Opciones: ${CONDITIONS.join(', ')}`);
    }
    const issue = this.issues.create({
      ...input,
      cost: input.cost ?? uniform.price,
    });
    this.uniforms.update(uniform.id, { stock: uniform.stock - 1 });
    return issue;
  }

  updateIssue(id: number, input: UpdateIssueInput): UniformIssue {
    const current = this.issues.findById(id);
    if (!current) throw new NotFoundError('Entrega no encontrada');
    if (input.condition && !CONDITIONS.includes(input.condition)) {
      throw new ValidationError(`Condición inválida. Opciones: ${CONDITIONS.join(', ')}`);
    }
    const updated = this.issues.update(id, input);
    // Al marcar la devolución se repone el stock una sola vez.
    if (input.returned === true && !current.returned) {
      const uniform = this.uniforms.findById(current.uniformId);
      if (uniform) this.uniforms.update(uniform.id, { stock: uniform.stock + 1 });
    }
    return updated;
  }

  listRequests(status?: UniformRequestStatus): UniformRequest[] {
    return this.requests.list(status);
  }

  updateRequest(id: number, input: UpdateRequestInput): UniformRequest {
    const current = this.requests.findById(id);
    if (!current) throw new NotFoundError('Solicitud no encontrada');
    if (!REQUEST_STATUSES.includes(input.status)) {
      throw new ValidationError(`Estado inválido. Opciones: ${REQUEST_STATUSES.join(', ')}`);
    }

    if (input.status === 'entregada' && current.status !== 'entregada') {
      const uniform = this.uniforms.findById(current.uniformId);
      if (!uniform) throw new NotFoundError('Uniforme no encontrado');
      if (uniform.stock <= 0) {
        throw new ValidationError(`Sin stock disponible de "${uniform.name}"`);
      }
      this.issues.create({
        playerId: current.playerId,
        uniformId: current.uniformId,
        size: current.size,
        cost: uniform.price,
        condition: 'nuevo',
        notes: current.reason,
      });
      this.uniforms.update(uniform.id, { stock: uniform.stock - 1 });
    }

    const reviewedAt = input.status === 'pendiente' ? current.reviewedAt : nowIso();
    return this.requests.update(id, {
      status: input.status,
      reviewNotes: input.reviewNotes ?? current.reviewNotes,
      reviewedAt,
    });
  }

  private validateUniform(input: { price?: number; stock?: number; minStock?: number }): void {
    if (input.price !== undefined && input.price < 0) {
      throw new ValidationError('El precio no puede ser negativo');
    }
    if (input.stock !== undefined && input.stock < 0) {
      throw new ValidationError('El stock no puede ser negativo');
    }
    if (input.minStock !== undefined && input.minStock < 0) {
      throw new ValidationError('El stock mínimo no puede ser negativo');
    }
  }
}
