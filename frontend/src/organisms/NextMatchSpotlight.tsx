import { useId } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { getFormat } from "../data/formations";
import { Icon } from "../atoms/Icon";
import { Button } from "../atoms/Button";
import { MatchFaceoff } from "../molecules/MatchFaceoff";
import { MatchCountdown } from "../molecules/MatchCountdown";
import { ConfirmAction } from "../molecules/ConfirmAction";
import type { CalendarMatch } from "../types/api";
import type { MatchListProps } from "./MatchList";

type Props = Pick<
  MatchListProps,
  "mode" | "detailHref" | "onEdit" | "onDelete"
> & { match: CalendarMatch };

export function NextMatchSpotlight({
  match,
  mode = "player",
  detailHref,
  onEdit,
  onDelete,
}: Props) {
  const { settings } = useSettings();
  const headingId = useId();
  const profile = getFormat(match.format);
  const published = Boolean(match.lineupPublishedAt);
  const formation =
    mode === "admin"
      ? match.formation
      : published
        ? (match.publishedFormation ?? match.formation)
        : null;
  const rules = match.tournamentRules;
  return (
    <section className="next-match-spotlight" aria-labelledby={headingId}>
      <div className="next-match-stadium" aria-hidden="true" />
      <header className="next-match-header">
        <div>
          <p className="next-match-eyebrow">EL SIGUIENTE DESAFÍO</p>
          <h2 id={headingId}>
            La próxima <em>batalla.</em>
          </h2>
        </div>
        <div className="next-match-competition">
          <Icon name="trofeo" size={20} />
          <div>
            <span>LA COMPETICIÓN</span>
            <strong>{match.competition}</strong>
          </div>
        </div>
      </header>
      <div className="next-match-arena">
        <MatchFaceoff
          teamName={settings.teamName}
          opponent={match.opponent}
          isHome={match.isHome}
        />
        <div className="next-match-clock">
          <p className="next-match-eyebrow">
            {match.status === "pospuesto"
              ? "ESPERANDO NUEVA FECHA"
              : "CADA SEGUNDO NOS ACERCA"}
          </p>
          <MatchCountdown match={match} />
          {detailHref && (
            <Link
              to={detailHref(match)}
              className="next-match-enter btn btn-primary"
            >
              {mode === "admin"
                ? "Preparar el partido"
                : match.status === "pospuesto"
                  ? "Consultar el partido"
                  : "Voy al partido"}
              <Icon name="arrowRight" size={19} />
            </Link>
          )}
          <p className="next-match-hint">
            {match.status === "pospuesto"
              ? "La nueva fecha aparecerá aquí cuando se confirme."
              : mode === "admin"
                ? "Convocatoria, arbitraje y sala táctica."
                : "Confirma tu asistencia y prepara tu próximo partido."}
          </p>
        </div>
      </div>
      <dl className="next-match-details">
        <div>
          <dt>
            <Icon name="futbol" size={17} />
            EL ENCUENTRO
          </dt>
          <dd>
            {profile.name} <span>·</span> {match.minutes} min
            <small>
              {rules
                ? `${rules.periods} tiempos de ${rules.minutesPerPeriod} minutos`
                : `${profile.playersOnPitch} jugadores por equipo`}
            </small>
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="shield" size={17} />
            LA CANCHA
          </dt>
          <dd>
            {match.venue || "Cancha por confirmar"}
            {match.venueMap ? (
              <a
                href={match.venueMap.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Cómo llegar <Icon name="arrowRight" size={13} />
                <span className="sr-only">
                  {" "}
                  (abre Google Maps en otra pestaña)
                </span>
              </a>
            ) : (
              <small>
                {match.isHome
                  ? "Defendemos nuestra casa"
                  : "Llevamos el escudo de visitante"}
              </small>
            )}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="clipboard" size={17} />
            EL PLAN DE JUEGO
          </dt>
          <dd>
            {formation || "Por publicar"}
            <small>
              {mode === "player" && published && match.mySlot
                ? `Estás en el ${profile.playersOnPitch} inicial publicado`
                : mode === "admin" && published
                  ? "Sistema de trabajo · Hay una alineación publicada"
                  : published
                    ? "Alineación publicada"
                    : "Alineación en preparación"}
            </small>
          </dd>
        </div>
      </dl>
      {mode === "admin" && (onEdit || onDelete) && (
        <footer className="next-match-admin">
          <span>GESTIÓN DEL ENCUENTRO</span>
          <div>
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(match)}>
                <Icon name="edit" size={15} />
                Editar datos
              </Button>
            )}
            {onDelete && (
              <ConfirmAction
                title="Eliminar partido"
                message={`Se eliminará el partido vs. ${match.opponent} junto con sus estrategias y alineación. ¿Continuar?`}
                label="Eliminar partido"
                confirmLabel="Eliminar"
                variant="danger"
                className="next-match-remove"
                size="sm"
                onConfirm={() => onDelete(match)}
              />
            )}
          </div>
        </footer>
      )}
    </section>
  );
}
