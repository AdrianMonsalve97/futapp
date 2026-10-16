import { Link } from "react-router-dom";
import type { SquadMember } from "../../../backend/src/domain/squad";
import { PlayerPerformanceCard } from "../molecules/PlayerPerformanceCard";
import { PerformanceTrend } from "../molecules/PerformanceTrend";
import { PerformanceMeter } from "../molecules/PerformanceMeter";
import { EmptyState } from "../atoms/EmptyState";
import { Modal } from "../atoms/Modal";

export function PlayerPerformanceDetail({
  member,
  base,
  close,
}: {
  member: SquadMember;
  base: string;
  close: () => void;
}) {
  const { stats, recent } = member;
  return (
    <Modal
      open
      title={`Rendimiento · ${member.name}`}
      onClose={close}
      size="lg"
    >
      <div className="performance-detail">
        <div>
          <PlayerPerformanceCard member={member} />
          <p className="text-xs text-base-content/60 mt-3">
            Media sobre 10 de partidos evaluados. No es una puntuación de
            atributos físicos.
          </p>
        </div>
        <div className="space-y-5">
          <div>
            <p className="sport-eyebrow">Lo que aporta al equipo</p>
            <h3 className="text-xl font-bold">Su fútbol, en cifras</h3>
          </div>
          <dl className="sport-metrics">
            {[
              ["Minutos", stats.minutes],
              ["Goles", stats.goals],
              ["Asistencias", stats.assists],
              ["Recuperaciones", stats.recoveries],
              ["Entradas", stats.tackles],
              ["Intercepciones", stats.interceptions],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <PerformanceMeter
            label="Pases completados"
            value={stats.passesCompleted}
            total={stats.passes}
          />
          <PerformanceMeter
            label="Tiros a puerta"
            value={stats.shotsOnTarget}
            total={stats.shots}
          />
          {member.position === "POR" && (
            <p className="text-sm text-base-content/60">
              La ficha de portero muestra los registros disponibles. La app aún
              no registra atajadas ni porterías a cero.
            </p>
          )}
          <PerformanceTrend entries={recent} />
          <section>
            <h4 className="font-bold mb-3">Últimas actuaciones evaluadas</h4>
            {recent.length ? (
              <ol className="performance-recent">
                {recent.map((stat) => (
                  <li key={stat.matchId}>
                    <Link to={`${base}/partidos/${stat.matchId}`}>
                      <span>
                        <small>
                          {new Date(stat.kickOff).toLocaleDateString("es-CO", {
                            day: "numeric",
                            month: "short",
                          })}
                        </small>
                        <strong>vs. {stat.opponent}</strong>
                      </span>
                      <span>{stat.minutes}′</span>
                      <b
                        className="performance-rating"
                        style={
                          {
                            "--rating": `${Math.min(100, stat.rating * 10)}%`,
                          } as React.CSSProperties
                        }
                      >
                        {stat.rating.toFixed(1)}
                      </b>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                title="Su historia está por empezar"
                message="Después del partido, el administrador puede registrar sus minutos y estadísticas."
                icon="futbol"
              />
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}
