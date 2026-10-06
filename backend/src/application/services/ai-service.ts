import type { AiPort, XiSuggestion } from '../ports/in/ai.port';
import type { InscriptionRepository } from '../ports/out/inscription.repository';
import type { MatchRepository } from '../ports/out/match.repository';
import type { ModelStore } from '../ports/out/model-store';
import type { PlayerRepository } from '../ports/out/player.repository';
import type { SanctionRepository } from '../ports/out/sanction.repository';
import type { SettingsRepository } from '../ports/out/settings.repository';
import type { StatsRepository } from '../ports/out/stats.repository';
import type { UniformRepository } from '../ports/out/uniform.repository';
import type { UniformRequestRepository } from '../ports/out/uniform-request.repository';
import type {
  AiInsights,
  AiPlayerInsight,
  LineupSlot,
  Match,
  ModelInfo,
} from '../../domain/entities';
import { NotFoundError } from '../../domain/errors';
import {
  formationBelongsTo,
  formationsFor,
  getFormation,
  type FormationDef,
} from '../../domain/formations';
import { getFormat, type FormatProfile, type TeamFormat } from '../../domain/formats';
import {
  averageFeaturesByPlayer,
  extractFeatureSamples,
  type FeatureSample,
} from '../../domain/model/features';
import {
  buildRecommendation,
  buildStrengthsWeaknesses,
  confidenceFor,
  computeOutcome,
  meanStd,
  MODEL_NAME,
  predictedRating,
  round2,
  selectXi,
  trendFrom,
  trainModel,
  weightedForecast,
  type ModelArtifact,
  type XiCandidate,
} from '../../domain/model/performance-model';
import { deriveInscriptionStatus, formatMoney, mean } from './shared';

const BASELINE_OPP_RATING = 6.4;
const BASELINE_PLAYER_RATING = 6.5;
const UPCOMING = new Set(['programado', 'pospuesto']);

interface PlayerRating {
  predicted: number;
  avgRating: number;
  features: number[];
}

type InsightItem = AiInsights['insights'][number];

export class AiService implements AiPort {
  private artifactCache: ModelArtifact | null = null;

  constructor(
    private readonly stats: StatsRepository,
    private readonly matches: MatchRepository,
    private readonly players: PlayerRepository,
    private readonly sanctions: SanctionRepository,
    private readonly inscriptions: InscriptionRepository,
    private readonly uniforms: UniformRepository,
    private readonly uniformRequests: UniformRequestRepository,
    private readonly modelStore: ModelStore,
    private readonly settings: SettingsRepository,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Formatos (§12)                                                      */
  /* ------------------------------------------------------------------ */

  /** Perfil del formato global del equipo (`team_settings.format`). */
  private teamProfile(): FormatProfile {
    return getFormat(this.settings.get().format);
  }

  /** Mapa partido → minutos de su formato: base de la normalización (§12.1). */
  private formatMinutesByMatch(): Map<number, number> {
    const map = new Map<number, number>();
    for (const match of this.matches.list()) {
      map.set(match.id, getFormat(match.format).matchMinutes);
    }
    return map;
  }

  private samples(): ReturnType<typeof extractFeatureSamples> {
    return extractFeatureSamples(this.stats.listAll(), this.formatMinutesByMatch());
  }

  /* ------------------------------------------------------------------ */
  /* Modelo                                                             */
  /* ------------------------------------------------------------------ */

  private trainFromData(): ModelArtifact {
    const profile = this.teamProfile();
    const samples = this.samples();
    return trainModel(
      samples.map((s) => s.features),
      samples.map((s) => s.rating),
      {
        minSamples: profile.ai.minSamples,
        format: profile.format,
        formatMinutes: profile.matchMinutes,
      },
    );
  }

  private model(): ModelArtifact {
    if (this.artifactCache) return this.artifactCache;
    const profile = this.teamProfile();
    const stored = this.modelStore.load();
    if (stored && stored.format === profile.format) {
      this.artifactCache = stored;
      return stored;
    }
    // No existe o fue entrenado con otro formato: (re)entrena con los datos
    // existentes; las features ya están normalizadas por el formato de cada
    // partido, por lo que son comparables entre formatos (§12.5.6).
    const artifact = this.trainFromData();
    this.artifactCache = artifact;
    this.modelStore.save(artifact);
    return artifact;
  }

  getModelInfo(): ModelInfo {
    return this.toInfo(this.model());
  }

  train(): ModelInfo {
    const artifact = this.trainFromData();
    this.artifactCache = artifact;
    this.modelStore.save(artifact);
    return this.toInfo(artifact);
  }

  private toInfo(artifact: ModelArtifact): ModelInfo {
    const info: ModelInfo = {
      model: MODEL_NAME,
      features: artifact.features,
      weights: artifact.weights,
      metrics: artifact.metrics,
      trainedAt: artifact.trainedAt,
    };
    if (artifact.format !== undefined) info.format = artifact.format;
    if (artifact.formatMinutes !== undefined) info.formatMinutes = artifact.formatMinutes;
    return info;
  }

  /* ------------------------------------------------------------------ */
  /* Ratings predichos por jugador                                      */
  /* ------------------------------------------------------------------ */

  private ratings(): Map<number, PlayerRating> {
    const artifact = this.model();
    const samples = this.samples();
    const averages = averageFeaturesByPlayer(samples);
    const result = new Map<number, PlayerRating>();
    for (const [playerId, features] of averages) {
      const ratings = samples.filter((s) => s.playerId === playerId).map((s) => s.rating);
      result.set(playerId, {
        predicted: predictedRating(features, artifact),
        avgRating: round2(mean(ratings)),
        features,
      });
    }
    return result;
  }

  /** Jugadores disponibles: activos y sin suspensión activa (§8.4). */
  private xiCandidates(): { candidates: XiCandidate[]; suspended: Set<number> } {
    const suspended = new Set(
      this.sanctions.list({ type: 'suspension', status: 'activa' }).map((s) => s.playerId),
    );
    const ratings = this.ratings();
    const candidates: XiCandidate[] = [];
    for (const { user, player } of this.players.list()) {
      if (!user.active) continue;
      if (suspended.has(player.id)) continue;
      const rating = ratings.get(player.id);
      candidates.push({
        playerId: player.id,
        playerName: user.fullName,
        shirtNumber: player.shirtNumber,
        position: player.position,
        predictedRating: rating ? rating.predicted : BASELINE_PLAYER_RATING,
        avgRating: rating ? rating.avgRating : BASELINE_PLAYER_RATING,
      });
    }
    return { candidates, suspended };
  }

  /* ------------------------------------------------------------------ */
  /* 8.4 / §12.5.3 · XI recomendado (slots del formato del partido)     */
  /* ------------------------------------------------------------------ */

  recommendXi(matchId: number, formationKey?: string): XiSuggestion {
    const match = this.matches.findById(matchId);
    if (!match) throw new NotFoundError('Partido no encontrado');
    const profile = getFormat(match.format);
    const requested = (formationKey ?? '').trim();
    const matchFormation = (match.formation ?? '').trim();

    let key = requested || matchFormation || profile.defaultFormation;
    if (!formationBelongsTo(key, match.format)) {
      // §12.2 pide 400 con formación de otro formato; este endpoint es de
      // SUGERENCIA (§7.10) y la tolera usando la formación del partido para
      // devolver SIEMPRE un XI válido con `playersOnPitch` slots (§12.8).
      key = formationBelongsTo(matchFormation, match.format)
        ? matchFormation
        : profile.defaultFormation;
    }
    return this.buildXi(getFormation(key, match.format));
  }

  private buildXi(formation: FormationDef): XiSuggestion {
    const { candidates, suspended } = this.xiCandidates();
    const selection = selectXi(formation, candidates);
    const byId = new Map(candidates.map((c) => [c.playerId, c]));

    const slots: LineupSlot[] = formation.slots.map((slot) => {
      const assignment = selection.assignments.find((a) => a.slotIndex === slot.slotIndex);
      const playerId = assignment ? assignment.playerId : null;
      const candidate = playerId !== null ? byId.get(playerId) : undefined;
      return {
        slotIndex: slot.slotIndex,
        playerId,
        playerName: candidate ? candidate.playerName : null,
        shirtNumber: candidate ? candidate.shirtNumber : null,
        playerPosition: candidate ? candidate.position : null,
        x: slot.x,
        y: slot.y,
        role: slot.role,
        label: slot.label,
      };
    });

    const assignedIds = slots
      .map((slot) => slot.playerId)
      .filter((id): id is number => id !== null);
    const avgPredicted = round2(
      mean(assignedIds.map((id) => (byId.get(id) ? (byId.get(id) as XiCandidate).predictedRating : 0))),
    );
    const explanation = this.buildExplanation(formation, slots, candidates, suspended, avgPredicted);
    return { lineup: slots, explanation };
  }

  private buildExplanation(
    formation: FormationDef,
    slots: LineupSlot[],
    candidates: XiCandidate[],
    suspended: Set<number>,
    avgPredicted: number,
  ): string {
    const notes: string[] = [];
    const assigned = new Set(
      slots.map((slot) => slot.playerId).filter((id): id is number => id !== null),
    );
    const byId = new Map(candidates.map((c) => [c.playerId, c]));

    // Nota 1: continuidad con el último partido jugado.
    const lastPlayed = this.matches
      .list()
      .filter((m) => m.status === 'jugado')
      .sort((a, b) => b.kickOff.localeCompare(a.kickOff))[0];
    if (lastPlayed) {
      const whoPlayed = new Set(
        this.stats
          .list({ matchId: lastPlayed.id })
          .filter((s) => s.minutes > 0)
          .map((s) => s.playerId),
      );
      const kept = [...assigned].filter((id) => whoPlayed.has(id)).length;
      if (kept > 0) {
        notes.push(
          `Se mantienen ${kept} titulares del último partido frente a ${lastPlayed.opponent}.`,
        );
      }
    }

    // Nota 2: cambio destacado por rendimiento.
    const inside = candidates
      .filter((c) => assigned.has(c.playerId))
      .sort((a, b) => b.predictedRating - a.predictedRating);
    const outside = candidates
      .filter((c) => !assigned.has(c.playerId))
      .sort((a, b) => b.predictedRating - a.predictedRating);
    for (const out of outside) {
      const rival = inside.find(
        (c) => c.position === out.position && c.predictedRating > out.predictedRating,
      );
      if (rival) {
        notes.push(
          `${rival.playerName} (${rival.predictedRating.toFixed(2)}) gana el puesto a ${out.playerName} (${out.predictedRating.toFixed(2)}) por mejor rendimiento reciente.`,
        );
        break;
      }
    }

    // Nota 3: bajas por suspensión.
    if (suspended.size > 0) {
      const names: string[] = [];
      for (const playerId of suspended) {
        const row = this.players.findWithUser(playerId);
        if (row) names.push(row.user.fullName);
      }
      if (names.length > 0) {
        notes.push(`${names.join(', ')} no está disponible por suspensión activa.`);
      }
    }

    // Nota de relleno para garantizar 2-3 notas.
    notes.push(
      `El plantel dispone de ${candidates.length} jugadores disponibles para los ${formation.slots.length} puestos.`,
    );

    return `Formación ${formation.key} del ${getFormat(formation.format).name} con promedio de rating predicho de ${avgPredicted.toFixed(2)} en los ${formation.slots.length}. ${notes.slice(0, 3).join(' ')}`;
  }

  /* ------------------------------------------------------------------ */
  /* 8.6 · Insight individual                                           */
  /* ------------------------------------------------------------------ */

  playerInsight(playerId: number): AiPlayerInsight {
    const row = this.players.findWithUser(playerId);
    if (!row) throw new NotFoundError('Jugador no encontrado');

    const allSamples = this.samples();
    const samples = allSamples.filter((s) => s.playerId === playerId);
    const played = new Map(
      this.matches
        .list()
        .filter((m) => m.status === 'jugado')
        .map((m) => [m.id, m] as const),
    );
    const playerStats = this.stats.list({ playerId });

    const historyAll = playerStats
      .filter((s) => played.has(s.matchId))
      .map((s) => ({
        matchId: s.matchId,
        opponent: (played.get(s.matchId) as Match).opponent,
        rating: s.rating,
      }));
    const history = historyAll.slice(-5); // cronológico: del más antiguo al más reciente
    const ratingsAsc = historyAll.map((h) => h.rating);

    const forecast = {
      nextRating: weightedForecast(ratingsAsc),
      confidence: confidenceFor(historyAll.length),
      trend: trendFrom(ratingsAsc),
      history,
    };

    let strengths: AiPlayerInsight['strengths'] = [];
    let weaknesses: AiPlayerInsight['weaknesses'] = [];
    let playerFeatures: number[] | undefined;

    if (samples.length > 0) {
      const averages = averageFeaturesByPlayer(allSamples);
      playerFeatures = averages.get(playerId);
      if (playerFeatures) {
        const vectors = [...averages.values()];
        const { mean: squadMean, std: squadStd } = meanStd(vectors);
        const compared = buildStrengthsWeaknesses(playerFeatures, squadMean, squadStd);
        strengths = compared.strengths;
        weaknesses = compared.weaknesses;
      }
    }

    const redCards = playerStats.reduce((acc, s) => acc + s.redCards, 0);
    const recommendation =
      samples.length === 0 || !playerFeatures
        ? 'Sin partidos registrados: aún no hay datos suficientes para recomendar.'
        : buildRecommendation({
            ratingsChronAsc: ratingsAsc,
            foulsPer90: playerFeatures[8],
            redCards,
            appearances: historyAll.length,
            confidence: forecast.confidence,
          });

    return {
      playerId,
      playerName: row.user.fullName,
      position: row.player.position,
      forecast,
      strengths,
      weaknesses,
      recommendation,
    };
  }

  /* ------------------------------------------------------------------ */
  /* 8.7 · Insights del equipo                                          */
  /* ------------------------------------------------------------------ */

  insights(): AiInsights {
    const model = this.getModelInfo();
    const candidates = this.xiCandidates().candidates;
    const played = this.formTrend();
    const nextMatch =
      this.matches
        .list()
        .filter((m) => UPCOMING.has(m.status))
        .sort((a, b) => a.kickOff.localeCompare(b.kickOff))[0] ?? null;

    // §12: formato del partido concreto; si no hay partido, el del equipo.
    const format: TeamFormat = nextMatch ? nextMatch.format : this.teamProfile().format;
    const profile = getFormat(format);
    const formation = nextMatch
      ? getFormation(nextMatch.formation, nextMatch.format)
      : getFormation(profile.defaultFormation, format);
    const xi = this.buildXi(formation);

    const assignedPredicted = xi.lineup
      .map((slot) => (slot.playerId !== null ? candidates.find((c) => c.playerId === slot.playerId) : undefined))
      .filter((c): c is XiCandidate => Boolean(c))
      .map((c) => c.predictedRating);
    // §12.5.7: promedio de los titulares del XI (o de los mejores del plantel).
    const teamRating =
      assignedPredicted.length > 0 ? round2(mean(assignedPredicted)) : BASELINE_PLAYER_RATING;

    const opponentRating = nextMatch ? this.opponentRating(nextMatch) : BASELINE_OPP_RATING;
    const outcome = nextMatch ? computeOutcome(teamRating, opponentRating, nextMatch.isHome, profile) : null;

    const ratingMap = this.ratings();
    const playerRows = this.players.list();
    const topPlayers = [...ratingMap.entries()]
      .map(([playerId, rating]) => {
        const row = playerRows.find((r) => r.player.id === playerId);
        return {
          playerId,
          playerName: row ? row.user.fullName : `Jugador ${playerId}`,
          shirtNumber: row ? row.player.shirtNumber : null,
          predictedRating: rating.predicted,
          avgRating: rating.avgRating,
        };
      })
      .sort((a, b) => b.predictedRating - a.predictedRating)
      .slice(0, 5);

    return {
      model,
      format,
      teamRating,
      formTrend: played,
      nextMatchPrediction:
        nextMatch && outcome
          ? {
              matchId: nextMatch.id,
              opponent: nextMatch.opponent,
              kickOff: nextMatch.kickOff,
              format: nextMatch.format,
              winProbability: outcome.winProbability,
              drawProbability: outcome.drawProbability,
              loseProbability: outcome.loseProbability,
              projectedGoalsFor: outcome.projectedGoalsFor,
              projectedGoalsAgainst: outcome.projectedGoalsAgainst,
              teamRating,
              opponentRating: round2(opponentRating),
            }
          : null,
      topPlayers,
      insights: this.buildInsightItems({
        seasonStats: this.inscriptions.list(),
        played,
        nextMatch,
        projectedFor: outcome ? outcome.projectedGoalsFor : null,
        projectedAgainst: outcome ? outcome.projectedGoalsAgainst : null,
        formatProfile: profile,
        modelSamples: model.metrics.samples,
        modelMae: model.metrics.mae,
        modelR2: model.metrics.r2,
      }),
      recommendedXI: {
        formation: formation.key,
        slots: xi.lineup,
        explanation: xi.explanation,
      },
    };
  }

  /** Promedio de calificación del equipo y resultado por partido jugado (cronológico). */
  private formTrend(): { matchId: number; opponent: string; rating: number; result: string }[] {
    const played = this.matches
      .list()
      .filter((m) => m.status === 'jugado')
      .sort((a, b) => a.kickOff.localeCompare(b.kickOff));
    const rows = this.stats.listAll();
    return played.map((m) => {
      const stats = rows.filter((s) => s.matchId === m.id);
      const rating = round2(mean(stats.map((s) => s.rating)));
      const result =
        m.goalsFor !== null && m.goalsAgainst !== null
          ? m.goalsFor > m.goalsAgainst
            ? 'V'
            : m.goalsFor === m.goalsAgainst
              ? 'E'
              : 'D'
          : '-';
      return { matchId: m.id, opponent: m.opponent, rating, result };
    });
  }

  /** §8.5: baseline 6.40 o promedio de nuestras estadísticas contra el mismo rival. */
  private opponentRating(next: Match): number {
    const key = next.opponent.trim().toLowerCase();
    const previousIds = new Set(
      this.matches
        .list()
        .filter((m) => m.status === 'jugado')
        .filter((m) => m.opponent.trim().toLowerCase() === key)
        .map((m) => m.id),
    );
    if (previousIds.size === 0) return BASELINE_OPP_RATING;
    const ratings = this.stats
      .listAll()
      .filter((s) => previousIds.has(s.matchId))
      .map((s) => s.rating);
    if (ratings.length === 0) return BASELINE_OPP_RATING;
    return round2(mean(ratings));
  }

  private buildInsightItems(input: {
    seasonStats: ReturnType<InscriptionRepository['list']>;
    played: { matchId: number; opponent: string; rating: number; result: string }[];
    nextMatch: Match | null;
    projectedFor: number | null;
    projectedAgainst: number | null;
    formatProfile: FormatProfile;
    modelSamples: number;
    modelMae: number;
    modelR2: number;
  }): InsightItem[] {
    const items: InsightItem[] = [];

    // 1) Inscripciones pendientes de cobro.
    const seasons = [...new Set(input.seasonStats.map((i) => i.season))].sort();
    const currentYear = String(new Date().getFullYear());
    const season = seasons.includes(currentYear)
      ? currentYear
      : seasons.length > 0
        ? (seasons[seasons.length - 1] as string)
        : currentYear;
    const pending = input.seasonStats
      .filter((i) => i.season === season)
      .map((i) => ({ ...i, status: deriveInscriptionStatus(i.paid, i.amount) }))
      .filter((i) => i.status !== 'pagada');
    if (pending.length > 0) {
      const missing = pending.reduce((acc, i) => acc + Math.max(0, i.amount - i.paid), 0);
      const dueDates = pending
        .map((i) => i.dueDate)
        .filter((d): d is string => Boolean(d))
        .sort();
      const due = dueDates.length > 0 ? dueDates[0] : null;
      items.push({
        level: 'alerta',
        title: `${pending.length} inscripciones sin saldar`,
        message: `Faltan ${formatMoney(missing)} por cobrar de ${season}${due ? ` (vencen el ${due.slice(8, 10)}/${due.slice(5, 7)})` : ''}.`,
      });
    }

    // 2) Forma del equipo y rachas.
    const form = input.played;
    const last3 = form.slice(-3);
    const prev3 = form.slice(-6, -3);
    if (last3.length >= 3 && prev3.length >= 3) {
      const avgLast = mean(last3.map((f) => f.rating));
      const avgPrev = mean(prev3.map((f) => f.rating));
      if (avgLast - avgPrev >= 0.15) {
        items.push({
          level: 'positivo',
          title: 'Forma ascendente',
          message: `El promedio de calificación subió de ${avgPrev.toFixed(1)} a ${avgLast.toFixed(1)} en los últimos 3 partidos.`,
        });
      } else if (avgPrev - avgLast >= 0.15) {
        items.push({
          level: 'alerta',
          title: 'Forma descendente',
          message: `El promedio de calificación bajó de ${avgPrev.toFixed(1)} a ${avgLast.toFixed(1)} en los últimos 3 partidos.`,
        });
      }
    }
    let streakLosses = 0;
    for (let i = form.length - 1; i >= 0 && form[i].result === 'D'; i--) streakLosses++;
    let streakWins = 0;
    for (let i = form.length - 1; i >= 0 && form[i].result === 'V'; i--) streakWins++;
    if (streakLosses >= 2) {
      const projection =
        input.projectedFor !== null
          ? `el modelo proyecta ${input.projectedFor.toFixed(1)} goles a favor${input.nextMatch ? ` vs. ${input.nextMatch.opponent}` : ''}`
          : 'sin proyección de goles disponible';
      items.push({
        level: 'alerta',
        title: 'Racha de derrotas',
        message: `${streakLosses} derrotas seguidas; ${projection}.`,
      });
    } else if (streakWins >= 2) {
      items.push({
        level: 'positivo',
        title: 'Racha de victorias',
        message: `${streakWins} victorias seguidas con buen nivel colectivo.`,
      });
    } else if (form.length === 0) {
      items.push({
        level: 'info',
        title: 'Sin partidos jugados',
        message: 'Todavía no hay resultados para evaluar la forma del equipo.',
      });
    }

    // 3) Sanciones.
    const active = this.sanctions.list({ status: 'activa' });
    const suspensions = active.filter((s) => s.type === 'suspension').length;
    const yellows = active.filter((s) => s.type === 'tarjeta_amarilla').length;
    if (active.length > 0) {
      items.push({
        level: 'info',
        title: 'Sanciones',
        message: `${active.length} sanciones activas: ${suspensions} suspensión(es) y ${yellows} tarjeta(s) amarilla(s) en acumulación.`,
      });
    }

    // 4) Stock bajo.
    const lowStock = this.uniforms.list().filter((u) => u.stock <= u.minStock);
    if (lowStock.length > 0) {
      const first = lowStock[0];
      items.push({
        level: 'alerta',
        title: 'Stock bajo de uniformes',
        message: `${lowStock.length} artículos por debajo del mínimo (ej. ${first.name}: ${first.stock} uds.).`,
      });
    }

    // 5) Formato de juego (§12.4): mención explícita del formato.
    const fp = input.formatProfile;
    items.push({
      level: 'info',
      title: `Formato: ${fp.name}`,
      message: `En ${fp.name.toLowerCase()} se esperan ~${fp.ai.baselineFor.toFixed(1)} goles por partido (partido de ${fp.matchMinutes} minutos, ${fp.playersOnPitch} en cancha).`,
    });

    // 6) Próximo partido.
    if (input.nextMatch && input.projectedFor !== null) {
      items.push({
        level: 'info',
        title: 'Próximo partido',
        message: `Rival: ${input.nextMatch.opponent}; se proyectan ${input.projectedFor.toFixed(1)} goles a favor y ${(input.projectedAgainst ?? 0).toFixed(1)} en contra en el ${fp.name}.`,
      });
    }

    // 7) Solicitudes de uniforme.
    const pendingRequests = this.uniformRequests.list('pendiente').length;
    if (pendingRequests > 0 && items.length < 6) {
      items.push({
        level: 'info',
        title: 'Solicitudes de uniforme',
        message: `${pendingRequests} solicitud(es) pendiente(s) de revisión.`,
      });
    }

    // Respaldo para garantizar al menos 3 ítems.
    while (items.length < 3) {
      items.push({
        level: 'info',
        title: 'Modelo de IA',
        message: `Modelo entrenado con ${input.modelSamples} muestras (MAE ${input.modelMae.toFixed(3)}, R² ${input.modelR2.toFixed(2)}).`,
      });
      if (items.length >= 3) break;
      items.push({
        level: 'info',
        title: 'Plantel',
        message: 'Registro de estadísticas en curso: cuanto más partidos, más preciso el modelo.',
      });
    }

    return items.slice(0, 6);
  }
}
