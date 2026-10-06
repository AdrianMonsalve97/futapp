/**
 * Extracción de features desde `match_stats` (§8.1 y §12.1 del SPEC).
 * Las features normalizadas por tiempo usan `rate(v, minutes, formatMinutes)`:
 * "por partido completo del formato" (40/50/60/90 min) en lugar de 90 fijo.
 * Solo continuidad y tendencia quedan fuera de esa normalización.
 */
import type { MatchStat } from '../entities';

/**
 * Normalización crítica de §12.1:
 * `rate(value, minutes, formatMinutes) = value * formatMinutes / max(minutes, 1)`.
 * Si no llega `formatMinutes` se mantiene el 90 histórico (§8.1).
 */
export function rate(value: number, minutes: number, formatMinutes = 90): number {
  return (value * formatMinutes) / Math.max(minutes, 1);
}

/** Nombres literales de las 10 features del modelo. */
export const FEATURE_KEYS = [
  'goals_90',
  'assists_90',
  'shot_accuracy',
  'pass_accuracy',
  'defensive_actions_90',
  'dribbles_90',
  'continuity',
  'discipline_90',
  'fouls_90',
  'rating_trend',
] as const;

export const FEATURE_COUNT = FEATURE_KEYS.length;

/** Resultado de calcular las features de una fila `match_stats`. */
export interface FeatureSample {
  playerId: number;
  matchId: number;
  features: number[];
  rating: number;
}

/**
 * Calcula el vector f1..f10 para una fila de estadísticas.
 * @param previousAvgRating promedio de calificaciones ANTERIORES del mismo jugador (0 si es su primer partido)
 * @param isFirstMatch true si es el primer partido del jugador en la muestra (f10 = 0)
 * @param squadMaxMinutes máximo de minutos que jugó cualquier jugador del plantel en ese partido
 * @param formatMinutes duración completa del formato del partido (40/50/60/90, §12.1)
 */
export function computeFeatureVector(
  stat: MatchStat,
  squadMaxMinutes: number,
  previousAvgRating: number,
  isFirstMatch: boolean,
  formatMinutes = 90,
): number[] {
  const minutes = Math.max(stat.minutes, 1);
  const maxSquad = Math.max(squadMaxMinutes, 1);
  return [
    // f1 goles por partido completo del formato
    rate(stat.goals, minutes, formatMinutes),
    // f2 asistencias por partido completo del formato
    rate(stat.assists, minutes, formatMinutes),
    // f3 precisión de tiro
    stat.shotsOnTarget / Math.max(stat.shots, 1),
    // f4 precisión de pase
    stat.passesCompleted / Math.max(stat.passes, 1),
    // f5 acciones defensivas por partido completo del formato
    rate(stat.tackles + stat.interceptions + stat.recoveries, minutes, formatMinutes),
    // f6 regates por partido completo del formato
    rate(stat.dribbles, minutes, formatMinutes),
    // f7 continuidad (cap a 1)
    Math.min(1, stat.minutes / maxSquad),
    // f8 disciplina (negativa)
    rate(stat.yellowCards * 0.5 + stat.redCards * 1.5, minutes, formatMinutes),
    // f9 faltas (negativa)
    rate(stat.fouls, minutes, formatMinutes),
    // f10 tendencia
    isFirstMatch ? 0 : stat.rating - previousAvgRating,
  ];
}

/**
 * Extrae las muestras de entrenamiento a partir de las estadísticas.
 * @param stats debe venir ORDENADA crónologicamente (partido más antiguo primero);
 *   dentro de cada partido el orden de jugadores no importa.
 * @param formatMinutesByMatch mapa `matchId → minutos del formato` del partido (§12.1);
 *   los partidos ausentes del mapa se normalizan con 90 (compatibilidad).
 */
export function extractFeatureSamples(
  stats: MatchStat[],
  formatMinutesByMatch?: ReadonlyMap<number, number>,
): FeatureSample[] {
  const matchOrder: number[] = [];
  const byMatch = new Map<number, MatchStat[]>();
  for (const s of stats) {
    let bucket = byMatch.get(s.matchId);
    if (!bucket) {
      bucket = [];
      byMatch.set(s.matchId, bucket);
      matchOrder.push(s.matchId);
    }
    bucket.push(s);
  }

  const ratingHistory = new Map<number, number[]>();
  const samples: FeatureSample[] = [];

  for (const matchId of matchOrder) {
    const rows = byMatch.get(matchId) ?? [];
    const squadMaxMinutes = rows.reduce((max, r) => Math.max(max, r.minutes), 0);
    const formatMinutes = formatMinutesByMatch?.get(matchId) ?? 90;
    for (const row of rows) {
      const history = ratingHistory.get(row.playerId) ?? [];
      const previousAvg =
        history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0;
      samples.push({
        playerId: row.playerId,
        matchId: row.matchId,
        features: computeFeatureVector(
          row,
          squadMaxMinutes,
          previousAvg,
          history.length === 0,
          formatMinutes,
        ),
        rating: row.rating,
      });
      history.push(row.rating);
      ratingHistory.set(row.playerId, history);
    }
  }
  return samples;
}

/** Promedia las features de cada jugador a lo largo de sus partidos (§8.3). */
export function averageFeaturesByPlayer(samples: FeatureSample[]): Map<number, number[]> {
  const acc = new Map<number, { sum: number[]; count: number }>();
  for (const s of samples) {
    let entry = acc.get(s.playerId);
    if (!entry) {
      entry = { sum: new Array(FEATURE_COUNT).fill(0), count: 0 };
      acc.set(s.playerId, entry);
    }
    entry.count += 1;
    for (let i = 0; i < FEATURE_COUNT; i++) entry.sum[i] += s.features[i];
  }
  const result = new Map<number, number[]>();
  for (const [playerId, entry] of acc) {
    result.set(playerId, entry.sum.map((v) => v / entry.count));
  }
  return result;
}
