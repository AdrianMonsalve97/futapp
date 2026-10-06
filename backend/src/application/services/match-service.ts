import type {
  CreateMatchInput,
  LineupEntryInput,
  MatchDetail,
  MatchPort,
  StrategyInput,
  UpdateMatchInput,
  XiSuggestion,
} from '../ports/in/match.port';
import type { AiPort } from '../ports/in/ai.port';
import type { MatchRepository } from '../ports/out/match.repository';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { SettingsRepository } from '../ports/out/settings.repository';
import type { StatsRepository } from '../ports/out/stats.repository';
import type {
  LineupSlot,
  Match,
  MatchStat,
  MatchStatus,
  Strategy,
  StrategyKind,
} from '../../domain/entities';
import { formationBelongsTo, formationsFor, getFormation } from '../../domain/formations';
import { getFormat, isTeamFormat, type FormatProfile, type TeamFormat } from '../../domain/formats';
import { NotFoundError, ValidationError } from '../../domain/errors';

const KICKOFF_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const MATCH_STATUSES: MatchStatus[] = ['programado', 'jugado', 'cancelado', 'pospuesto'];
const STRATEGY_KINDS: StrategyKind[] = ['general', 'ataque', 'defensa', 'pelota_parada', 'transicion'];
const UPCOMING: MatchStatus[] = ['programado', 'pospuesto'];
const MAX_MATCH_MINUTES = 400;

export class MatchService implements MatchPort {
  constructor(
    private readonly matches: MatchRepository,
    private readonly players: PlayerRepository,
    private readonly stats: StatsRepository,
    private readonly ai: AiPort,
    private readonly settings: SettingsRepository,
  ) {}

  list(): Match[] {
    const all = this.matches.list();
    const upcoming = all
      .filter((m) => UPCOMING.includes(m.status))
      .sort((a, b) => a.kickOff.localeCompare(b.kickOff));
    const finished = all
      .filter((m) => !UPCOMING.includes(m.status))
      .sort((a, b) => b.kickOff.localeCompare(a.kickOff));
    return [...upcoming, ...finished];
  }

  get(id: number): MatchDetail {
    const match = this.requireMatch(id);
    return {
      match,
      strategies: this.matches.listStrategies(id),
      lineup: this.lineupFor(match),
      stats: this.stats.list({ matchId: id }),
    };
  }

  create(input: CreateMatchInput): Match {
    this.validateMatchInput(input);
    const format = this.resolveFormat(input.format);
    const profile = getFormat(format);
    const formation = (input.formation ?? '').trim() || profile.defaultFormation;
    this.assertFormationInFormat(formation, format);
    const minutes = this.resolveMinutes(input.minutes, profile);
    return this.matches.create({
      ...input,
      status: 'programado',
      formation,
      format,
      minutes,
    });
  }

  update(id: number, input: UpdateMatchInput): Match {
    const current = this.requireMatch(id);
    this.validateMatchInput(input);
    if (input.status !== undefined && !MATCH_STATUSES.includes(input.status)) {
      throw new ValidationError(`Estado inválido. Opciones: ${MATCH_STATUSES.join(', ')}`);
    }

    const format = input.format !== undefined ? this.resolveFormat(input.format) : current.format;
    const profile = getFormat(format);
    const formatChanged = format !== current.format;

    let formation = input.formation ?? current.formation;
    if (input.formation === undefined && formatChanged && !formationBelongsTo(formation, format)) {
      formation = profile.defaultFormation; // la formación vieja no existe en el formato nuevo
    }
    this.assertFormationInFormat(formation, format);

    const minutes =
      input.minutes !== undefined
        ? this.resolveMinutes(input.minutes, profile)
        : formatChanged
          ? profile.matchMinutes
          : current.minutes;

    const updated = this.matches.update(id, { ...input, formation, format, minutes });

    // Si cambió el formato o la formación, la alineación guardada debe re-alinearse.
    if (formatChanged || formation !== current.formation) {
      this.realignLineup(id, formation, format);
    }
    return updated;
  }

  remove(id: number): { ok: true } {
    this.requireMatch(id);
    this.matches.remove(id);
    return { ok: true };
  }

  setFormation(id: number, formation: string): { match: Match; lineup: LineupSlot[] } {
    const match = this.requireMatch(id);
    const key = (formation ?? '').trim();
    // §12.2: una formación solo es válida dentro del formato del partido (400).
    this.assertFormationInFormat(key, match.format);
    const catalog = getFormation(key, match.format);
    const previous = this.matches.getLineup(id);
    const playerBySlot = new Map(previous.map((slot) => [slot.slotIndex, slot.playerId]));
    const slots = catalog.slots.map((slot) => ({
      slotIndex: slot.slotIndex,
      playerId: playerBySlot.get(slot.slotIndex) ?? null,
      x: slot.x,
      y: slot.y,
      role: slot.role,
      label: slot.label,
    }));
    const lineup = this.matches.replaceLineup(id, slots);
    const updated = this.matches.update(id, { formation: catalog.key });
    return { match: updated, lineup };
  }

  addStrategy(matchId: number, input: StrategyInput): Strategy {
    this.requireMatch(matchId);
    return this.matches.createStrategy(this.validateStrategy(matchId, input));
  }

  updateStrategy(id: number, input: Partial<StrategyInput>): Strategy {
    const current = this.matches.findStrategy(id);
    if (!current) throw new NotFoundError('Estrategia no encontrada');
    if (input.title !== undefined && !input.title.trim()) {
      throw new ValidationError('El título de la estrategia es obligatorio');
    }
    if (input.kind !== undefined && !STRATEGY_KINDS.includes(input.kind)) {
      throw new ValidationError(`Tipo de estrategia inválido. Opciones: ${STRATEGY_KINDS.join(', ')}`);
    }
    if (input.content !== undefined && !input.content.trim()) {
      throw new ValidationError('El contenido de la estrategia es obligatorio');
    }
    return this.matches.updateStrategy(id, input);
  }

  removeStrategy(id: number): { ok: true } {
    const current = this.matches.findStrategy(id);
    if (!current) throw new NotFoundError('Estrategia no encontrada');
    this.matches.removeStrategy(id);
    return { ok: true };
  }

  setLineup(id: number, slots: LineupEntryInput[]): { lineup: LineupSlot[] } {
    const match = this.requireMatch(id);
    const profile = getFormat(match.format);
    if (!Array.isArray(slots)) {
      throw new ValidationError('Debes enviar la lista de posiciones de la alineación');
    }
    // §12.4: exactamente `playersOnPitch` jugadores en cancha (400 si no).
    if (slots.length !== profile.playersOnPitch) {
      throw new ValidationError(
        `La alineación del ${profile.name} debe tener exactamente ${profile.playersOnPitch} posiciones en cancha; recibiste ${slots.length}`,
      );
    }
    const catalog = getFormation(match.formation, match.format);
    if (slots.length !== catalog.slots.length) {
      throw new ValidationError(
        `La alineación de ${catalog.key} debe tener ${catalog.slots.length} posiciones`,
      );
    }
    const canonical = new Map(catalog.slots.map((slot) => [slot.slotIndex, slot]));
    const seen = new Set<number>();
    const assigned: number[] = [];
    for (const slot of slots) {
      const target = canonical.get(slot.slotIndex);
      if (!target) {
        throw new ValidationError(
          `La posición ${slot.slotIndex} no pertenece a la formación ${catalog.key}`,
        );
      }
      if (seen.has(slot.slotIndex)) {
        throw new ValidationError(`La posición ${slot.slotIndex} está duplicada`);
      }
      seen.add(slot.slotIndex);
      if (slot.playerId !== null && slot.playerId !== undefined) {
        if (!Number.isInteger(slot.playerId)) {
          throw new ValidationError('Identificador de jugador inválido');
        }
        if (!this.players.findById(slot.playerId)) {
          throw new NotFoundError(`El jugador ${slot.playerId} no existe`);
        }
        assigned.push(slot.playerId);
      }
    }
    if (new Set(assigned).size !== assigned.length) {
      throw new ValidationError('Un jugador no puede ocupar dos posiciones del alineación');
    }
    const lineupSlots = slots.map((slot) => {
      const target = canonical.get(slot.slotIndex) as NonNullable<
        ReturnType<typeof canonical.get>
      >;
      return {
        slotIndex: slot.slotIndex,
        playerId: slot.playerId ?? null,
        x: target.x,
        y: target.y,
        role: target.role,
        label: target.label,
      };
    });
    return { lineup: this.matches.replaceLineup(id, lineupSlots) };
  }

  autoLineup(id: number, formation?: string): XiSuggestion {
    const match = this.requireMatch(id);
    // La formación pedida debe pertenecer al formato del partido (§12.2 → 400).
    if (formation !== undefined && String(formation).trim()) {
      this.assertFormationInFormat(String(formation).trim(), match.format);
    }
    return this.ai.recommendXi(id, formation);
  }

  saveStats(
    matchId: number,
    entries: Array<Partial<MatchStat> & { playerId: number }>,
  ): { entries: MatchStat[] } {
    const match = this.requireMatch(matchId);
    if (!Array.isArray(entries)) {
      throw new ValidationError('Debes enviar la lista de estadísticas');
    }
    const clean: Array<Partial<MatchStat> & { playerId: number }> = [];
    for (const entry of entries) {
      if (!Number.isInteger(entry.playerId)) {
        throw new ValidationError('Cada entrada debe indicar un jugador válido (playerId)');
      }
      if (!this.players.findById(entry.playerId)) {
        throw new NotFoundError(`El jugador ${entry.playerId} no existe`);
      }
      if (entry.rating !== undefined && (entry.rating < 1 || entry.rating > 10)) {
        throw new ValidationError('La calificación debe estar entre 1 y 10');
      }
      if (entry.minutes !== undefined) {
        // §12.7.7 / DoD: los minutos no pueden superar la duración del partido.
        if (!Number.isInteger(entry.minutes) || entry.minutes < 0 || entry.minutes > match.minutes) {
          throw new ValidationError(
            `Los minutos deben estar entre 0 y ${match.minutes} (duración del partido)`,
          );
        }
      }
      clean.push(entry);
    }
    return { entries: this.stats.upsert(matchId, clean) };
  }

  getStats(matchId: number): { entries: MatchStat[] } {
    this.requireMatch(matchId);
    return { entries: this.stats.list({ matchId }) };
  }

  /* ------------------------------------------------------------------ */
  /* Helpers de formato (§12)                                           */
  /* ------------------------------------------------------------------ */

  /** Formato efectivo: el pedido o el global del equipo (`team_settings.format`). */
  private resolveFormat(raw: number | undefined): TeamFormat {
    if (raw === undefined) return this.settings.get().format;
    const format = Number(raw);
    if (!isTeamFormat(format)) {
      throw new ValidationError('Formato inválido. Opciones: 5, 7, 8, 11');
    }
    return format;
  }

  /** Duración: la pedida o `profile.matchMinutes` (§12.4). */
  private resolveMinutes(raw: number | undefined, profile: FormatProfile): number {
    if (raw === undefined) return profile.matchMinutes;
    const minutes = Number(raw);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MATCH_MINUTES) {
      throw new ValidationError(
        `La duración del partido debe ser un número entero entre 1 y ${MAX_MATCH_MINUTES} minutos`,
      );
    }
    return minutes;
  }

  /** §12.2: 400 si la formación no pertenece al formato indicado. */
  private assertFormationInFormat(key: string, format: TeamFormat): void {
    const profile = getFormat(format);
    if (!formationBelongsTo(key, format)) {
      const options = formationsFor(format)
        .map((f) => f.key)
        .join(', ');
      throw new ValidationError(
        `La formación "${key}" no pertenece al ${profile.name}. Opciones: ${options}`,
      );
    }
  }

  /** Alineación garantizada con `profile.playersOnPitch` slots (§12.4). */
  private lineupFor(match: Match): LineupSlot[] {
    const profile = getFormat(match.format);
    const lineup = this.matches.getLineup(match.id);
    if (lineup.length === profile.playersOnPitch) return lineup;

    const catalog = getFormation(match.formation, match.format);
    const bySlot = new Map(lineup.map((slot) => [slot.slotIndex, slot]));
    return catalog.slots.map((slot) => {
      const existing = bySlot.get(slot.slotIndex);
      if (existing && existing.playerId !== null && existing.playerId !== undefined) {
        const row = this.players.findWithUser(existing.playerId);
        return {
          ...existing,
          x: slot.x,
          y: slot.y,
          role: slot.role,
          label: slot.label,
          playerName: row ? row.user.fullName : (existing.playerName ?? null),
          shirtNumber: row ? row.player.shirtNumber : (existing.shirtNumber ?? null),
          playerPosition: row ? row.player.position : (existing.playerPosition ?? null),
        };
      }
      return {
        slotIndex: slot.slotIndex,
        playerId: null,
        playerName: null,
        x: slot.x,
        y: slot.y,
        role: slot.role,
        label: slot.label,
      };
    });
  }

  /** Re-alinea los slots guardados a la formación/formato vigentes conservando jugadores. */
  private realignLineup(matchId: number, formationKey: string, format: TeamFormat): void {
    const catalog = getFormation(formationKey, format);
    const lineup = this.matches.getLineup(matchId);
    const fits =
      lineup.length === catalog.slots.length &&
      catalog.slots.every((slot) => lineup.some((l) => l.slotIndex === slot.slotIndex));
    if (fits) return;
    const playerBySlot = new Map(lineup.map((slot) => [slot.slotIndex, slot.playerId]));
    this.matches.replaceLineup(
      matchId,
      catalog.slots.map((slot) => ({
        slotIndex: slot.slotIndex,
        playerId: playerBySlot.get(slot.slotIndex) ?? null,
        x: slot.x,
        y: slot.y,
        role: slot.role,
        label: slot.label,
      })),
    );
  }

  private requireMatch(id: number): Match {
    const match = this.matches.findById(id);
    if (!match) throw new NotFoundError('Partido no encontrado');
    return match;
  }

  private validateMatchInput(input: Partial<CreateMatchInput> & Partial<UpdateMatchInput>): void {
    if (input.opponent !== undefined && !input.opponent.trim()) {
      throw new ValidationError('El rival es obligatorio');
    }
    if (input.kickOff !== undefined && !KICKOFF_RE.test(input.kickOff.trim())) {
      throw new ValidationError('La fecha y hora del partido debe tener formato YYYY-MM-DDTHH:mm');
    }
    if (input.goalsFor !== undefined && input.goalsFor !== null && input.goalsFor < 0) {
      throw new ValidationError('Los goles a favor no pueden ser negativos');
    }
    if (input.goalsAgainst !== undefined && input.goalsAgainst !== null && input.goalsAgainst < 0) {
      throw new ValidationError('Los goles en contra no pueden ser negativos');
    }
  }

  private validateStrategy(matchId: number, input: StrategyInput): {
    matchId: number;
    title: string;
    kind: StrategyKind;
    content: string;
  } {
    if (!input.title || !input.title.trim()) {
      throw new ValidationError('El título de la estrategia es obligatorio');
    }
    if (!STRATEGY_KINDS.includes(input.kind)) {
      throw new ValidationError(`Tipo de estrategia inválido. Opciones: ${STRATEGY_KINDS.join(', ')}`);
    }
    if (!input.content || !input.content.trim()) {
      throw new ValidationError('El contenido de la estrategia es obligatorio');
    }
    return { matchId, title: input.title.trim(), kind: input.kind, content: input.content };
  }
}
