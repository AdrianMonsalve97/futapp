import { Icon } from '../atoms/Icon';
import { Badge } from '../atoms/Badge';
import { formatDateTime } from '../utils/format';
import type { Match } from '../types/api';

export interface MatchMetaProps {
  match: Match;
  /** Incluye la línea de sede y estado. */
  compact?: boolean;
  className?: string;
}

/** Cabecera meta de un partido: competencia, fecha/hora, sede y localía. */
export function MatchMeta({ match, compact = false, className = '' }: MatchMetaProps) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-base-content/70 ${className}`.trim()}>
      <span className="inline-flex items-center gap-1.5">
        <Icon name="shield" size={15} className="text-primary" />
        {match.competition}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Icon name="calendar" size={15} className="text-primary" />
        {formatDateTime(match.kickOff)}
      </span>
      {match.venue ? (
        <span className="inline-flex items-center gap-1.5">
          <Icon name="futbol" size={15} className="text-primary" />
          {match.venue}
        </span>
      ) : null}
      <Badge tone={match.isHome ? 'success' : 'neutral'} size="xs">
        {match.isHome ? 'Local' : 'Visita'}
      </Badge>
      {compact ? null : <span className="capitalize">{match.status}</span>}
    </div>
  );
}
