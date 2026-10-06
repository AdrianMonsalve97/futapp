import { Link } from 'react-router-dom';
import { Alert } from '../atoms/Alert';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { EmptyState } from '../atoms/EmptyState';
import { Icon } from '../atoms/Icon';
import { Spinner } from '../atoms/Spinner';
import { StatusBadge } from '../molecules/StatusBadge';
import { ConfirmAction } from '../molecules/ConfirmAction';
import { useSettings } from '../context/SettingsContext';
import { getFormat } from '../data/formations';
import { formatDateTime, formatWeekdayShort } from '../utils/format';
import type { LineupSlot, Match } from '../types/api';

export type MatchListMatch = Match & {
  mySlot?: LineupSlot | null;
  strategiesCount?: number;
  lineupFilled?: number;
};

export interface MatchListProps {
  matches: MatchListMatch[];
  /** `player` agrega "Estás en el XI" y link de detalle; `admin` agrega acciones. */
  mode?: 'player' | 'admin';
  /** Ruta de detalle para el modo jugador. */
  detailHref?: (match: Match) => string;
  onEdit?: (match: Match) => void;
  onDelete?: (match: Match) => void;
  isLoading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyMessage?: string;
  className?: string;
}

/** Lista de partidos en tarjetas (próximos/jugados) con estados y acciones. */
export function MatchList({
  matches,
  mode = 'player',
  detailHref,
  onEdit,
  onDelete,
  isLoading = false,
  error = null,
  emptyTitle = 'No hay partidos',
  emptyMessage = 'Cuando se programe un partido va a aparecer acá.',
  className = '',
}: MatchListProps) {
  const { settings } = useSettings();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) return <Alert tone="error">No se pudieron cargar los partidos: {error}</Alert>;
  if (matches.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} icon="futbol" />;
  }

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {matches.map((match) => {
        const played = match.status === 'jugado';
        const inXl = Boolean(match.mySlot);
        const isWholeCardLink = mode === 'player' && Boolean(detailHref);
        const profile = getFormat(match.format ?? settings.profile.format);
        const minutes = match.minutes ?? profile.matchMinutes;
        const body = (
          <div className="card bg-base-100 border border-base-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="card-body p-4 gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-16 shrink-0 text-center rounded-xl bg-primary/10 text-primary py-2">
                  <p className="text-lg font-bold leading-none">{formatWeekdayShort(match.kickOff).split(',')[1]?.trim() ?? '—'}</p>
                  <p className="text-[11px] uppercase">{formatWeekdayShort(match.kickOff).split(',')[0]}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">
                      {match.isHome ? 'vs.' : 'vs.'} {match.opponent}
                    </p>
                    <StatusBadge status={match.status} />
                    {mode === 'player' && inXl ? <Badge tone="success" size="xs">En el XI</Badge> : null}
                  </div>
                  <p className="text-xs text-base-content/60 mt-0.5 capitalize">{match.competition}</p>
                  <p className="text-xs text-base-content/50">
                    {formatDateTime(match.kickOff)}
                    {match.venue ? ` · ${match.venue}` : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <Badge tone="neutral" size="xs">{match.formation}</Badge>
                    <Badge tone="info" size="xs">{profile.name} · {minutes}'</Badge>
                    {mode === 'player' && match.strategiesCount !== undefined ? (
                      <span className="text-[11px] text-base-content/50 inline-flex items-center gap-1">
                        <Icon name="clipboard" size={12} />
                        {match.strategiesCount} estrategias
                      </span>
                    ) : null}
                    {mode === 'admin' && match.lineupFilled !== undefined ? (
                      <span className="text-[11px] text-base-content/50">
                        XI {match.lineupFilled}/{profile.playersOnPitch}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:justify-end shrink-0">
                {played && match.goalsFor !== null && match.goalsAgainst !== null ? (
                  <div className="rounded-lg bg-base-200 px-3 py-1.5 text-center">
                    <p className="text-xl font-bold tabular-nums leading-none">
                      {match.goalsFor} – {match.goalsAgainst}
                    </p>
                    <p className="text-[10px] text-base-content/50 uppercase">Resultado</p>
                  </div>
                ) : null}

                {mode === 'admin' ? (
                  <div className="flex items-center gap-1">
                    {detailHref ? (
                      <Link to={detailHref(match)} className="btn btn-outline btn-sm">
                        Gestionar
                        <Icon name="arrowRight" size={14} />
                      </Link>
                    ) : null}
                    {onEdit ? (
                      <Button size="sm" variant="outline" onClick={() => onEdit(match)}>
                        <Icon name="edit" size={14} />
                        Editar
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <ConfirmAction
                        title="Eliminar partido"
                        message={`Se eliminará el partido vs. ${match.opponent} junto con sus estrategias y alineación. ¿Continuar?`}
                        confirmLabel="Eliminar"
                        onConfirm={() => onDelete(match)}
                      />
                    ) : null}
                  </div>
                ) : detailHref && mode === 'player' && !isWholeCardLink ? (
                  <Link to={detailHref(match)} className="btn btn-outline btn-sm">
                    Ver detalle
                    <Icon name="arrowRight" size={14} />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        );

        return isWholeCardLink && detailHref ? (
          <Link key={match.id} to={detailHref(match)} className="block">
            {body}
          </Link>
        ) : (
          <div key={match.id}>{body}</div>
        );
      })}
    </div>
  );
}
