/**
 * Modelo de desempeño (§8 del SPEC): regresión lineal entrenada con gradiente
 * descenso por lotes, XI recomendado (greedy + mejora local), probabilidad de
 * resultado, forecast individual y fortalezas/debilidades.
 *
 * Todo aquí es puro (sin Express, sin SQLite): lo orquesta `AiService`.
 */
import { FEATURE_COUNT, FEATURE_KEYS } from './features';
import type { FormationDef, FormationRole, FormationSlot } from '../formations';
import { FORMATS, getFormat, type FormatProfile, type TeamFormat } from '../formats';
import type { Position } from '../entities';

/* ------------------------------------------------------------------ */
/* 8.2 · Modelo lineal                                                */
/* ------------------------------------------------------------------ */

/** Pesos por defecto cuando hay < 20 muestras (§8.2). */
export const DEFAULT_WEIGHTS = [6.5, 0.35, 0.3, 0.25, 0.3, 0.3, 0.2, 0.15, -0.25, -0.15, 0.4];

export const MODEL_NAME = 'regresion-lineal-gradiente-descendente';
export const EPOCHS = 600;
export const LEARNING_RATE = 0.05;
export const MIN_SAMPLES = 20;

export interface ModelMetrics {
  samples: number;
  mae: number;
  rmse: number;
  r2: number;
}

/** Contexto de entrenamiento por formato (§12.5.2 y §12.5.6). */
export interface TrainContext {
  /** `profile.ai.minSamples` (si no llega, se usa `MIN_SAMPLES` de §8.2). */
  minSamples?: number;
  /** Formato con el que se entrenó (se persiste en `model.json`). */
  format?: TeamFormat;
  /** Minutos por partido del formato usado en la normalización. */
  formatMinutes?: number;
}

export interface ModelArtifact {
  weights: number[]; // w0 + w1..w10 (11 valores)
  mean: number[];    // media de cada feature (10)
  std: number[];     // desviación estándar de cada feature (10)
  features: string[];
  metrics: ModelMetrics;
  trainedAt: string;
  format?: TeamFormat;      // formato entrenado (§12.5.6)
  formatMinutes?: number;   // minutos del formato usados (§12.5.6)
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function clampRating(value: number): number {
  return Math.min(10, Math.max(1, value));
}

export function round2(value: number): number {
  return round(value, 2);
}

/** Media y desviación estándar por columna; si σ = 0 se usa 1 (para no dividir por cero). */
export function meanStd(X: number[][]): { mean: number[]; std: number[] } {
  const n = X.length;
  const d = FEATURE_COUNT;
  const mean = new Array(d).fill(0);
  const std = new Array(d).fill(1);
  if (n === 0) return { mean, std };
  for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j] / n;
  const variance = new Array(d).fill(0);
  for (const row of X) for (let j = 0; j < d; j++) variance[j] += (row[j] - mean[j]) ** 2 / n;
  for (let j = 0; j < d; j++) std[j] = variance[j] > 0 ? Math.sqrt(variance[j]) : 1;
  return { mean, std };
}

export function standardize(row: number[], mean: number[], std: number[]): number[] {
  return row.map((v, j) => {
    const s = std[j] ?? 1;
    return s !== 0 && Number.isFinite(s) ? (v - (mean[j] ?? 0)) / s : 0;
  });
}

/** Predicción SIN límites: w0 + Σ wi·zi. */
export function predictRaw(features: number[], artifact: Pick<ModelArtifact, 'weights' | 'mean' | 'std'>): number {
  const z = standardize(features, artifact.mean, artifact.std);
  let prediction = artifact.weights[0] ?? 0;
  for (let j = 0; j < z.length; j++) prediction += (artifact.weights[j + 1] ?? 0) * z[j];
  return prediction;
}

/** Rating predicho limitado a [1,10] con 2 decimales (§8.3). */
export function predictedRating(features: number[], artifact: Pick<ModelArtifact, 'weights' | 'mean' | 'std'>): number {
  return round2(clampRating(predictRaw(features, artifact)));
}

export function computeMetrics(yTrue: number[], yPred: number[]): ModelMetrics {
  const n = yTrue.length;
  if (n === 0) return { samples: 0, mae: 0, rmse: 0, r2: 0 };
  let absSum = 0;
  let sqSum = 0;
  for (let i = 0; i < n; i++) {
    const err = yPred[i] - yTrue[i];
    absSum += Math.abs(err);
    sqSum += err * err;
  }
  const meanY = yTrue.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  for (const y of yTrue) ssTot += (y - meanY) ** 2;
  const r2 = ssTot === 0 ? 0 : 1 - sqSum / ssTot;
  return {
    samples: n,
    mae: round(absSum / n, 4),
    rmse: round(Math.sqrt(sqSum / n), 4),
    r2: round(r2, 4),
  };
}

/**
 * Entrena el modelo con gradiente descenso por lotes (§8.2 y §12.5.2):
 * 600 épocas, α = 0.05, pérdida MSE, w = 0 salvo w0 (= promedio del objetivo).
 * Con menos muestras que `context.minSamples` (§12.5: `profile.ai.minSamples`)
 * usa DEFAULT_WEIGHTS pero calcula las métricas igual. El formato entrenado se
 * guarda en el artefacto (`model.json`, §12.5.6).
 */
export function trainModel(X: number[][], y: number[], context: TrainContext = {}): ModelArtifact {
  const minSamples = context.minSamples ?? MIN_SAMPLES;
  const { mean, std } = meanStd(X);
  const roundedMean = mean.map((v) => round(v, 4));
  const roundedStd = std.map((v) => round(v, 4));

  let weights: number[];
  if (X.length === 0) {
    weights = [...DEFAULT_WEIGHTS];
  } else if (X.length < minSamples) {
    weights = [...DEFAULT_WEIGHTS];
  } else {
    const d = FEATURE_COUNT;
    weights = new Array(d + 1).fill(0);
    weights[0] = y.reduce((a, b) => a + b, 0) / y.length; // w0 = promedio objetivo
    const Z = X.map((row) => standardize(row, roundedMean, roundedStd));
    const n = Z.length;
    for (let epoch = 0; epoch < EPOCHS; epoch++) {
      const grad = new Array(d + 1).fill(0);
      for (let i = 0; i < n; i++) {
        let pred = weights[0];
        for (let j = 0; j < d; j++) pred += weights[j + 1] * Z[i][j];
        const err = pred - y[i];
        grad[0] += err;
        for (let j = 0; j < d; j++) grad[j + 1] += err * Z[i][j];
      }
      weights[0] -= LEARNING_RATE * (grad[0] / n);
      for (let j = 0; j < d; j++) weights[j + 1] -= LEARNING_RATE * (grad[j + 1] / n);
    }
  }

  const roundedWeights = weights.map((v) => round(v, 4));
  const predictions = X.map((row) => predictRaw(row, { weights: roundedWeights, mean: roundedMean, std: roundedStd }));

  return {
    weights: roundedWeights,
    mean: roundedMean,
    std: roundedStd,
    features: [...FEATURE_KEYS],
    metrics: computeMetrics(y, predictions),
    trainedAt: new Date().toISOString(),
    ...(context.format !== undefined ? { format: context.format } : {}),
    ...(context.formatMinutes !== undefined ? { formatMinutes: context.formatMinutes } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* 8.4 · XI recomendado (greedy + mejora local)                       */
/* ------------------------------------------------------------------ */

export interface XiCandidate {
  playerId: number;
  playerName: string;
  shirtNumber: number | null;
  position: Position;
  predictedRating: number;
  avgRating: number;
}

export interface XiSelection {
  assignments: { slotIndex: number; playerId: number | null }[];
  totalScore: number;
}

const ROLE_RANK: Record<FormationRole, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };
const LINE_INDEX: Record<Position, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

/** §8.4: encaje entre el rol del slot y la posición del jugador. */
export function fitValue(slotRole: FormationRole, playerPos: Position): number {
  if (slotRole === playerPos) return 1.0;
  const a = LINE_INDEX[slotRole];
  const b = LINE_INDEX[playerPos];
  if (a === b) return 0.85;                       // misma línea
  if (Math.abs(a - b) === 1 && slotRole !== 'POR' && playerPos !== 'POR') return 0.55; // líneas contiguas
  return 0.15;                                    // cualquier otro (incluye POR ↔ no-POR)
}

export function slotScore(slot: FormationSlot, candidate: XiCandidate): number {
  const fit = fitValue(slot.role, candidate.position);
  const ratingTerm = fit === 1 ? candidate.avgRating : candidate.avgRating - 1;
  return fit * candidate.predictedRating + 0.15 * ratingTerm;
}

/** Selección greedy por restricción de slot + mejora local de 100 iteraciones. */
export function selectXi(formation: FormationDef, candidates: XiCandidate[]): XiSelection {
  const ordered = [...formation.slots].sort(
    (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.slotIndex - b.slotIndex,
  );
  const available = [...candidates];
  const assigned: { slot: FormationSlot; playerId: number | null }[] = [];

  // 1) greedy: para cada slot, el score más alto entre los jugadores disponibles
  for (const slot of ordered) {
    let best: XiCandidate | null = null;
    let bestScore = -Infinity;
    for (const candidate of available) {
      const score = slotScore(slot, candidate);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (best) {
      available.splice(available.indexOf(best), 1);
      assigned.push({ slot, playerId: best.playerId });
    } else {
      assigned.push({ slot, playerId: null });
    }
  }

  const byId = new Map(candidates.map((c) => [c.playerId, c]));
  const scoreOf = (slot: FormationSlot, playerId: number | null): number => {
    if (playerId === null) return -Infinity;
    const candidate = byId.get(playerId);
    return candidate ? slotScore(slot, candidate) : -Infinity;
  };

  // 2) mejora local: 100 iteraciones de intercambios por pares
  for (let iteration = 0; iteration < 100; iteration++) {
    let improved = false;
    for (let i = 0; i < assigned.length; i++) {
      for (let j = i + 1; j < assigned.length; j++) {
        const a = assigned[i];
        const b = assigned[j];
        if (a.playerId === null || b.playerId === null) continue;
        const before = scoreOf(a.slot, a.playerId) + scoreOf(b.slot, b.playerId);
        const after = scoreOf(a.slot, b.playerId) + scoreOf(b.slot, a.playerId);
        if (after - before > 0.01) {
          const tmp = a.playerId;
          a.playerId = b.playerId;
          b.playerId = tmp;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  const totalScore = assigned.reduce(
    (sum, entry) => sum + (entry.playerId === null ? 0 : scoreOf(entry.slot, entry.playerId)),
    0,
  );
  return {
    assignments: assigned.map((entry) => ({ slotIndex: entry.slot.slotIndex, playerId: entry.playerId })),
    totalScore,
  };
}

/* ------------------------------------------------------------------ */
/* 8.5 · Probabilidad de resultado                                    */
/* ------------------------------------------------------------------ */

export interface OutcomePrediction {
  winProbability: number;
  drawProbability: number;
  loseProbability: number;
  projectedGoalsFor: number;
  projectedGoalsAgainst: number;
}

function round4(value: number): number {
  return round(value, 4);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * §12.5 · Probabilidad de resultado: softmax de 3 vías recalibrada por formato
 * (siempre suma 1, con empate real) + goles proyectados con los baselines del
 * perfil (`baselineFor` / `baselineAgainst` / `xgClampMax`).
 */
export function computeOutcome(
  teamRating: number,
  oppRating: number,
  isHome: boolean,
  profile: FormatProfile = FORMATS[11],
): OutcomePrediction {
  const { winProbK: k, drawLogWeight: d0, homeBonus, baselineFor, baselineAgainst, xgClampMax } =
    profile.ai;

  const delta = teamRating - oppRating + (isHome ? homeBonus : -homeBonus);
  const eWin = Math.exp(k * delta);
  const eDraw = Math.exp(d0); // constante por formato (log-peso del empate)
  const eLoss = Math.exp(-k * delta);
  const total = eWin + eDraw + eLoss;

  const win = round4(eWin / total);
  const draw = round4(eDraw / total);
  const lose = round4(Math.max(0, 1 - win - draw)); // complemento: suman 1 exacto

  const diff = teamRating - oppRating;
  const xgFor = clamp(baselineFor * Math.exp(0.6 * diff), 0.15, xgClampMax);
  const xgAgainst = clamp(baselineAgainst * Math.exp(-0.5 * diff), 0.15, xgClampMax);

  return {
    winProbability: win,
    drawProbability: draw,
    loseProbability: lose,
    projectedGoalsFor: round(xgFor, 1),
    projectedGoalsAgainst: round(xgAgainst, 1),
  };
}

/* ------------------------------------------------------------------ */
/* 8.6 · Forecast individual                                          */
/* ------------------------------------------------------------------ */

const FORECAST_WEIGHTS = [0.4, 0.25, 0.15, 0.1, 0.1];

/**
 * Media ponderada de los últimos hasta 5 ratings (L1 = más reciente),
 * limitada a [1,10] y con 2 decimales.
 * @param ratingsChronAsc ratings en orden cronológico ascendente
 */
export function weightedForecast(ratingsChronAsc: number[]): number {
  const last5 = ratingsChronAsc.slice(-5).reverse();
  if (last5.length === 0) return 6.5;
  let acc = 0;
  let weight = 0;
  for (let i = 0; i < last5.length; i++) {
    acc += FORECAST_WEIGHTS[i] * last5[i];
    weight += FORECAST_WEIGHTS[i];
  }
  return round2(clampRating(acc / weight));
}

/** Compara el promedio de los últimos 3 partidos vs. los 3 anteriores. */
export function trendFrom(ratingsChronAsc: number[]): 'sube' | 'estable' | 'baja' {
  if (ratingsChronAsc.length < 4) return 'estable';
  const last3 = ratingsChronAsc.slice(-3);
  const prev3 = ratingsChronAsc.slice(-6, -3);
  if (prev3.length === 0) return 'estable';
  const avgLast = last3.reduce((a, b) => a + b, 0) / last3.length;
  const avgPrev = prev3.reduce((a, b) => a + b, 0) / prev3.length;
  const delta = avgLast - avgPrev;
  if (delta >= 0.25) return 'sube';
  if (delta <= -0.25) return 'baja';
  return 'estable';
}

export function confidenceFor(appearances: number): number {
  return Math.max(0.2, round2(Math.min(0.95, 0.35 + 0.05 * appearances)));
}

/* ------------------------------------------------------------------ */
/* 8.6 · Fortalezas / debilidades vs. el plantel                      */
/* ------------------------------------------------------------------ */

export interface InsightItem {
  label: string;
  detail: string;
}

interface FeatureCopy {
  strong: string;
  weak: string;
  format: (value: number) => string;
  negative: boolean; // feature donde más es peor
}

/** Copy en español por feature, en el mismo orden que `FEATURE_KEYS`.
 *  Los rates van "por partido" (§12.1: normalización por el formato, no por 90). */
const FEATURE_COPY: FeatureCopy[] = [
  { strong: 'Goleador', weak: 'Falta de gol', format: (v) => `${v.toFixed(2)} goles por partido`, negative: false },
  { strong: 'Asistidor', weak: 'Pocas asistencias', format: (v) => `${v.toFixed(2)} asistencias por partido`, negative: false },
  { strong: 'Puntería', weak: 'Desperdicia tiros', format: (v) => `${Math.round(v * 100)}% de tiros a puerta`, negative: false },
  { strong: 'Buen pie', weak: 'Pérdida de balón', format: (v) => `${Math.round(v * 100)}% de pases completados`, negative: false },
  { strong: 'Defensa agresiva', weak: 'Baja intervención defensiva', format: (v) => `${v.toFixed(1)} recuperaciones por partido`, negative: false },
  { strong: 'Regate', weak: 'Poco regate', format: (v) => `${v.toFixed(2)} regates por partido`, negative: false },
  { strong: 'Titularidad', weak: 'Pocos minutos', format: (v) => `${Math.round(v * 100)}% de los minutos disputados`, negative: false },
  { strong: 'Juego limpio', weak: 'Indisciplina', format: (v) => `${v.toFixed(2)} de tarjetas por partido`, negative: true },
  { strong: 'Control en la marca', weak: 'Faltas excesivas', format: (v) => `${v.toFixed(1)} faltas por partido`, negative: true },
  { strong: 'Tendencia al alza', weak: 'Tendencia a la baja', format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} vs. su promedio`, negative: false },
];

/** Compara cada feature del jugador contra el promedio del plantel (z-score ≥ 0.5 en |z|). */
export function buildStrengthsWeaknesses(
  playerAvg: number[],
  squadMean: number[],
  squadStd: number[],
): { strengths: InsightItem[]; weaknesses: InsightItem[] } {
  const strengths: { item: InsightItem; absZ: number }[] = [];
  const weaknesses: { item: InsightItem; absZ: number }[] = [];

  for (let i = 0; i < FEATURE_COUNT; i++) {
    const value = playerAvg[i] ?? 0;
    const mean = squadMean[i] ?? 0;
    const std = squadStd[i] ?? 0;
    const z = std > 0 ? (value - mean) / std : 0;
    if (Math.abs(z) < 0.5) continue;
    const copy = FEATURE_COPY[i];
    const isGood = copy.negative ? z < 0 : z > 0;
    const item: InsightItem = {
      label: isGood ? copy.strong : copy.weak,
      detail: `${copy.format(value)} (promedio del plantel: ${copy.format(mean)})`,
    };
    if (isGood) strengths.push({ item, absZ: Math.abs(z) });
    else weaknesses.push({ item, absZ: Math.abs(z) });
  }

  strengths.sort((a, b) => b.absZ - a.absZ);
  weaknesses.sort((a, b) => b.absZ - a.absZ);
  return {
    strengths: strengths.slice(0, 4).map((e) => e.item),
    weaknesses: weaknesses.slice(0, 4).map((e) => e.item),
  };
}

/** Reglas simples de recomendación en español (§8.6). */
export function buildRecommendation(input: {
  ratingsChronAsc: number[];
  foulsPer90: number;
  redCards: number;
  appearances: number;
  confidence: number;
}): string {
  const notes: string[] = [];

  // Racha de calificaciones ≥ 7.0
  let streak = 0;
  for (let i = input.ratingsChronAsc.length - 1; i >= 0; i--) {
    if (input.ratingsChronAsc[i] >= 7) streak++;
    else break;
  }
  if (streak >= 3) {
    notes.push(
      `Viene en racha de ${streak} partidos con calificación ≥ 7.0: se recomienda titularidad.`,
    );
  }

  if (trendFrom(input.ratingsChronAsc) === 'baja') {
    notes.push('Calificación a la baja en los últimos partidos: conviene revisar su rendimiento.');
  }

  if (input.foulsPer90 >= 3) {
    notes.push(
      `${input.foulsPer90.toFixed(1)} faltas por partido: bajar la intensidad en el primer tiempo.`,
    );
  }

  if (input.redCards > 0) {
    notes.push(
      `${input.redCards} tarjeta${input.redCards > 1 ? 's' : ''} roja${input.redCards > 1 ? 's' : ''} en la temporada: reforzar la disciplina.`,
    );
  }

  if (input.appearances > 0 && input.confidence < 0.5) {
    notes.push(
      `Poca muestra (${input.appearances} partidos): el pronóstico tiene confianza ${input.confidence}.`,
    );
  }

  if (notes.length === 0) {
    return 'Rendimiento estable dentro del promedio del plantel; sin alertas que corregir.';
  }
  return notes.slice(0, 3).join(' ');
}
