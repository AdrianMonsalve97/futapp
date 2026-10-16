import { Link } from "react-router-dom";
import { ClubLogo } from "../atoms/ClubLogo";
import { Icon } from "../atoms/Icon";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import type { Match } from "../types/api";

export function MatchDayHero({ match }: { match: Match | null }) {
  const { user } = useAuth(),
    { settings } = useSettings();
  const base = user?.role === "admin" ? "/admin" : "/jugador";
  return (
    <section className="club-hero" aria-label="Bienvenido al club">
      <img
        className="club-hero-background"
        src="/brand/stadium-night.webp"
        alt=""
        fetchPriority="high"
      />
      <div className="club-hero-shade" />
      <div className="club-hero-copy">
        <p className="club-eyebrow">
          <span /> FÚTBOL · AMISTAD · PASIÓN
        </p>
        <h2>
          {settings.teamName}
          <em>
            UNA MISMA
            <br />
            CAMISETA.
          </em>
        </h2>
        <p>
          El fútbol se juega en equipo. La próxima historia la escribimos
          juntos.
        </p>
        <div className="club-hero-actions">
          <Link
            className="btn btn-primary"
            to={match ? `${base}/partidos/${match.id}` : `${base}/partidos`}
          >
            {match ? "Vivir el próximo partido" : "Explorar el calendario"}
            <Icon name="arrowRight" size={16} />
          </Link>
          <Link className="club-text-link" to={`${base}/torneos`}>
            Nuestro torneo <Icon name="arrowRight" size={15} />
          </Link>
        </div>
      </div>
      <div className="club-hero-identity" aria-hidden="true">
        <ClubLogo className="club-hero-crest" />
        <span>
          UN ESCUDO.
          <br />
          TODAS NUESTRAS HISTORIAS.
        </span>
      </div>
      <div className="club-hero-bottom">
        <span>TEMPORADA {settings.season}</span>
        <span>
          FÚTBOL {match?.format ?? settings.format} <i />{" "}
          {match?.minutes ?? settings.profile.matchMinutes} MINUTOS DE PASIÓN
        </span>
      </div>
    </section>
  );
}
