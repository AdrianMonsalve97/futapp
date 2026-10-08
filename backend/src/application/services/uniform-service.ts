import type { UnitOfWork } from '../ports/out/unit-of-work';
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
import { uniformRecipient } from '../../domain/uniform-order';

const UNIFORM_KINDS: UniformKind[] = ['completo', 'camiseta', 'pantalon', 'medias', 'buzo', 'entrenamiento', 'guantes'];
const UNIFORM_VARIANTS: UniformVariant[] = ['titular', 'alterna', 'entrenamiento'];
const CONDITIONS: UniformCondition[] = ['nuevo', 'bueno', 'regular', 'danado'];
const REQUEST_STATUSES: UniformRequestStatus[] = ['pendiente', 'aprobada', 'rechazada', 'entregada'];

export class UniformService implements UniformPort {
  constructor(
    private readonly uniforms: UniformRepository,
    private readonly issues: UniformIssueRepository,
    private readonly requests: UniformRequestRepository,
    private readonly players: PlayerRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async listUniforms(): Promise<Uniform[]> {
    return (await this.uniforms.list());
  }

  async createUniform(input: CreateUniformInput): Promise<Uniform> {
    (await this.validateUniform(input));
    if (!input.name || !input.name.trim()) throw new ValidationError('El nombre es obligatorio');
    if (!UNIFORM_KINDS.includes(input.kind)) {
      throw new ValidationError(`Tipo de uniforme inválido. Opciones: ${UNIFORM_KINDS.join(', ')}`);
    }
    if (input.variant && !UNIFORM_VARIANTS.includes(input.variant)) {
      throw new ValidationError(`Variante inválida. Opciones: ${UNIFORM_VARIANTS.join(', ')}`);
    }
    return (await this.uniforms.create(input));
  }

  async updateUniform(id: number, input: UpdateUniformInput): Promise<Uniform> {
    const current = (await this.uniforms.findById(id));
    if (!current) throw new NotFoundError('Uniforme no encontrado');
    (await this.validateUniform(input));
    if (input.kind && !UNIFORM_KINDS.includes(input.kind)) {
      throw new ValidationError(`Tipo de uniforme inválido. Opciones: ${UNIFORM_KINDS.join(', ')}`);
    }
    if (input.variant && !UNIFORM_VARIANTS.includes(input.variant)) {
      throw new ValidationError(`Variante inválida. Opciones: ${UNIFORM_VARIANTS.join(', ')}`);
    }
    if (input.kind && input.kind !== 'camiseta' && current.kind === 'camiseta') {
      const [requests, issues] = await Promise.all([this.requests.list(), this.issues.list()]);
      if ([...requests, ...issues].some(order => order.uniformId === id && order.recipientType && order.recipientType !== 'jugador')) {
        throw new ValidationError('Esta camiseta tiene pedidos de familiares. Crea otra prenda para el uniforme completo.');
      }
    }
    return (await this.uniforms.update(id, input));
  }

  async removeUniform(id: number): Promise<{ ok: true }> {
    const current = (await this.uniforms.findById(id));
    if (!current) throw new NotFoundError('Uniforme no encontrado');
    (await this.uniforms.remove(id));
    return { ok: true };
  }

  async listIssues(playerId?: number): Promise<UniformIssue[]> {
    return (await this.issues.list(playerId));
  }

  async createIssue(input: CreateIssueInput): Promise<UniformIssue> {
    return (await this.uow.run(async () => {
          const player = (await this.players.findById(input.playerId));
          if (!player) throw new NotFoundError('Jugador no encontrado');
          const uniform = (await this.uniforms.findById(input.uniformId));
          if (!uniform) throw new NotFoundError('Uniforme no encontrado');
          if (!uniform.active) throw new ValidationError('El uniforme está inactivo');
          const recipient=uniformRecipient(input,uniform.kind);
          if (uniform.stock <= 0) {
            throw new ValidationError(`Sin stock disponible de "${uniform.name}"`);
          }
          if (input.condition && !CONDITIONS.includes(input.condition)) {
            throw new ValidationError(`Condición inválida. Opciones: ${CONDITIONS.join(', ')}`);
          }
          const issue = (await this.issues.create({
                  ...input,
                  ...recipient,
                  cost: input.cost ?? uniform.price,
                }));
          (await this.uniforms.update(uniform.id, { stock: uniform.stock - 1 }));
          return issue;
        }));
  }

  async updateIssue(id: number, input: UpdateIssueInput): Promise<UniformIssue> {
    return (await this.uow.run(async () => {
          const current = (await this.issues.findById(id));
          if (!current) throw new NotFoundError('Entrega no encontrada');
          if (input.condition && !CONDITIONS.includes(input.condition)) {
            throw new ValidationError(`Condición inválida. Opciones: ${CONDITIONS.join(', ')}`);
          }
          if (current.returned && input.returned === false) throw new ValidationError('Una devolución registrada no se puede deshacer');
          const updated = (await this.issues.update(id, input));
          // Al marcar la devolución se repone el stock una sola vez.
          if (input.returned === true && !current.returned) {
            const uniform = (await this.uniforms.findById(current.uniformId));
            if (uniform) (await this.uniforms.update(uniform.id, { stock: uniform.stock + 1 }));
          }
          return updated;
        }));
  }

  async listRequests(status?: UniformRequestStatus): Promise<UniformRequest[]> {
    return (await this.requests.list(status));
  }

  async updateRequest(id: number, input: UpdateRequestInput): Promise<UniformRequest> {
    return (await this.uow.run(async () => {
          const current = (await this.requests.findById(id));
          if (!current) throw new NotFoundError('Solicitud no encontrada');
          if (!REQUEST_STATUSES.includes(input.status)) {
            throw new ValidationError(`Estado inválido. Opciones: ${REQUEST_STATUSES.join(', ')}`);
          }

          if (current.status === 'entregada' && input.status !== 'entregada') throw new ValidationError('Una solicitud entregada no puede cambiar de estado');
          if (input.status === 'entregada' && current.status !== 'entregada') {
            const uniform = (await this.uniforms.findById(current.uniformId));
            if (!uniform) throw new NotFoundError('Uniforme no encontrado');
            if (!uniform.active) throw new ValidationError('El uniforme está inactivo');
            if (uniform.stock <= 0) {
              throw new ValidationError(`Sin stock disponible de "${uniform.name}"`);
            }
            const issue = (await this.issues.create({
                      playerId: current.playerId,
                      uniformId: current.uniformId,
                      size: current.size,
                      cost: current.quotedPrice ?? uniform.price,
                      condition: 'nuevo',
                      notes: current.reason,
                      ...uniformRecipient(current,uniform.kind),
                    }));
            (await this.requests.update(id, { issueId: issue.id }));
            (await this.uniforms.update(uniform.id, { stock: uniform.stock - 1 }));
          }

          const reviewedAt = input.status === 'pendiente' ? current.reviewedAt : nowIso();
          return (await this.requests.update(id, {
                  status: input.status,
                  reviewNotes: input.reviewNotes ?? current.reviewNotes,
                  reviewedAt,
                }));
        }));
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
