import type { Match } from "./entities";

/** Colombia uses UTC-5; authorization is evaluated on the server clock. */
export function colombiaDay(timestamp: number): string {
  return new Date(timestamp - 5 * 3600000).toISOString().slice(0, 10);
}

export function matchDayPolicy(
  match: Pick<Match, "kickOff" | "status">,
  accessDate: string | null | undefined,
  now: number,
) {
  const kickOff = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(
    match.kickOff,
  )
    ? match.kickOff + "-05:00"
    : match.kickOff;
  const date = colombiaDay(now);
  const isMatchDay =
    colombiaDay(Date.parse(kickOff)) === date && match.status === "programado";
  const attendanceOnlyUntil =
    isMatchDay && accessDate === date
      ? new Date(Date.parse(date + "T00:00:00-05:00") + 86400000).toISOString()
      : null;
  return { isMatchDay, attendanceOnlyUntil };
}
