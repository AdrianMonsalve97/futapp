import type { Tournament } from "../types/tournament";
import type { LeagueView } from "../types/league";

export function LeagueSummary({
  tournament,
  league,
}: {
  tournament: Tournament;
  league: LeagueView;
}) {
  return (
    <div className="club-league-summary">
      <div>
        <span className="club-eyebrow">
          {tournament.leagueName} · {tournament.season}
        </span>
        <h2>{tournament.name}</h2>
        <p>
          Tabla provisional según los resultados registrados. Completa todas las
          fechas para reflejar la liga.
          <br />
          Los marcadores del club se sincronizan desde Partidos.
        </p>
      </div>
      <strong>
        {league.rows.find((row) => row.club)?.points ?? 0}
        <small>PUNTOS DEL CLUB</small>
      </strong>
    </div>
  );
}
