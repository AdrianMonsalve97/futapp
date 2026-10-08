import type { UnitOfWork } from '../ports/out/unit-of-work';
import * as bcrypt from 'bcryptjs';
import type {
  MePort,
  MeResponse,
  MatchView,
  ProfileInput,
} from '../ports/in/me.port';
import type { AiPort } from '../ports/in/ai.port';
import type { InscriptionRepository } from '../ports/out/inscription.repository';
import type { MatchRepository } from '../ports/out/match.repository';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { SanctionRepository } from '../ports/out/sanction.repository';
import type { StatsRepository } from '../ports/out/stats.repository';
import type { UniformIssueRepository } from '../ports/out/uniform-issue.repository';
import type { UniformRequestRepository } from '../ports/out/uniform-request.repository';
import type { UniformRepository } from '../ports/out/uniform.repository';
import type { UserRepository } from '../ports/out/user.repository';
import type {
  LineupSlot,
  Match,
  MatchStat,
  Player,
  User,
} from '../../domain/entities';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { deriveInscriptionStatus, emptyStatsSummary, summarizeStats } from './shared';

import { validatePassword } from '../../domain/password-policy';
const UPCOMING = new Set(['programado', 'pospuesto']);

export class MeService implements MePort {
  constructor(
    private readonly users: UserRepository,
    private readonly players: PlayerRepository,
    private readonly inscriptions: InscriptionRepository,
    private readonly issues: UniformIssueRepository,
    private readonly requests: UniformRequestRepository,
    private readonly uniforms: UniformRepository,
    private readonly sanctions: SanctionRepository,
    private readonly stats: StatsRepository,
    private readonly matches: MatchRepository,
    private readonly ai: AiPort,
    private readonly uow: UnitOfWork,
  ) {}

  getMe(userId: number): MeResponse {
    const { user, player } = this.requireUser(userId);
    const stats = player ? this.stats.list({ playerId: player.id }) : [];
    const inscription = player ? this.inscriptions.findByPlayer(player.id)[0] ?? null : null;
    return {
      user,
      player,
      stats: summarizeStats(stats),
      inscription: inscription
        ? { ...inscription, status: deriveInscriptionStatus(inscription.paid, inscription.amount) }
        : null,
      sanctions: player ? this.sanctions.list({ playerId: player.id }) : [],
      issuedUniforms: player ? this.issues.list(player.id) : [],
      pendingRequests: player ? this.requests.list('pendiente', player.id).length : 0,
      forecast: player ? this.forecastOf(player) : null,
    };
  }

  updateProfile(userId: number, input: ProfileInput): { user: User; player: Player } {
    return this.uow.run(() => {
      const { user, player } = this.requireUser(userId);
      if (!player) {
        throw new ValidationError('Este usuario no tiene ficha de jugador');
      }
      const phone = input.phone !== undefined ? input.phone : user.phone;
      const updatedUser = this.users.update(userId, { phone });

      const update: Parameters<PlayerRepository['update']>[1] = {};
      if (input.dni !== undefined) update.dni = input.dni;
      if (input.birthDate !== undefined) update.birthDate = input.birthDate;
      if (input.position !== undefined) update.position = input.position;
      if (input.secondaryPosition !== undefined) update.secondaryPosition = input.secondaryPosition;
      if (input.shirtNumber !== undefined) update.shirtNumber = input.shirtNumber;
      if (input.heightCm !== undefined) update.heightCm = input.heightCm;
      if (input.weightKg !== undefined) update.weightKg = input.weightKg;
      if (input.foot !== undefined) update.foot = input.foot;
      if (input.emergencyContact !== undefined) update.emergencyContact = input.emergencyContact;
      if (input.eps !== undefined) update.eps = input.eps;
      if (input.prepaidHealth !== undefined) update.prepaidHealth = input.prepaidHealth;
      const updatedPlayer = Object.keys(update).length > 0 ? this.players.update(player.id, update) : player;

      return { user: updatedUser, player: updatedPlayer };
    });
  }

  changePassword(userId: number, currentPassword: string, newPassword: string): { ok: true } {
    const stored = this.users.findByEmail(this.requireUser(userId).user.email);
    if (!stored) throw new NotFoundError('Usuario no encontrado');
    if (!currentPassword || !bcrypt.compareSync(currentPassword, stored.passwordHash)) {
      throw new ValidationError('La contraseña actual no es correcta');
    }
    validatePassword(newPassword);
    this.users.update(userId, { passwordHash: bcrypt.hashSync(newPassword, 10) });
    return { ok: true };
  }

  getInscription(userId: number): {
    inscription: ReturnType<InscriptionRepository['findById']>;
    payments: ReturnType<InscriptionRepository['listPayments']>;
  } {
    const player = this.requirePlayer(userId);
    const inscription = this.inscriptions.findByPlayer(player.id)[0] ?? null;
    if (!inscription) return { inscription: null, payments: [] };
    return {
      inscription: {
        ...inscription,
        status: deriveInscriptionStatus(inscription.paid, inscription.amount),
      },
      payments: this.inscriptions.listPayments(inscription.id),
    };
  }

  getUniforms(userId: number) {
    const player = this.requirePlayer(userId);
    return {
      issued: this.issues.list(player.id),
      requests: this.requests.list(undefined, player.id),
      catalog: this.uniforms.list(),
    };
  }

  createUniformRequest(
    userId: number,
    input: { uniformId: number; size: string; reason?: string | null },
  ): { request: ReturnType<UniformRequestRepository['create']> } {
    const player = this.requirePlayer(userId);
    if (!Number.isInteger(input.uniformId)) {
      throw new ValidationError('Debes indicar un uniforme válido');
    }
    const uniform = this.uniforms.findById(input.uniformId);
    if (!uniform) throw new NotFoundError('Uniforme no encontrado');
    if (!uniform.active) throw new ValidationError('El uniforme no está disponible para solicitud');
    if (!input.size || !input.size.trim()) {
      throw new ValidationError('La talla es obligatoria');
    }
    const request = this.requests.create({
      playerId: player.id,
      uniformId: uniform.id,
      size: input.size.trim(),
      reason: input.reason ?? null,
    });
    return { request };
  }

  getMatches(userId: number): { upcoming: MatchView[]; finished: MatchView[] } {
    const player = this.requirePlayer(userId);
    const views = this.matches.list().map((match) => this.toMatchView(match, player.id));
    return {
      upcoming: views
        .filter((m) => UPCOMING.has(m.status))
        .sort((a, b) => a.kickOff.localeCompare(b.kickOff)),
      finished: views
        .filter((m) => !UPCOMING.has(m.status))
        .sort((a, b) => b.kickOff.localeCompare(a.kickOff)),
    };
  }

  getStats(userId: number): { summary: ReturnType<typeof summarizeStats>; matches: MatchStat[] } {
    const player = this.players.findByUserId(userId);
    if (!player) return { summary: emptyStatsSummary(), matches: [] };
    const matches = this.stats.list({ playerId: player.id });
    return { summary: summarizeStats(matches), matches };
  }

  getAi(userId: number,matchId?:number) {
    const player = this.requirePlayer(userId);
    return this.ai.playerInsight(player.id,matchId);
  }

  private toMatchView(match: Match, playerId: number): MatchView {
    const lineup = this.matches.getPublishedLineup(match.id);
    const mySlot: LineupSlot | null = lineup.find((slot) => slot.playerId === playerId) ?? null;
    return {
      ...match,
      formation: match.publishedFormation ?? match.formation,
      mySlot,
      strategiesCount: this.matches.listStrategies(match.id).length,
      lineupFilled: lineup.filter((slot) => slot.playerId !== null).length,
    };
  }

  private forecastOf(player: Player): { nextRating: number; confidence: number; trend: string } | null {
    const insight = this.ai.playerInsight(player.id);
    if (insight.forecast.history.length === 0) return null;
    return {
      nextRating: insight.forecast.nextRating,
      confidence: insight.forecast.confidence,
      trend: insight.forecast.trend,
    };
  }

  private requireUser(userId: number): { user: User; player: Player | null } {
    const user = this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario no encontrado');
    return { user, player: this.players.findByUserId(userId) };
  }

  private requirePlayer(userId: number): Player {
    const player = this.players.findByUserId(userId);
    if (!player) throw new NotFoundError('No tienes ficha de jugador');
    return player;
  }
}
