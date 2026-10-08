import type { InscriptionStatus, MatchStat, StatsSummary } from '../../domain/entities';

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** §4: estado derivado del cobro (nunca se guarda a mano si se puede derivar). */
export function deriveInscriptionStatus(paid: number, amount: number): InscriptionStatus {
  if (paid >= amount) return 'pagada';
  if (paid > 0) return 'parcial';
  return 'pendiente';
}

export function emptyStatsSummary(): StatsSummary {
  return {
    appearances: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    passes: 0,
    passesCompleted: 0,
    tackles: 0,
    interceptions: 0,
    recoveries: 0,
    dribbles: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    avgRating: 0,
  };
}

/** Agrega las estadísticas de varios partidos en un resumen por jugador. */
export function summarizeStats(stats: MatchStat[]): StatsSummary {
  if (stats.length === 0) return emptyStatsSummary();
  const sum = (pick: (s: MatchStat) => number) => stats.reduce((acc, s) => acc + pick(s), 0);
  return {
    appearances: new Set(stats.map((s) => s.matchId)).size,
    minutes: sum((s) => s.minutes),
    goals: sum((s) => s.goals),
    assists: sum((s) => s.assists),
    shots: sum((s) => s.shots),
    shotsOnTarget: sum((s) => s.shotsOnTarget),
    passes: sum((s) => s.passes),
    passesCompleted: sum((s) => s.passesCompleted),
    tackles: sum((s) => s.tackles),
    interceptions: sum((s) => s.interceptions),
    recoveries: sum((s) => s.recoveries),
    dribbles: sum((s) => s.dribbles),
    fouls: sum((s) => s.fouls),
    yellowCards: sum((s) => s.yellowCards),
    redCards: sum((s) => s.redCards),
    avgRating: round2(mean(stats.map((s) => s.rating))),
  };
}

/** Formato argentino: `$ 1.200.000`. */
export function formatMoney(value: number): string {
  const n = Math.round(value);
  const negative = n < 0;
  const digits = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}$ ${digits}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso(): string {
  return new Date().toISOString();
}
/** Preserve predicate order while awaiting database-backed eligibility checks. */
export async function asyncFilter<T>(values: T[], predicate: (value: T, index: number, values: T[]) => unknown | Promise<unknown>): Promise<T[]> {
  const result: T[] = [];
  for (let index = 0; index < values.length; index++) if (await predicate(values[index], index, values)) result.push(values[index]);
  return result;
}
