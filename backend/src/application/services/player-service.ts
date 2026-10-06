import * as bcrypt from 'bcryptjs';
import type {
  CreatePlayerInput,
  PlayerDetail,
  PlayerPort,
  UpdatePlayerInput,
} from '../ports/in/player.port';
import type { AiPort } from '../ports/in/ai.port';
import type { PlayerRepository, PlayerWithUser } from '../ports/out/player.repository';
import type { UpdatePlayerInput as PlayerRepoUpdateInput } from '../ports/out/player.repository';
import type { UpdateUserInput } from '../ports/out/user.repository';
import type { SanctionRepository } from '../ports/out/sanction.repository';
import type { StatsRepository } from '../ports/out/stats.repository';
import type { InscriptionRepository } from '../ports/out/inscription.repository';
import type { UniformIssueRepository } from '../ports/out/uniform-issue.repository';
import type { UserRepository } from '../ports/out/user.repository';
import type { PlayerListItem, Player, User } from '../../domain/entities';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { deriveInscriptionStatus, summarizeStats } from './shared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;
const POSITIONS = ['POR', 'DEF', 'MED', 'DEL'] as const;

export class PlayerService implements PlayerPort {
  constructor(
    private readonly users: UserRepository,
    private readonly players: PlayerRepository,
    private readonly inscriptions: InscriptionRepository,
    private readonly issues: UniformIssueRepository,
    private readonly sanctions: SanctionRepository,
    private readonly stats: StatsRepository,
    private readonly ai: AiPort,
  ) {}

  list(): PlayerListItem[] {
    return this.players.list().map((row) => {
      const stats = this.stats.list({ playerId: row.player.id });
      const inscription = this.inscriptions.findByPlayer(row.player.id)[0] ?? null;
      return {
        user: row.user,
        player: row.player,
        inscription: inscription
          ? {
              season: inscription.season,
              status: deriveInscriptionStatus(inscription.paid, inscription.amount),
              amount: inscription.amount,
              paid: inscription.paid,
              dueDate: inscription.dueDate,
            }
          : null,
        stats: summarizeStats(stats),
        activeSanctions: this.sanctions.list({ playerId: row.player.id, status: 'activa' }).length,
      };
    });
  }

  get(id: number): PlayerDetail {
    const row = this.requirePlayer(id);
    const stats = this.stats.list({ playerId: id });
    return {
      user: row.user,
      player: row.player,
      inscriptions: this.inscriptions
        .findByPlayer(id)
        .map((i) => ({ ...i, status: deriveInscriptionStatus(i.paid, i.amount) })),
      uniformIssues: this.issues.list(id),
      sanctions: this.sanctions.list({ playerId: id }),
      stats,
      summary: summarizeStats(stats),
      ai: this.ai.playerInsight(id),
    };
  }

  create(input: CreatePlayerInput): { user: User; player: Player } {
    const email = (input.email ?? '').trim().toLowerCase();
    const fullName = (input.fullName ?? '').trim();
    if (!EMAIL_RE.test(email)) throw new ValidationError('El email no es válido');
    if (!fullName) throw new ValidationError('El nombre completo es obligatorio');
    if ((input.password ?? '').length < MIN_PASSWORD) {
      throw new ValidationError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);
    }
    if (!input.position || !POSITIONS.includes(input.position)) {
      throw new ValidationError(`Posición inválida. Opciones: ${POSITIONS.join(', ')}`);
    }
    if (input.secondaryPosition && !POSITIONS.includes(input.secondaryPosition)) {
      throw new ValidationError(`Posición secundaria inválida. Opciones: ${POSITIONS.join(', ')}`);
    }
    if (this.users.findByEmail(email)) {
      throw new ValidationError('El email ya está registrado');
    }
    const user = this.users.create({
      email,
      passwordHash: bcrypt.hashSync(input.password, 10),
      fullName,
      phone: input.phone ?? null,
      role: 'player',
    });
    const player = this.players.create({
      userId: user.id,
      dni: input.dni ?? null,
      birthDate: input.birthDate ?? null,
      position: input.position,
      secondaryPosition: input.secondaryPosition ?? null,
      shirtNumber: input.shirtNumber ?? null,
      heightCm: input.heightCm ?? null,
      weightKg: input.weightKg ?? null,
      foot: input.foot ?? null,
      emergencyContact: input.emergencyContact ?? null,
    });
    return { user, player };
  }

  update(id: number, input: UpdatePlayerInput): { user: User; player: Player } {
    const row = this.requirePlayer(id);
    if (input.position !== undefined && !POSITIONS.includes(input.position)) {
      throw new ValidationError(`Posición inválida. Opciones: ${POSITIONS.join(', ')}`);
    }
    if (input.secondaryPosition && !POSITIONS.includes(input.secondaryPosition)) {
      throw new ValidationError(`Posición secundaria inválida. Opciones: ${POSITIONS.join(', ')}`);
    }
    // Protección: no degradar al último administrador activo.
    if (
      input.role === 'player' &&
      row.user.role === 'admin' &&
      this.users.countActiveAdmins(id) === 0
    ) {
      throw new ValidationError('No se puede quitar el rol al último administrador activo');
    }

    const userUpdate: UpdateUserInput = {};
    if (input.fullName !== undefined) userUpdate.fullName = input.fullName;
    if (input.phone !== undefined) userUpdate.phone = input.phone;
    if (input.role !== undefined) userUpdate.role = input.role;
    if (input.active !== undefined) userUpdate.active = input.active;
    const user = Object.keys(userUpdate).length > 0 ? this.users.update(id, userUpdate) : row.user;

    const playerUpdate: PlayerRepoUpdateInput = {};
    if (input.dni !== undefined) playerUpdate.dni = input.dni;
    if (input.birthDate !== undefined) playerUpdate.birthDate = input.birthDate;
    if (input.position !== undefined) playerUpdate.position = input.position;
    if (input.secondaryPosition !== undefined) playerUpdate.secondaryPosition = input.secondaryPosition;
    if (input.shirtNumber !== undefined) playerUpdate.shirtNumber = input.shirtNumber;
    if (input.heightCm !== undefined) playerUpdate.heightCm = input.heightCm;
    if (input.weightKg !== undefined) playerUpdate.weightKg = input.weightKg;
    if (input.foot !== undefined) playerUpdate.foot = input.foot;
    if (input.emergencyContact !== undefined) playerUpdate.emergencyContact = input.emergencyContact;
    const player =
      Object.keys(playerUpdate).length > 0 ? this.players.update(id, playerUpdate) : row.player;

    return { user, player };
  }

  remove(id: number): { ok: true } {
    const row = this.requirePlayer(id);
    if (row.user.role === 'admin' && row.user.active && this.users.countActiveAdmins(id) === 0) {
      throw new ValidationError('No se puede dar de baja al último administrador activo');
    }
    this.users.update(id, { active: false });
    return { ok: true };
  }

  private requirePlayer(id: number): PlayerWithUser {
    const row = this.players.findWithUser(id);
    if (!row) throw new NotFoundError('Jugador no encontrado');
    return row;
  }
}
