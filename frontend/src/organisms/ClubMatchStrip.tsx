import { Alert } from "../atoms/Alert";
import { Spinner } from "../atoms/Spinner";
import { kickoffTime } from "../utils/match-clock";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icon } from "../atoms/Icon";
import { useSettings } from "../context/SettingsContext";
import { formatKickoffDate } from "../utils/match-clock";
import type { Match } from "../types/api";

export function ClubMatchStrip({
  match,
  matches,
  loading,
  error,
  onRetry,
}: {
  match: Match | null;
  matches: Match[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const { user } = useAuth(),
    { settings } = useSettings();
  const base = user?.role === "admin" ? "/admin" : "/jugador";
  const latest = matches
    .filter(
      (row) =>
        row.status === "jugado" &&
        row.goalsFor !== null &&
        row.goalsAgainst !== null,
    )
    .sort((a, b) => kickoffTime(b.kickOff) - kickoffTime(a.kickOff))[0];
  const upcoming = matches
    .filter(
      (row) =>
        row.status === "programado" &&
        row.id !== match?.id &&
        kickoffTime(row.kickOff) >= Date.now(),
    )
    .sort((a, b) => kickoffTime(a.kickOff) - kickoffTime(b.kickOff))
    .slice(0, 3);
  if (loading && !matches.length)
    return (
      <div className="py-6 text-center">
        <Spinner />
      </div>
    );
  if (error)
    return (
      <Alert tone="error" onClose={onRetry}>
        No se pudo actualizar el calendario: {error}
      </Alert>
    );
  return (
    <section className="club-match-strip" aria-label="El club en competición">
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
      </article>
    </section>
  );
}
