import type { Match } from "./entities";
import { getFormat } from "./formats";

type Fixture = Pick<Match, "id" | "kickOff" | "status"> &
  Partial<Pick<Match, "minutes" | "format" | "tournamentRules">>;

/** Fixtures without an offset are entered in Colombia, independently of the client. */
export function kickoffTime(value: string): number {
  const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value);
  return Date.parse(local ? `${value}-05:00` : value);
}

/** Elapsed regulation time needs a result; the clock never invents a final score. */
export function awaitingResult(match: Fixture, now = Date.now()): boolean {
  if (match.status !== "programado") return false;
  const minutes = match.minutes ?? getFormat(match.format ?? 8).matchMinutes;
  const rules = match.tournamentRules;
  const breaks = rules ? (rules.periods - 1) * (rules.breakMinutes ?? 0) : 0;
  return now >= kickoffTime(match.kickOff) + (minutes + breaks) * 60_000;
}

export function upcomingFixtures<T extends Fixture>(
  matches: readonly T[],
  now = Date.now(),
) {
  const time = (match: T) => {
    const value = kickoffTime(match.kickOff);
    return Number.isFinite(value) ? value : Infinity;
  };
  const compare = (a: T, b: T) => time(a) - time(b) || a.id - b.id;
  const scheduled = matches
    .filter(
      (match) => match.status === "programado" && !awaitingResult(match, now),
    )
    .sort(compare);
  const postponed = matches
    .filter((match) => match.status === "pospuesto")
    .sort(compare);
  const featured = scheduled[0] ?? postponed[0] ?? null;
  return {
    featured,
    remaining: [...scheduled, ...postponed].filter(
      (match) => match.id !== featured?.id,
    ),
  };
}

export function matchCalendar<T extends Fixture>(
  matches: readonly T[],
  now = Date.now(),
) {
  const { featured, remaining } = upcomingFixtures(matches, now);
  return {
    upcoming: featured ? [featured, ...remaining] : [],
    results: matches
      .filter(
        (match) => match.status === "jugado" || awaitingResult(match, now),
      )
      .sort(
        (a, b) =>
          kickoffTime(b.kickOff) - kickoffTime(a.kickOff) || b.id - a.id,
      ),
    cancelled: matches.filter((match) => match.status === "cancelado"),
  };
}
