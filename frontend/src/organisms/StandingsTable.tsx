import type { LeagueView } from "../../../backend/src/domain/standings";

export function StandingsTable({ league }: { league: LeagueView }) {
  return (
    <>
      <div
        className="club-league-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Clasificación de la liga; desliza para ver todos los datos"
      >
        <table className="club-league-table">
          <caption>
            Clasificación provisional · {league.counted} partidos con resultado
          </caption>
          <thead>
            <tr>
              <th scope="col">Pos.</th>
              <th scope="col">Equipo</th>
              <th scope="col">
                <abbr title="Partidos jugados">PJ</abbr>
              </th>
              <th scope="col">
                <abbr title="Ganados">G</abbr>
              </th>
              <th scope="col">
                <abbr title="Empatados">E</abbr>
              </th>
              <th scope="col">
                <abbr title="Perdidos">P</abbr>
              </th>
              <th scope="col" className="league-detail-col">
                <abbr title="Goles a favor">GF</abbr>
              </th>
              <th scope="col" className="league-detail-col">
                <abbr title="Goles en contra">GC</abbr>
              </th>
              <th scope="col">
                <abbr title="Diferencia de gol">DG</abbr>
              </th>
              <th scope="col">Pts.</th>
            </tr>
          </thead>
          <tbody>
            {league.rows.map((row) => (
              <tr key={row.name} className={row.club ? "league-club" : ""}>
                <td>{row.position}</td>
                <th scope="row">
                  {row.name}
                  {row.club ? (
                    <span className="text-primary"> · Tu club</span>
                  ) : (
                    ""
                  )}
                </th>
                <td>{row.played}</td>
                <td>{row.won}</td>
                <td>{row.drawn}</td>
                <td>{row.lost}</td>
                <td className="league-detail-col">{row.goalsFor}</td>
                <td className="league-detail-col">{row.goalsAgainst}</td>
                <td>
                  {row.difference > 0 ? "+" : ""}
                  {row.difference}
                </td>
                <td>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="club-league-legend">
        PJ: jugados · G: ganados · E: empatados · P: perdidos · GF/GC: goles a
        favor/en contra · DG: diferencia. {league.config.rules.win} puntos por
        victoria, {league.config.rules.draw} por empate y{" "}
        {league.config.rules.loss} por derrota. Desempate:{" "}
        {league.config.rules.tiebreak === "difference"
          ? "diferencia de gol y luego goles a favor"
          : "goles a favor y luego diferencia de gol"}
        . Si persiste la igualdad, comparten posición.
      </p>
    </>
  );
}
