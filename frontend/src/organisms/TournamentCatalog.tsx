import { Link } from "react-router-dom";
import { MediaImage } from "../atoms/MediaImage";
import { Badge } from "../atoms/Badge";
import { CardBody } from "../atoms/Card";
import type { Tournament } from "../types/tournament";
export function TournamentCatalog({
  items,
  base,
  defaultTournamentId,
}: {
  items: Tournament[];
  base: string;
  defaultTournamentId?: number | null;
}) {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((item) => (
        <Link
          key={item.id}
          to={`${base}/${item.id}`}
          className="tournament-card card bg-base-100 border border-base-300 hover:border-primary overflow-hidden"
        >
          {item.imageUrl ? (
            <MediaImage
              src={item.imageUrl}
              alt={`Foto del torneo ${item.name}`}
              className="w-full h-48 object-contain bg-base-200"
            />
          ) : null}
          <CardBody>
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase tracking-wider text-primary">
                {item.leagueName}
              </span>
              <Badge
                size="sm"
                tone={item.status === "publicado" ? "success" : "neutral"}
              >
                {item.status}
              </Badge>
            </div>
            <h2 className="font-bold text-xl">{item.name}</h2>
            <p className="text-sm text-base-content/60">
              {item.season} · Fútbol {item.rules.format}
            </p>
            <div className="flex gap-3 mt-2 text-sm">
              <strong>
                {item.rules.periods} × {item.rules.minutesPerPeriod} min
              </strong>
              <span>
                {item.rules.maxSquad === null
                  ? "Convocatoria por confirmar"
                  : `Hasta ${item.rules.maxSquad} convocados`}
              </span>
            </div>
            <p className="text-xs mt-3 text-primary">
              {defaultTournamentId === item.id
                ? "Torneo predeterminado · "
                : ""}
              Abrir normativa →
            </p>
          </CardBody>
        </Link>
      ))}
    </div>
  );
}
