import { kickoffTime } from "../../../backend/src/domain/match-schedule";
export { kickoffTime } from "../../../backend/src/domain/match-schedule";

const kickoffFormatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
export function formatKickoffDate(
  value: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const time = kickoffTime(value);
  if (!Number.isFinite(time)) return "Horario por confirmar";
  return options
    ? new Intl.DateTimeFormat("es-CO", {
        ...options,
        timeZone: "America/Bogota",
      }).format(time)
    : kickoffFormatter.format(time);
}

export function matchClock(value: string, now: number) {
  const kickoff = kickoffTime(value);
  if (!Number.isFinite(kickoff)) return null;
  const seconds = Math.max(0, Math.ceil((kickoff - now) / 1000));
  return {
    kickoff,
    reached: seconds === 0,
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}
