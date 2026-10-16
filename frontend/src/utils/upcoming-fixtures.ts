import type { Match } from "../types/api";
import { kickoffTime } from "./match-clock";

/** Destaca la próxima fecha confirmada; un aplazado nunca desplaza un encuentro programado. */
export function upcomingFixtures<
  T extends Pick<Match, "id" | "kickOff" | "status">,
>(matches: readonly T[], now = Date.now()) {
  const time = (match: T) => {
    const value = kickoffTime(match.kickOff);
    return Number.isFinite(value) ? value : Infinity;
  };
  const compare = (a: T, b: T) => time(a) - time(b) || a.id - b.id;
  const scheduled = matches
    .filter((match) => match.status === "programado")
    .sort(compare);
  const postponed = matches
    .filter((match) => match.status === "pospuesto")
    .sort(compare);
  const future = scheduled.find(
    (match) => Number.isFinite(time(match)) && time(match) >= now,
  );
  const latest = scheduled
    .filter((match) => Number.isFinite(time(match)))
    .at(-1);
  const featured = future ?? latest ?? scheduled[0] ?? postponed[0] ?? null;
  const remaining = [...scheduled, ...postponed].filter(
    (match) => match.id !== featured?.id,
  );
  return { featured, remaining };
}
