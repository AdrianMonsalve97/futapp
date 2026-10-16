import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { Icon } from "../atoms/Icon";
import { useSettings } from "../context/SettingsContext";
import { ClubLogo } from "../atoms/ClubLogo";
import { formatKickoffDate } from "../utils/match-clock";
import type { Match } from "../types/api";

export function ClubMatchStrip({ match }: { match: Match | null }) {
  const { user } = useAuth(),
    { settings } = useSettings(),
    list = useFetch<Match[]>("/api/matches");
  const base = user?.role === "admin" ? "/admin" : "/jugador";
  const latest = (list.data ?? [])
    .filter(
      (row) =>
        row.status === "jugado" &&
        row.goalsFor !== null &&
        row.goalsAgainst !== null,
    )
    .sort((a, b) => b.kickOff.localeCompare(a.kickOff))[0];
  const upcoming = (list.data ?? [])
    .filter((row) => row.status === "programado" && row.id !== match?.id)
    .sort((a, b) => a.kickOff.localeCompare(b.kickOff))
    .slice(0, 3);
  return (
    <section className="club-match-strip" aria-label="El club en competición">
      <article>
        <div className="club-section-label">
          <span>PRÓXIMO PARTIDO</span>
          <Icon name="calendar" size={15} />
        </div>
        <div className="club-versus">
          <ClubLogo className="w-14 h-14" />
          <div>
            <small>{match?.competition ?? "Calendario del equipo"}</small>
            <h3>
              {match
                ? `${settings.teamName} vs ${match.opponent}`
                : "El próximo reto está por llegar"}
            </h3>
          </div>
        </div>
        <p>
          {match
            ? formatKickoffDate(match.kickOff)
            : "Aquí verás la fecha, el rival y la cancha."}
        </p>
        {match && (
          <p className="club-muted">{match.venue || "Cancha por confirmar"}</p>
        )}
        <Link
          className="club-text-link"
          to={match ? `${base}/partidos/${match.id}` : `${base}/partidos`}
        >
          {user?.role === "admin"
            ? "Preparar partido"
            : "Ver partido y confirmar asistencia"}
          <Icon name="arrowRight" size={15} />
        </Link>
      </article>
      <article>
        <div className="club-section-label">
          <span>ÚLTIMO RESULTADO</span>
          <Icon name="futbol" size={15} />
        </div>
        {latest ? (
          <>
            <div className="club-scoreline">
              <span>{settings.teamName}</span>
              <strong>
                {latest.goalsFor}
                <i>:</i>
                {latest.goalsAgainst}
              </strong>
              <span>{latest.opponent}</span>
            </div>
            <p>{formatKickoffDate(latest.kickOff)}</p>
            <Link
              className="club-text-link"
              to={`${base}/partidos/${latest.id}`}
            >
              Así fue el partido <Icon name="arrowRight" size={15} />
            </Link>
          </>
        ) : (
          <div className="club-strip-empty">
            <Icon name="futbol" size={28} />
            <strong>La historia empieza en la cancha</strong>
            <p>
              Los marcadores aparecerán cuando se registre el primer resultado.
            </p>
          </div>
        )}
      </article>
      <article>
        <div className="club-section-label">
          <span>EN EL HORIZONTE</span>
          <Icon name="arrowRight" size={15} />
        </div>
        {upcoming.length ? (
          <ul className="club-mini-fixtures">
            {upcoming.map((row) => (
              <li key={row.id}>
                <Link to={`${base}/partidos/${row.id}`}>
                  <span>
                    {row.opponent}
                    <small>{formatKickoffDate(row.kickOff)}</small>
                  </span>
                  <Icon name="arrowRight" size={15} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="club-strip-empty">
            <Icon name="calendar" size={28} />
            <strong>Más fútbol, muy pronto</strong>
            <p>Consulta aquí los siguientes encuentros confirmados.</p>
          </div>
        )}
        {list.error && (
          <p role="alert">
            No se pudo actualizar el calendario.{" "}
            <button className="link" onClick={list.reload}>
              Reintentar
            </button>
          </p>
        )}
      </article>
    </section>
  );
}
