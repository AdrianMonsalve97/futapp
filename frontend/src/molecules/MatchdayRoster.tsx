import { Avatar } from "../atoms/Avatar";
import { RefereePendingDot } from "../atoms/RefereePendingDot";
import type { MatchAttendance } from "../types/api";
import type { PitchSlot } from "../types/tactics";

export function MatchdayRoster({
  confirmed,
  slots,
}: {
  confirmed: MatchAttendance[];
  slots: PitchSlot[];
}) {
  const initial = new Set(
    slots.flatMap((slot) => (slot.playerId == null ? [] : [slot.playerId])),
  );
  return (
    <section
      className="matchday-roster"
      aria-label="Plantilla confirmada del día"
    >
      <div className="matchday-roster-heading">
        <div>
          <p className="sport-eyebrow">DÍA DE PARTIDO</p>
          <h3>Los que dijeron «voy»</h3>
        </div>
        <strong>{confirmed.length} confirmados</strong>
      </div>
      <p className="text-xs text-base-content/65">
        El punto rojo indica arbitraje sin cubrir con pago aprobado. Los
        confirmados que no estén en cancha quedan en el banco de esta plantilla.
      </p>
      {confirmed.length === 0 ? (
        <p className="text-sm">Todavía no hay asistencia confirmada.</p>
      ) : (
        <ul className="matchday-roster-list">
          {confirmed.map((row) => (
            <li key={row.playerId}>
              <Avatar name={row.playerName} src={row.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <strong>{row.playerName}</strong>
                <small>
                  #{row.shirtNumber ?? "—"} · {row.position} ·{" "}
                  {initial.has(row.playerId)
                    ? "En cancha"
                    : row.eligible
                      ? "Banco"
                      : "No habilitado"}
                  {!row.eligible ? ` · ${row.reason ?? "No habilitado"}` : ""}
                </small>
              </div>
              {(row.referee?.outstanding ?? 0) > 0 && <RefereePendingDot />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
