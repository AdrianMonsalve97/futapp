import { upcomingFixtures } from "../utils/upcoming-fixtures";
import { MatchList, type MatchListProps } from "./MatchList";
import { NextMatchSpotlight } from "./NextMatchSpotlight";

export function UpcomingMatches(props: MatchListProps) {
  const { featured, remaining } = upcomingFixtures(props.matches);
  if (props.isLoading || props.error || !featured)
    return <MatchList {...props} />;
  return (
    <div className="upcoming-match-experience">
      <NextMatchSpotlight
        match={featured}
        mode={props.mode}
        detailHref={props.detailHref}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
      />
      {remaining.length > 0 && (
        <section
          className="next-match-schedule"
          aria-label="Más fechas del equipo"
        >
          <header>
            <div>
              <p className="sport-eyebrow">EL CAMINO CONTINÚA</p>
              <h2>Más fechas del equipo</h2>
            </div>
            <span>
              {remaining.length}{" "}
              {remaining.length === 1 ? "encuentro" : "encuentros"}
            </span>
          </header>
          <MatchList {...props} matches={remaining} />
        </section>
      )}
    </div>
  );
}
