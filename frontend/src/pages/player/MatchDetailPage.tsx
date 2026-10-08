import { Link, useParams } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useTeamFormat } from '../../context/SettingsContext';
import { MatchRulesNotice } from '../../molecules/MatchRulesNotice';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Badge } from '../../atoms/Badge';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { EmptyState } from '../../atoms/EmptyState';
import { Icon } from '../../atoms/Icon';
import { Spinner } from '../../atoms/Spinner';
import { FormationPitch, pitchSizeClass, pitchSlotsFrom } from '../../organisms/FormationPitch';
import { StrategyList } from '../../organisms/StrategyList';
import { AttendancePanel } from '../../organisms/AttendancePanel';
import { RefereePaymentPanel } from '../../organisms/RefereePaymentPanel';
import { MatchBroadcast } from '../../organisms/MatchBroadcast';
import { MatchMeta } from '../../molecules/MatchMeta';
import { RatingBadge } from '../../molecules/RatingBadge';
import { StatusBadge } from '../../molecules/StatusBadge';
import { formatBadge } from '../../data/formations';
import { formatMinutes } from '../../utils/format';
import type { MatchDetailResponse } from '../../types/api';

/** Detalle de partido (jugador): cabecera, XI en el pitch, estrategias y mis stats. */
export function MatchDetailPage() {
  const { id } = useParams();
  const matchId = Number(id);
  const { player } = useAuth();
  const valid = Number.isFinite(matchId) && matchId > 0;
  const { data, loading, error, reload } = useFetch<MatchDetailResponse>(
    valid ? `/api/matches/${matchId}` : null,
  );
  /** §12.7.2 — aspecto del pitch y contador según el formato del partido. */
  const profile = useTeamFormat(data?.match.format);

  if (!valid) {
    return (
      <>
        <PageHeader title="Detalle del partido" />
        <Alert tone="error">Identificador de partido inválido.</Alert>
      </>
    );
  }
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHeader title="Detalle del partido" />
        <Alert tone="error" title="No se pudo cargar el partido" onClose={reload}>
          {error ?? 'Sin datos disponibles.'}
        </Alert>
      </>
    );
  }

  const { match, strategies, lineup, stats } = data;
  const myStat = player ? stats.find((entry) => entry.playerId === player.id) : undefined;
  const slots = pitchSlotsFrom(match.formation, lineup, profile.format).map((slot) =>
    player && slot.playerId === player.id ? { ...slot, highlighted: true } : slot,
  );
  const filled = lineup.filter((slot) => slot.playerId).length;
  const matchMinutes = match.minutes ?? profile.matchMinutes;

  return (
    <>
      <PageHeader
        title={`${match.isHome ? 'vs.' : 'en'} ${match.opponent}`}
        subtitle={match.competition}
        actions={
          <Link to="/jugador/partidos" className="btn btn-outline btn-sm">
            <Icon name="arrowLeft" size={14} />
            Volver
          </Link>
        }
      />

      <MatchRulesNotice match={match} />
      <Card className="mb-4">
        {!match.lineupPublishedAt && match.status !== 'jugado' && <p className="px-6 pt-5 text-sm text-base-content/60">El equipo técnico está preparando la alineación. Aparecerá aquí cuando se publique.</p>}
        <CardBody className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MatchMeta match={match} />
            <div className="flex items-center gap-2">
              <StatusBadge status={match.status} size="md" />
              {match.status === 'jugado' && match.goalsFor !== null && match.goalsAgainst !== null ? (
                <span className="text-2xl font-bold tabular-nums">
                  {match.goalsFor} – {match.goalsAgainst}
                </span>
              ) : null}
            </div>
          </div>
          {match.notes ? <p className="text-sm text-base-content/60">{match.notes}</p> : null}
        </CardBody>
      </Card>

      {['programado', 'pospuesto'].includes(match.status) && <AttendancePanel matchId={matchId} tournamentId={match.tournamentId} onChanged={reload} />}
      <RefereePaymentPanel matchId={matchId} onChanged={reload} refreshKey={data}/>
      <MatchBroadcast key={`${match.id}:${match.streamUrl}`} match={match}/>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Alineación</CardTitle>
              <div className="flex max-w-full flex-wrap items-center gap-2">
                <Badge tone="info" size="sm">
                  {formatBadge(profile.format, matchMinutes)}
                </Badge>
                <Badge tone="neutral" size="sm">
                  {match.formation} · {filled}/{profile.playersOnPitch}
                </Badge>
              </div>
            </div>
            <div className={pitchSizeClass(profile.format)}>
              <FormationPitch slots={slots} format={profile.format} highlightSlotIndex={null} />
            </div>
            {player ? (
              <p className="text-sm text-base-content/60 text-center">
                {slots.some((slot) => slot.playerId === player.id)
                  ? 'Tu posición está resaltada en amarillo.'
                  : `No figuras en el ${profile.playersOnPitch} inicial de este partido.`}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody className="gap-2">
              <CardTitle className="text-base">Estrategias del partido</CardTitle>
              <StrategyList strategies={strategies} />
            </CardBody>
          </Card>

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
                      { label: 'Goles', value: myStat.goals },
                      { label: 'Asistencias', value: myStat.assists },
                      { label: 'Tiros', value: myStat.shots },
                      { label: 'Tiros a puerta', value: myStat.shotsOnTarget },
                      { label: 'Pases', value: `${myStat.passesCompleted}/${myStat.passes}` },
                      { label: 'Entradas', value: myStat.tackles },
                      { label: 'Recuperaciones', value: myStat.recoveries },
                      { label: 'Faltas', value: myStat.fouls },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg bg-base-200 px-3 py-2">
                        <p className="text-xs text-base-content/60">{item.label}</p>
                        <p className="font-bold tabular-nums">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {myStat.yellowCards > 0 ? (
                      <Badge tone="warning" size="sm">
                        {myStat.yellowCards} amarilla{myStat.yellowCards > 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                    {myStat.redCards > 0 ? (
                      <Badge tone="error" size="sm">
                        {myStat.redCards} roja{myStat.redCards > 1 ? 's' : ''}
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
        </div>
      </div>
    </>
  );
}
