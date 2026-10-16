import { formatKickoffDate } from "../utils/match-clock";
import type { Match } from "../types/api";
import { useMatchCountdown } from "../hooks/useMatchCountdown";

export function MatchCountdown({ match }: { match: Match }) {
  const clock = useMatchCountdown(match.kickOff, match.status === "programado");
  const label =
    match.status === "pospuesto"
      ? "Fecha por reprogramar"
      : match.status === "cancelado"
        ? "Partido cancelado"
        : match.status === "jugado"
          ? "Partido finalizado"
          : !clock
            ? "Horario por confirmar"
            : clock.reached
              ? "Hora de inicio alcanzada"
              : null;
  return (
    <div className="match-countdown">
      {clock && match.status !== "pospuesto" && (
        <time dateTime={new Date(clock.kickoff).toISOString()}>
          {formatKickoffDate(match.kickOff)} <small>· Hora Colombia</small>
        </time>
      )}
      {label ? (
        <p className="match-countdown-status">{label}</p>
      ) : (
        clock && (
          <div
            className="match-countdown-digits"
            role="timer"
            aria-live="off"
            aria-label={`Faltan ${clock.days} días, ${clock.hours} horas, ${clock.minutes} minutos y ${clock.seconds} segundos`}
          >
            {[
              [clock.days, "Días"],
              [clock.hours, "Horas"],
              [clock.minutes, "Min"],
              [clock.seconds, "Seg"],
            ].map(([value, name]) => (
              <div key={name}>
                <strong>{String(value).padStart(2, "0")}</strong>
                <span>{name}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
