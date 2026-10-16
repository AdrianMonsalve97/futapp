import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useFetch } from "../hooks/useFetch";
import { ClubLogo } from "../atoms/ClubLogo";
import { Icon, type IconName } from "../atoms/Icon";
import { UniformProductImage } from "../molecules/UniformProductImage";
import { MediaImage } from "../atoms/MediaImage";
import { initials } from "../utils/format";
import type { Tournament, TournamentRoster } from "../types/tournament";
import { formatDateTime, formatMoney } from "../utils/format";
import type { Match, MeUniformsResponse, Uniform } from "../types/api";
import type { QrPaymentView } from "../types/payments";
import type { LeagueView } from "../../../backend/src/domain/standings";

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
            ? formatDateTime(match.kickOff)
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
            <p>{formatDateTime(latest.kickOff)}</p>
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
                    <small>{formatDateTime(row.kickOff)}</small>
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

export function ClubActionGrid() {
  const { user } = useAuth(),
    admin = user?.role === "admin";
  const payments = useFetch<QrPaymentView>(
    admin ? null : "/api/me/payment-receipts",
  );
  const available =
    payments.data?.debts
      .filter((row) => !row.cancelled)
      .reduce(
        (sum, row) => sum + Math.max(0, row.outstanding - row.pending),
        0,
      ) ?? 0;
  const pending =
    payments.data?.receipts.filter((row) => row.status === "pendiente")
      .length ?? 0;
  const actions: {
    to: string;
    icon: IconName;
    kicker: string;
    title: string;
    description: string;
  }[] = admin
    ? [
        {
          to: "/admin/pagos-qr",
          icon: "dinero",
          kicker: "TESORERÍA",
          title: "Cada aporte cuenta",
          description: "Revisa los soportes y consulta todos los movimientos.",
        },
        {
          to: "/admin/jugadores",
          icon: "usuarios",
          kicker: "EL PLANTEL",
          title: "Un equipo conectado",
          description:
            "Gestiona integrantes, invitaciones y solicitudes de ingreso.",
        },
        {
          to: "/admin/posiciones",
          icon: "trofeo",
          kicker: "LA COMPETICIÓN",
          title: "La liga, fecha a fecha",
          description:
            "Registra los resultados de la jornada y sigue la clasificación.",
        },
      ]
    : [
        {
          to: "/jugador/pagos",
          icon: "dinero",
          kicker: pending
            ? `${pending} SOPORTE${pending === 1 ? "" : "S"} EN REVISIÓN`
            : "TUS APORTES",
          title:
            available > 0
              ? `${formatMoney(available)} por pagar`
              : payments.loading
                ? "Tus pagos, en un lugar"
                : payments.error
                  ? "Consultar mis pagos"
                  : "Revisa tus pagos",
          description:
            "Inscripción, arbitraje y uniformes. Escanea, paga y adjunta el soporte.",
        },
        {
          to: "/jugador/torneos",
          icon: "trofeo",
          kicker: "PREPARA TU TEMPORADA",
          title: "Tu lugar en el torneo",
          description:
            "Consulta tu convocatoria, el reglamento y las fechas. El administrador confirma tu inscripción.",
        },
        {
          to: "/jugador/ia",
          icon: "sparkles",
          kicker: "TU SIGUIENTE NIVEL",
          title: "Haz que tu juego hable",
          description:
            "Descubre tu rol, el planteamiento y las claves para ayudar al equipo.",
        },
      ];
  return (
    <section className="club-action-grid" aria-label="Tu siguiente paso">
      {actions.map((action, index) => (
        <Link key={action.to} to={action.to} className="club-action-card">
          <div>
            <Icon name={action.icon} size={23} />
            <span>0{index + 1}</span>
          </div>
          <small>{action.kicker}</small>
          <h3>{action.title}</h3>
          <p>{action.description}</p>
          <span className="club-action-arrow">
            <Icon name="arrowRight" size={20} />
          </span>
        </Link>
      ))}
    </section>
  );
}

export function ClubHomeExtras() {
  const { user } = useAuth(),
    { settings } = useSettings(),
    base = user?.role === "admin" ? "/admin" : "/jugador";
  const uniforms = useFetch<Uniform[] | MeUniformsResponse>(
    user?.role === "admin" ? "/api/uniforms" : "/api/me/uniforms",
  );
  const tournaments = useFetch<Tournament[]>("/api/tournaments");
  const tournament =
    tournaments.data?.find((row) => row.id === settings.defaultTournamentId) ??
    tournaments.data?.find((row) => row.status === "publicado");
  const league = useFetch<LeagueView>(
    tournament ? `/api/tournaments/${tournament.id}/standings` : null,
  );
  const roster = useFetch<TournamentRoster>(
    tournament ? `/api/tournaments/${tournament.id}/players` : null,
  );
  const catalog = Array.isArray(uniforms.data)
    ? uniforms.data
    : (uniforms.data?.catalog ?? []);
  const kits = catalog
    .filter(
      (row) =>
        row.active &&
        row.imageUrl &&
        ["completo", "camiseta"].includes(row.kind),
    )
    .slice(0, 2);
  return (
    <>
      <div className="club-home-extras">
        <section className="club-table-preview">
          <div className="club-section-label">
            <span>TABLA DE POSICIONES</span>
            <Icon name="trofeo" size={18} />
          </div>
          <h3>Cada punto, una historia.</h3>
          {league.data?.counted ? (
            <>
              <p className="club-muted">
                Clasificación provisional · resultados registrados
              </p>
              <ol>
                {league.data.rows.slice(0, 5).map((row) => (
                  <li key={row.name} className={row.club ? "is-club" : ""}>
                    <span>{row.position}</span>
                    <strong>{row.name}</strong>
                    <small>{row.played} PJ</small>
                    <b>
                      {row.points}
                      <small> PTS</small>
                    </b>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="club-muted">
              {league.error
                ? "No pudimos actualizar la clasificación."
                : "Los puntos llegarán con los resultados. Aquí podrás seguir al equipo en la liga."}
            </p>
          )}
          <Link className="club-text-link" to={`${base}/posiciones`}>
            Explorar la clasificación <Icon name="arrowRight" size={16} />
          </Link>
        </section>
        <section className="club-kit-banner">
          <div className="club-section-label">TIENDA OFICIAL</div>
          <h3>
            LLEVA EL CLUB
            <br />
            <em>CONTIGO.</em>
          </h3>
          <p>
            Nuestra camiseta. Nuestra identidad.
            <br />
            Encuentra la equipación para ti y los tuyos.
          </p>
          <Link className="btn btn-primary btn-sm" to={`${base}/uniformes`}>
            Entrar al vestuario <Icon name="arrowRight" size={16} />
          </Link>
          {kits.length ? (
            <div className="club-real-kits">
              {kits.map((uniform) => (
                <UniformProductImage key={uniform.id} uniform={uniform} />
              ))}
            </div>
          ) : (
            <ClubLogo className="club-kit-empty-crest" />
          )}
        </section>
      </div>
      {tournament && (
        <section className="club-squad-section">
          <div className="club-section-label">
            <span>LOS QUE DEFIENDEN EL ESCUDO</span>
            <Link
              className="club-text-link"
              to={`${base}/torneos/${tournament.id}`}
            >
              Ver plantel <Icon name="arrowRight" size={15} />
            </Link>
          </div>
          <h3>Nuestro equipo. Nuestra fuerza.</h3>
          {roster.error ? (
            <p className="club-muted">
              No pudimos actualizar el plantel.{" "}
              <button className="link" onClick={roster.reload}>
                Reintentar
              </button>
            </p>
          ) : roster.data?.players.some((row) => row.active) ? (
            <div className="club-squad-gallery">
              {roster.data.players
                .filter((row) => row.active)
                .map((row) => (
                  <Link
                    key={row.playerId}
                    to={`${base}/torneos/${tournament.id}`}
                    className="club-player-card"
                  >
                    <div className="club-player-portrait">
                      {row.avatarUrl ? (
                        <MediaImage src={row.avatarUrl} alt={row.playerName} />
                      ) : (
                        <span>{initials(row.playerName)}</span>
                      )}
                      <b>{row.shirtNumber ?? "—"}</b>
                    </div>
                    <div>
                      <strong>{row.playerName}</strong>
                      <small>
                        {
                          {
                            POR: "Portero",
                            DEF: "Defensa",
                            MED: "Mediocampista",
                            DEL: "Delantero",
                          }[row.position]
                        }
                      </small>
                    </div>
                  </Link>
                ))}
            </div>
          ) : (
            <p className="club-muted">
              {roster.loading
                ? "Preparando el vestuario…"
                : "Los jugadores aparecerán cuando se confirme la plantilla de este torneo."}
            </p>
          )}
        </section>
      )}
    </>
  );
}
