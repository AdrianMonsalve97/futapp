import type { AiPort, XiSuggestion } from '../ports/in/ai.port';
import type { TacticalPlan, TacticalStyle } from '../../domain/tactics';
import { buildPlays } from '../../domain/coaching';
import { roleCoaching } from '../../domain/role-coaching';
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
import { NotFoundError, ValidationError } from '../../domain/errors';
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
  extractForecastSamples,
  latestFeaturesByPlayer,
  type FeatureSample,
} from '../../domain/model/features';
import {
  buildRecommendation,
  buildStrengthsWeaknesses,
  confidenceFor,
  computeMetrics,
  predictRaw,
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

import type { TournamentRepository } from '../ports/out/tournament.repository';
import type { LeagueContext } from '../../domain/tournament';
import type { RefereeService } from './referee-service';
import { asyncFilter } from "./shared";

const BASELINE_OPP_RATING = 6.4;
const BASELINE_PLAYER_RATING = 6.5;


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
    private readonly tournaments: TournamentRepository,
    private readonly refereePayments: RefereeService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Formatos (§12)                                                      */
  /* ------------------------------------------------------------------ */

  /** Perfil del formato global del equipo (`team_settings.format`). */
  private async teamProfile(): Promise<FormatProfile> {
    return getFormat((await this.settings.get()).format);
  }

  /** Mapa partido → minutos de su formato: base de la normalización (§12.1). */
  private async formatMinutesByMatch(): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    for (const match of (await this.matches.list())) {
      map.set(match.id, match.minutes);
    }
    return map;
  }

  private async samples(): Promise<ReturnType<typeof extractFeatureSamples>> {
    return extractFeatureSamples((await this.historicalStats()), (await this.formatMinutesByMatch()));
  }

  /* ------------------------------------------------------------------ */
  /* Modelo                                                             */
  /* ------------------------------------------------------------------ */

  private async trainFromData(): Promise<ModelArtifact> {
    const profile = (await this.teamProfile());
    const samples = extractForecastSamples((await this.historicalStats()), (await this.formatMinutesByMatch()));
    const matchIds = [...new Set(samples.map(sample => sample.matchId))];
    const validationIds = new Set(matchIds.length >= 3 ? matchIds.slice(-Math.max(1, Math.ceil(matchIds.length * 0.2))) : []);
    const training = samples.filter(sample => !validationIds.has(sample.matchId));
    const validation = samples.filter(sample => validationIds.has(sample.matchId));
    const artifact = trainModel(
      training.map((s) => s.features),
      training.map((s) => s.rating),
      {
        minSamples: profile.ai.minSamples,
        format: profile.format,
        formatMinutes: profile.matchMinutes,
      },
    );
    return {
      ...artifact,
      version: 2,
      dataSignature: (await this.dataSignature()),
      ...(validation.length ? { validation: { ...computeMetrics(validation.map(s => s.rating), validation.map(s => predictRaw(s.features, artifact))), method: 'Partidos posteriores reservados (orden cronológico)' } } : {}),
    };
  }

  private async historicalStats() {
    const played = new Set((await this.matches.list()).filter(match => match.status === 'jugado').map(match => match.id));
    return (await this.stats.listAll()).filter(stat => played.has(stat.matchId) && stat.minutes > 0);
  }

  private async dataSignature(): Promise<string> {
    return JSON.stringify([(await this.teamProfile()).format, (await this.teamProfile()).matchMinutes, [...(await this.formatMinutesByMatch()).entries()], (await this.historicalStats())]);
  }

  private async model(): Promise<ModelArtifact> {
    const signature = (await this.dataSignature());
    if (this.artifactCache?.version === 2 && this.artifactCache.dataSignature === signature) return this.artifactCache;
    const profile = (await this.teamProfile());
    const stored = (await this.modelStore.load());
    if (stored?.version === 2 && stored.format === profile.format && stored.dataSignature === signature) {
      this.artifactCache = stored;
      return stored;
    }
    // No existe o fue entrenado con otro formato: (re)entrena con los datos
    // existentes; las features ya están normalizadas por el formato de cada
    // partido, por lo que son comparables entre formatos (§12.5.6).
    const artifact = (await this.trainFromData());
    this.artifactCache = artifact;
    (await this.modelStore.save(artifact));
    return artifact;
  }

  async getModelInfo(): Promise<ModelInfo> {
    return (await this.toInfo((await this.model())));
  }

  async train(): Promise<ModelInfo> {
    const artifact = (await this.trainFromData());
    this.artifactCache = artifact;
    (await this.modelStore.save(artifact));
    return (await this.toInfo(artifact));
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
    info.validation = artifact.validation;
    info.featuresDescription = 'Promedio de los últimos cinco partidos anteriores; predicción del siguiente rendimiento.';
    return info;
  }

  /* ------------------------------------------------------------------ */
  /* Ratings predichos por jugador                                      */
  /* ------------------------------------------------------------------ */

  private async ratings(): Promise<Map<number, PlayerRating>> {
    const artifact = (await this.model());
    const samples = (await this.samples());
    const averages = latestFeaturesByPlayer(samples);
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
  private async xiCandidates(matchId?: number,forBench=false): Promise<{ candidates: XiCandidate[]; suspended: Set<number> }> {
    const suspended = new Set(
      (await this.sanctions.list({ type: 'suspension', status: 'activa' })).map((s) => s.playerId),
    );
    const ratings = (await this.ratings());
    const unavailable = new Set(matchId ? (await this.matches.listAttendance(matchId)).filter(row => row.status === 'no_disponible').map(row => row.playerId) : []);
    const candidates: XiCandidate[] = [];
    const tournamentId = matchId ? (await this.matches.findById(matchId))?.tournamentId : null;
    const enrolled = tournamentId ? new Set((await this.tournaments.playerIds(tournamentId))) : null;
    const paymentRows=matchId?(await this.refereePayments.status(matchId)).rows:null;
    const paid=paymentRows?new Set(paymentRows.filter(row=>forBench?row.benchEligible:row.starterEligible).map(row=>row.playerId)):null;
    for (const { user, player } of (await this.players.list())) {
      if (!user.active) continue;
      if (enrolled && !enrolled.has(player.id)) continue;
      if (suspended.has(player.id)) continue;
      if (unavailable.has(player.id)) continue;
      if (paid&&!paid.has(player.id)) continue;
      const rating = ratings.get(player.id);
      candidates.push({
        playerId: player.id,
        playerName: user.fullName,
        shirtNumber: player.shirtNumber,
        position: player.position, secondaryPosition: player.secondaryPosition,
        predictedRating: rating ? rating.predicted : BASELINE_PLAYER_RATING,
        avgRating: rating ? rating.avgRating : BASELINE_PLAYER_RATING,
      });
    }
    return { candidates, suspended };
  }

  /* ------------------------------------------------------------------ */
  /* 8.4 / §12.5.3 · XI recomendado (slots del formato del partido)     */
  /* ------------------------------------------------------------------ */

  async recommendXi(matchId: number, formationKey?: string, styleOverride?: TacticalStyle): Promise<XiSuggestion> {
    const match = (await this.matches.findById(matchId));
    if (!match) throw new NotFoundError('Partido no encontrado');
    const profile = getFormat(match.format);
    const requested = (formationKey ?? '').trim();
    const matchFormation = (match.formation ?? '').trim();

    const allowed = match.tournamentRules?.allowedFormations ?? formationsFor(match.format).map(row => row.key);
    if (requested && !allowed.includes(requested)) throw new ValidationError('La formación no está habilitada para este torneo y formato');
    const { candidates } = (await this.xiCandidates(matchId));
    const ranked = allowed.map(key => {
      const definition = getFormation(key, match.format);
      const selection = selectXi(definition, candidates);
      const style = styleOverride ?? match.tournamentRules?.tacticalStyle;
      const bias = style === 'ofensivo' ? definition.slots.filter(s => s.role === 'DEL').length : style === 'defensivo' ? definition.slots.filter(s => s.role === 'DEF').length : 0;
      return { key, score: selection.totalScore + bias * 0.25 - selection.assignments.filter(a => a.playerId === null).length * 20 };
    }).sort((a, b) => b.score - a.score || (a.key === matchFormation ? -1 : 1));
    const key = requested || ranked[0]?.key || profile.defaultFormation;
    const xi = (await this.buildXi(getFormation(key, match.format), matchId));
    const assigned = new Set(xi.lineup.map(row => row.playerId).filter(id => id !== null));
    const benchCandidates=(await this.xiCandidates(matchId,true)).candidates;
    const capacity = Math.max(0, (match.tournamentRules ? match.tournamentRules.maxSquad ?? benchCandidates.length : match.format + 7) - assigned.size);
    const bench = benchCandidates.filter(row => !assigned.has(row.playerId)).sort((a,b) => b.predictedRating - a.predictedRating).slice(0, capacity);
    const leagueContext = (await this.leagueContext(match, xi.lineup));
    if (match.tournamentId) xi.explanation += ` Plantilla del torneo: ${(await this.tournaments.playerIds(match.tournamentId)).length} inscritos; ${candidates.length} disponibles.${candidates.length ? '' : ' Agrega jugadores activos al torneo y revisa su disponibilidad antes de preparar la alineación.'}`;
    return { ...xi, formation: key, bench, leagueContext, explanation: xi.explanation + (leagueContext ? ` Normativa: ${leagueContext.periods} tiempos de ${leagueContext.minutesPerPeriod} min (${match.minutes} min de juego). Convocatoria: ${leagueContext.maxSquad === null ? 'límite por confirmar' : 'hasta ' + leagueContext.maxSquad}. Cambios: ${leagueContext.maxSubstitutions ?? 'sin límite numérico'}; ${leagueContext.rollingSubstitutions === null ? 'reingreso por confirmar' : leagueContext.rollingSubstitutions ? 'reingreso permitido' : 'sin reingreso'}.` : '') };
  }

  private async leagueContext(match: Match, slots: LineupSlot[]): Promise<LeagueContext | undefined> {
    const rules = match.tournamentRules;
    if (!rules || !match.tournamentId) return undefined;
    const tournament = (await this.tournaments.find(match.tournamentId));
    return { tournamentId: match.tournamentId, name: rules.tournamentName, leagueName: rules.leagueName,
      minutes: match.minutes, periods: rules.periods, minutesPerPeriod: rules.minutesPerPeriod,
      maxSquad: rules.maxSquad, maxSubstitutions: rules.maxSubstitutions, rollingSubstitutions: rules.rollingSubstitutions,
      notes: tournament?.notes ?? '', documents: (tournament?.documents ?? []).map(doc => ({ title: doc.title, excerpt: doc.extractedText.slice(0, 1500), extractionStatus: doc.extractionStatus })),
      positionPlan: slots.map(slot => `${slot.label}: ${slot.playerName ?? 'vacante'}${slot.playerPosition && slot.role !== slot.playerPosition ? ' (adaptación de posición)' : ''}`) };
  }

  async tacticalPlan(matchId: number, styleOverride?: TacticalStyle, formationKey?: string): Promise<TacticalPlan> {
    const match = (await this.matches.findById(matchId));
    if (!match) throw new NotFoundError('Partido no encontrado');
    const style = styleOverride ?? match.tournamentRules?.tacticalStyle ?? 'equilibrado';
    const recommendation = (await this.recommendXi(matchId,formationKey,style));
    const candidates = (await this.xiCandidates(matchId)).candidates;
    const keys = match.tournamentRules?.allowedFormations ?? formationsFor(match.format).map(f=>f.key);
    const formations = (await Promise.all(keys.map(async key => {
                                                                                                                                              const definition = getFormation(key,match.format);
                                                                                                                                              const selection = selectXi(definition,candidates);
                                                                                                                                              const xi = (await this.buildXi(definition,matchId));
                                                                                                                                              const assigned = xi.lineup.filter(s=>s.playerId!==null);
                                                                                                                                              const bias = style==='ofensivo'?definition.slots.filter(s=>s.role==='DEL').length:style==='defensivo'?definition.slots.filter(s=>s.role==='DEF').length:0;
                                                                                                                                              return {key,score:round2(selection.totalScore+bias*0.25-(match.format-assigned.length)*20),
                                                                                                                                                filled:assigned.length,naturalFit:assigned.filter(s=>s.playerPosition===s.role).length,
                                                                                                                                                avgRating:round2(mean(assigned.map(s=>candidates.find(c=>c.playerId===s.playerId)!.predictedRating))),slots:xi.lineup};
                                                                                                                                            }))).sort((a,b)=>b.score-a.score || (a.key===match.formation?-1:1));
    const lineup = recommendation.lineup;
    const positions = (['POR','DEF','MED','DEL'] as const).map(role => {
      const available = candidates.filter(c=>c.position===role || c.secondaryPosition===role);
      return {role,available:available.length,primary:available.filter(c=>c.position===role).length,
        needed:lineup.filter(s=>s.role===role).length,avgRating:round2(mean(available.map(c=>c.predictedRating)))};
    });
    const rules = match.tournamentRules;
    const rotation = rules?.maxSubstitutions===null
      ? `Cambios ilimitados durante ${match.minutes} min. Planifica relevos por función y carga observada; ${rules.rollingSubstitutions===null?'reingreso pendiente de confirmar':rules.rollingSubstitutions?'se permite reingresar':'no se permite reingresar'}.`
      : `Partido de ${match.minutes} min. ${rules ? 'Máximo '+rules.maxSubstitutions+' cambios.' : 'Confirma los cambios permitidos con la liga.'}`;
    return {match:{id:match.id,opponent:match.opponent,format:match.format,minutes:match.minutes},style,
      recommendation:{...recommendation,formation:recommendation.formation!,bench:recommendation.bench??[]},
      formations,positions,plays:buildPlays(lineup,style),rotation,
      methodology:'Alineación basada en rendimiento, disponibilidad y encaje de posiciones. Las jugadas son propuestas adaptadas por reglas deportivas y referencias de entrenamiento, para revisar con el entrenador.'};
  }

  private async buildXi(formation: FormationDef, matchId?: number): Promise<XiSuggestion> {
    const { candidates, suspended } = (await this.xiCandidates(matchId));
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
    const explanation = (await this.buildExplanation(formation, slots, candidates, suspended, avgPredicted));
    return { lineup: slots, explanation };
  }

  private async buildExplanation(
    formation: FormationDef,
    slots: LineupSlot[],
    candidates: XiCandidate[],
    suspended: Set<number>,
    avgPredicted: number,
  ): Promise<string> {
    const notes: string[] = [];
    const assigned = new Set(
      slots.map((slot) => slot.playerId).filter((id): id is number => id !== null),
    );
    const byId = new Map(candidates.map((c) => [c.playerId, c]));

    // Nota 1: continuidad con el último partido jugado.
    const lastPlayed = (await this.matches
          .list())
      .filter((m) => m.status === 'jugado')
      .sort((a, b) => b.kickOff.localeCompare(a.kickOff))[0];
    if (lastPlayed) {
      const whoPlayed = new Set(
        (await this.stats
                    .list({ matchId: lastPlayed.id }))
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
        const row = (await this.players.findWithUser(playerId));
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

  async playerInsight(playerId: number,matchId?:number): Promise<AiPlayerInsight> {
    const row = (await this.players.findWithUser(playerId));
    if (!row) throw new NotFoundError('Jugador no encontrado');

    const allSamples = (await this.samples());
    const samples = allSamples.filter((s) => s.playerId === playerId);
    const played = new Map(
      (await this.matches
                .list())
        .filter((m) => m.status === 'jugado')
        .map((m) => [m.id, m] as const),
    );
    const playerStats = (await this.historicalStats()).filter(stat => stat.playerId === playerId);

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
        const keeperIds = new Set((await this.players.list()).filter(p => p.player.position === 'POR').map(p => p.player.id));
        const goalkeeper = row.player.position === 'POR';
        const vectors = [...averages.entries()].filter(([id]) => !goalkeeper || keeperIds.has(id)).map(([, vector]) => vector);
        const { mean: squadMean, std: squadStd } = meanStd(vectors);
        const compared = buildStrengthsWeaknesses(playerFeatures, squadMean, squadStd, {goalkeeper, comparison: goalkeeper ? 'promedio de porteros con historial' : 'promedio del plantel'});
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

    const visible=async (m:Match)=>!m.tournamentId||((await this.tournaments.find(m.tournamentId))?.status==='publicado' && (m.status==='jugado'||(await this.tournaments.hasPlayer(m.tournamentId,playerId))));
    const next=matchId?(await this.matches.findById(matchId)):(await asyncFilter((await this.matches.list()),async m=>m.status==='programado'&&Date.parse(m.kickOff+'-05:00')>Date.now()&&(await visible(m)))).sort((a,b)=>a.kickOff.localeCompare(b.kickOff))[0];
    if(matchId&&(!next||!(await visible(next))))throw new NotFoundError('Partido no disponible para este análisis');
    const published=next?(await this.refereePayments.publishedLineup(next.id)):[],own=published.find(s=>s.playerId===playerId);
    const configured=(await this.settings.get()).defaultTournamentId,configuredTournament=configured?(await this.tournaments.find(configured)):null;
    const rules=next?.tournamentRules??(configuredTournament?.status==='publicado'&&(await this.tournaments.hasPlayer(configuredTournament.id,playerId))?configuredTournament.rules:null);
    const format=next?.format??rules?.format??(await this.settings.get()).format,formation=next?.publishedFormation??getFormat(format).defaultFormation;
    const slots=getFormation(formation,format).slots.map(s=>({...s,playerId:null,...published.find(p=>p.slotIndex===s.slotIndex)}));
    const minutes=next?.minutes??(rules?rules.periods*rules.minutesPerPeriod:getFormat(format).matchMinutes),role=own?.role??row.player.position,style=rules?.tacticalStyle??'equilibrado';
    const coaching=roleCoaching(role,style,minutes,rules?.periods??0,!!rules&&rules.maxSubstitutions===null);
    const preparation={matchId:next?.id??null,opponent:next?.opponent??null,format,minutes,formation,publishedAt:next?.lineupPublishedAt??null,lineup:published,role,
      assignment:!next?'sin_partido' as const:!next.lineupPublishedAt?'sin_publicar' as const:own?'titular' as const:'fuera_inicial' as const,style,...coaching,plays:buildPlays(slots,style),
      metricNote:role==='POR'?'La calificación usa el historial general. No se registran atajadas, goles evitados ni salidas, por lo que no mide por completo el rendimiento del portero.':'Las recomendaciones tácticas se adaptan al rol; el pronóstico depende de las estadísticas registradas.'};
    return {
      preparation,
      leagueContext: next ? (await this.leagueContext(next, published.filter(slot => slot.playerId === playerId))) : undefined,
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

  async insights(): Promise<AiInsights> {
    const model = (await this.getModelInfo());
    const played = (await this.formTrend());
    const nextMatch =
      (await this.matches
                .list())
        .filter((m) => m.status === 'programado' && new Date(m.kickOff + '-05:00').getTime() >= Date.now())
        .sort((a, b) => a.kickOff.localeCompare(b.kickOff))[0] ?? null;

    // §12: formato del partido concreto; si no hay partido, el del equipo.
    const candidates = (await this.xiCandidates(nextMatch?.id)).candidates;
    const format: TeamFormat = nextMatch ? nextMatch.format : (await this.teamProfile()).format;
    const profile = getFormat(format);
    const formation = nextMatch
      ? getFormation(nextMatch.formation, nextMatch.format)
      : getFormation(profile.defaultFormation, format);
    const xi = nextMatch ? (await this.recommendXi(nextMatch.id)) : (await this.buildXi(formation));

    const assignedPredicted = xi.lineup
      .map((slot) => (slot.playerId !== null ? candidates.find((c) => c.playerId === slot.playerId) : undefined))
      .filter((c): c is XiCandidate => Boolean(c))
      .map((c) => c.predictedRating);
    // §12.5.7: promedio de los titulares del XI (o de los mejores del plantel).
    const teamRating =
      assignedPredicted.length > 0 ? round2(mean(assignedPredicted)) : BASELINE_PLAYER_RATING;

    const opponentRating = nextMatch ? (await this.opponentRating(nextMatch)) : BASELINE_OPP_RATING;
    const outcome = nextMatch ? computeOutcome(teamRating, opponentRating, nextMatch.isHome, profile) : null;

    const ratingMap = (await this.ratings());
    const playerRows = (await this.players.list());
    const topPlayers = [...ratingMap.entries()]
      .filter(([playerId]) => !nextMatch || candidates.some(candidate => candidate.playerId === playerId))
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
      leagueContext: nextMatch ? (await this.leagueContext(nextMatch, xi.lineup)) : undefined,
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
              projectedGoalsFor: round2(outcome.projectedGoalsFor * nextMatch.minutes / profile.matchMinutes),
              projectedGoalsAgainst: round2(outcome.projectedGoalsAgainst * nextMatch.minutes / profile.matchMinutes),
              teamRating,
              opponentRating: round2(opponentRating),
            }
          : null,
      topPlayers,
      insights: (await this.buildInsightItems({
              seasonStats: (await this.inscriptions.list()),
              played,
              nextMatch,
              projectedFor: outcome ? round2(outcome.projectedGoalsFor * (nextMatch ? nextMatch.minutes / profile.matchMinutes : 1)) : null,
              projectedAgainst: outcome ? round2(outcome.projectedGoalsAgainst * (nextMatch ? nextMatch.minutes / profile.matchMinutes : 1)) : null,
              formatProfile: profile,
              modelSamples: model.metrics.samples,
              modelMae: model.metrics.mae,
              modelR2: model.metrics.r2,
            })),
      recommendedXI: {
        formation: xi.formation ?? formation.key,
        slots: xi.lineup,
        explanation: xi.explanation,
      },
    };
  }

  /** Promedio de calificación del equipo y resultado por partido jugado (cronológico). */
  private async formTrend(): Promise<{ matchId: number; opponent: string; rating: number; result: string }[]> {
    const played = (await this.matches
          .list())
      .filter((m) => m.status === 'jugado')
      .sort((a, b) => a.kickOff.localeCompare(b.kickOff));
    const rows = (await this.historicalStats());
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
  private async opponentRating(next: Match): Promise<number> {
    const key = next.opponent.trim().toLowerCase();
    const previousIds = new Set(
      (await this.matches
                .list())
        .filter((m) => m.status === 'jugado')
        .filter((m) => m.opponent.trim().toLowerCase() === key)
        .map((m) => m.id),
    );
    if (previousIds.size === 0) return BASELINE_OPP_RATING;
    const ratings = (await this.stats
          .listAll())
      .filter((s) => previousIds.has(s.matchId))
      .map((s) => s.rating);
    if (ratings.length === 0) return BASELINE_OPP_RATING;
    return round2(mean(ratings));
  }

  private async buildInsightItems(input: {
    seasonStats: Awaited<ReturnType<InscriptionRepository['list']>>;
    played: { matchId: number; opponent: string; rating: number; result: string }[];
    nextMatch: Match | null;
    projectedFor: number | null;
    projectedAgainst: number | null;
    formatProfile: FormatProfile;
    modelSamples: number;
    modelMae: number;
    modelR2: number;
  }): Promise<InsightItem[]> {
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
    const active = (await this.sanctions.list({ status: 'activa' }));
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
    const lowStock = (await this.uniforms.list()).filter((u) => u.stock <= u.minStock);
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
      message: `Referencia de ${fp.name.toLowerCase()}: ~${(fp.ai.baselineFor * (input.nextMatch ? input.nextMatch.minutes / fp.matchMinutes : 1)).toFixed(1)} goles para ${input.nextMatch?.minutes ?? fp.matchMinutes} minutos, con ${fp.playersOnPitch} en cancha.`,
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
    const pendingRequests = (await this.uniformRequests.list('pendiente')).length;
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
