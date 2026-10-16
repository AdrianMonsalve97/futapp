import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useFetch } from "../hooks/useFetch";
import { Icon } from "../atoms/Icon";
import { useSettings } from "../context/SettingsContext";
import { ClubLogo } from "../atoms/ClubLogo";
import { UniformProductImage } from "../molecules/UniformProductImage";
import type { Tournament } from "../types/tournament";
import type { Uniform, MeUniformsResponse } from "../types/api";
import type { LeagueView } from "../types/league";

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
      <section className="club-roster-invite">
        <ClubLogo className="w-20 h-20" />
        <div>
          <p className="sport-eyebrow">EL EQUIPO, EN SU VESTUARIO</p>
          <h3>Conoce a quienes juegan contigo.</h3>
          <p>
            Fotos, posiciones y rendimiento de cada integrante, en la plantilla
            del club.
          </p>
        </div>
        <Link
          className="btn btn-outline"
          to={`${base}/plantilla${tournament ? `?torneo=${tournament.id}` : ""}`}
        >
          Entrar a la plantilla →
        </Link>
      </section>
    </>
  );
}
