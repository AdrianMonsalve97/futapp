import { Badge } from "../atoms/Badge";
import { Card, CardBody, CardTitle } from "../atoms/Card";
import { EmptyState } from "../atoms/EmptyState";
import { RatingBadge } from "../molecules/RatingBadge";
import { formatMinutes } from "../utils/format";
import type { MatchStat } from "../types/api";

export function MyMatchPerformance({
  myStat,
}: {
  myStat: MatchStat | undefined;
}) {
  return (
    <Card>
      <CardBody className="gap-3">
        <CardTitle className="text-base">Mis estadísticas</CardTitle>
        {myStat ? (
          <>
            <div className="flex items-center gap-3">
              <RatingBadge value={myStat.rating} size="lg" />
              <span className="text-sm text-base-content/60">
                Calificación en este partido · {formatMinutes(myStat.minutes)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {[
                { label: "Goles", value: myStat.goals },
                { label: "Asistencias", value: myStat.assists },
                { label: "Tiros", value: myStat.shots },
                { label: "Tiros a puerta", value: myStat.shotsOnTarget },
                {
                  label: "Pases",
                  value: `${myStat.passesCompleted}/${myStat.passes}`,
                },
                { label: "Entradas", value: myStat.tackles },
                { label: "Recuperaciones", value: myStat.recoveries },
                { label: "Faltas", value: myStat.fouls },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg bg-base-200 px-3 py-2"
                >
                  <p className="text-xs text-base-content/60">{item.label}</p>
                  <p className="font-bold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {myStat.yellowCards > 0 ? (
                <Badge tone="warning" size="sm">
                  {myStat.yellowCards} amarilla
                  {myStat.yellowCards > 1 ? "s" : ""}
                </Badge>
              ) : null}
              {myStat.redCards > 0 ? (
                <Badge tone="error" size="sm">
                  {myStat.redCards} roja{myStat.redCards > 1 ? "s" : ""}
                </Badge>
              ) : null}
              {myStat.yellowCards === 0 && myStat.redCards === 0 ? (
                <Badge tone="success" size="sm">
                  Sin tarjetas
                </Badge>
              ) : null}
            </div>
          </>
        ) : (
          <EmptyState
            title="Sin estadísticas de este partido"
            message="Todavía no se cargaron tus números para este encuentro."
            icon="clipboard"
          />
        )}
      </CardBody>
    </Card>
  );
}
