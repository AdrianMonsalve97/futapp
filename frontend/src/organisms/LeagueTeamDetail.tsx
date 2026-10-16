import { Link } from "react-router-dom";
import { teamKey } from "../../../backend/src/domain/standings";
import type { LeagueView } from "../types/league";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../atoms/Modal";
import { LeagueFormGuide } from "../molecules/LeagueFormGuide";

export function LeagueTeamDetail({
  name,
  league,
  onClose,
}: {
  name: string;
  league: LeagueView;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const row = league.rows.find((team) => team.name === name);
  if (!row) return null;
  const fixtures = league.results
    .filter(
      (result) =>
        teamKey(result.home) === teamKey(name) ||
        teamKey(result.away) === teamKey(name),
    )
    .slice()
    .sort((a, b) => b.matchday - a.matchday);
  const goals = row.goalsFor + row.goalsAgainst;
  return (
    <Modal open title={name} onClose={onClose} size="md">
      <div className="league-team-panel">
        <p className="sport-eyebrow">Así llega a la jornada</p>
        <h3>
          #{row.position} · {row.points} puntos
        </h3>
        <LeagueFormGuide form={row.form} />
        <dl className="sport-metrics">
          {[
            ["Jugados", row.played],
            ["Ganados", row.won],
            ["Diferencia", `${row.difference > 0 ? "+" : ""}${row.difference}`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm mb-2">
          {row.goalsFor} goles a favor · {row.goalsAgainst} en contra
        </p>
        {goals > 0 && (
          <div
            className="league-compare-bar"
            role="img"
            aria-label={`${row.goalsFor} goles a favor y ${row.goalsAgainst} en contra`}
          >
            <span style={{ width: `${(row.goalsFor / goals) * 100}%` }} />
            <span style={{ width: `${(row.goalsAgainst / goals) * 100}%` }} />
          </div>
        )}
        <h4 className="font-bold mt-6 mb-2">Partidos de este equipo</h4>
        {!fixtures.length && (
          <p className="text-sm opacity-60">
            Todavía no se han registrado encuentros.
          </p>
        )}
        <ol className="space-y-2">
          {fixtures.map((fixture) => (
            <li key={fixture.id} className="rounded-lg bg-base-200 p-3 text-sm">
              <p className="text-xs opacity-60">
                {fixture.matchday
                  ? `Jornada ${fixture.matchday}`
                  : "Jornada por asignar"}{" "}
                · {fixture.status}
              </p>
              <p className="font-bold my-1">
                {fixture.home}{" "}
                <span className="text-primary">
                  {fixture.status === "jugado"
                    ? `${fixture.homeGoals ?? "—"} – ${fixture.awayGoals ?? "—"}`
                    : "vs."}
                </span>{" "}
                {fixture.away}
              </p>
              {fixture.matchId && (
                <Link
                  className="link text-xs"
                  to={`/${user?.role === "admin" ? "admin" : "jugador"}/partidos/${fixture.matchId}`}
                >
                  Abrir partido →
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
