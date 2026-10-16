import { Icon } from "../atoms/Icon";
import { Badge } from "../atoms/Badge";
import { formatKickoffDate } from "../utils/match-clock";
import type { Match } from "../types/api";

export interface MatchMetaProps {
  match: Match;
  /** Incluye la lÃ­nea de sede y estado. */
  compact?: boolean;
  className?: string;
}

/** Cabecera meta de un partido: competencia, fecha/hora, sede y localÃ­a. */
export function MatchMeta({ match }: MatchMetaProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-base-content/70">
      <span className="inline-flex items-center gap-1.5">
        <Icon name="shield" size={15} className="text-primary" />
        {match.competition}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Icon name="calendar" size={15} className="text-primary" />
        {formatKickoffDate(match.kickOff)}
      </span>
      {match.venue ? (
        <span className="inline-flex items-center gap-1.5">
          <Icon name="futbol" size={15} className="text-primary" />
          {match.venue}
        </span>
      ) : null}
      <Badge tone={match.isHome ? "success" : "neutral"} size="xs">
        {match.isHome ? "Local" : "Visita"}
      </Badge>
      <span className="capitalize">{match.status}</span>
    </div>
  );
}
