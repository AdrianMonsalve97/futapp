import { MatchDayHero } from '../../organisms/MatchDayHero';
import { AttendancePanel } from '../../organisms/AttendancePanel';
import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useTeamFormat } from '../../context/SettingsContext';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Badge } from '../../atoms/Badge';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { EmptyState } from '../../atoms/EmptyState';
import { Icon } from '../../atoms/Icon';
import { Spinner } from '../../atoms/Spinner';
import { StatCardsRow } from '../../organisms/StatCardsRow';
import { RatingTrendChart } from '../../organisms/RatingTrendChart';
import { FormationPitch, pitchSizeClass, pitchSlotsFrom } from '../../organisms/FormationPitch';
import { MatchMeta } from '../../molecules/MatchMeta';
import { StatusBadge } from '../../molecules/StatusBadge';
import { Money } from '../../molecules/Money';
import { formatBadge } from '../../data/formations';
import { formatRating, formatWeekdayShort, pendingAmount } from '../../utils/format';
import type { DashboardPlayer, MeMatchesResponse } from '../../types/api';

/** Dashboard del jugador (SPEC §10.4). */
export function PlayerDashboardPage() {
  const { data, loading, error, reload } = useFetch<DashboardPlayer>('/api/dashboard/player');
  const matches = useFetch<MeMatchesResponse>('/api/me/matches');
  /** §12.7.2 — aspecto del pitch según el formato del próximo partido. */
  const profile = useTeamFormat(data?.upcomingMatch?.format);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) {
    return (
      <>
        <PageHeader title="Mi centro de juego" subtitle="Resumen de tu estado en el equipo" />
        <Alert tone="error" title="No se pudo cargar tu panel" onClose={reload}>
          {error}
        </Alert>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Mi centro de juego" subtitle="Resumen de tu estado en el equipo" />
        <EmptyState title="Sin información" message="No hay datos disponibles por el momento." />
      </>
    );
  }

  const { inscription, upcomingMatch, myStats, myRecentStats, mySanctions, uniforms, forecast } = data;
  const activeSanctions = mySanctions.filter((item) => item.status === 'activa');
  const pending = inscription ? pendingAmount(inscription.amount, inscription.paid) : 0;
  const mySlot = upcomingMatch?.lineupSlot ?? null;

  const opponents = new Map((matches.data?.finished ?? []).map((match) => [match.id, match.opponent]));
  const trendPoints = [...myRecentStats]
    .sort((a, b) => a.matchId - b.matchId)
    .slice(-5)
    .map((stat) => ({
      label: opponents.get(stat.matchId) ?? `#${stat.matchId}`,
      value: stat.rating,
    }));

  const pitchSlots = upcomingMatch
    ? pitchSlotsFrom(upcomingMatch.formation, upcomingMatch.lineup, upcomingMatch.format).map((slot) =>
        slot.slotIndex === mySlot?.slotIndex
          ? { ...slot, playerName: slot.playerName ?? 'Tú', highlighted: true }
          : slot,
      )
    : [];

  return (
    <>
      <PageHeader
        title="Mi centro de juego"
        subtitle="Resumen de tu estado en el equipo"
        actions={
          <Link to="/jugador/uniformes" className="btn btn-outline btn-sm">
            <Icon name="camiseta" size={16} />
            Pedir uniforme
          </Link>
        }
      />

      <MatchDayHero match={upcomingMatch} />
      {upcomingMatch && <AttendancePanel matchId={upcomingMatch.id} tournamentId={upcomingMatch.tournamentId} onChanged={reload} />}

      <StatCardsRow
        tiles={[
          {
            label: 'Inscripción',
            value: inscription ? <StatusBadge status={inscription.status} size="md" /> : 'Sin inscribir',
            icon: 'dinero',
            tone: inscription?.status === 'pagada' ? 'success' : 'warning',
            hint:
              inscription && pending > 0 ? (
                <>
                  Falta <Money value={pending} />
                </>
              ) : (
                'Sin deuda pendiente'
              ),
          },
          {
            label: 'Próximo partido',
            value: upcomingMatch ? formatWeekdayShort(upcomingMatch.kickOff) : 'Sin partidos',
            icon: 'calendar',
            tone: 'info',
            hint: upcomingMatch
              ? upcomingMatch.opponent
              : 'A la espera del próximo fixture',
          },
          {
            label: 'Calificación promedio',
            value: formatRating(myStats.avgRating),
            icon: 'chart',
            tone: 'primary',
            hint: forecast
              ? `Pronóstico: ${formatRating(forecast.nextRating, 2)} (${forecast.trend})`
              : `${myStats.appearances} partidos jugados`,
          },
          {
            label: 'Sanciones activas',
            value: activeSanctions.length,
            icon: 'tarjeta',
            tone: activeSanctions.length > 0 ? 'error' : 'success',
            hint: activeSanctions.length > 0 ? 'Revisá el detalle' : 'Todo en regla',
          },
        ]}
      />

      <div className="grid gap-4 mt-4 lg:grid-cols-2">
        <Card>
          <CardBody className="gap-3">
            <CardTitle className="text-base">Próximo partido</CardTitle>
            {upcomingMatch ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-bold">{upcomingMatch.opponent}</p>
                  <div className="flex items-center gap-2">
                    <Badge tone="info" size="sm">
                      {formatBadge(
                        upcomingMatch.format ?? profile.format,
                        upcomingMatch.minutes ?? profile.matchMinutes,
                      )}
                    </Badge>
                    <Badge tone="primary" size="sm">
                      {upcomingMatch.formation}
                    </Badge>
                  </div>
                </div>
                <MatchMeta match={upcomingMatch} />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {mySlot ? (
                    <>
                      <Badge tone="success" size="sm">Estás en el {profile.playersOnPitch} inicial</Badge>
                      <span className="text-base-content/60">
                        Jugás de <span className="font-semibold">{mySlot.label}</span>
                      </span>
                    </>
                  ) : (
                    <Badge tone="neutral" size="sm">Todavía no estás en el {profile.playersOnPitch} inicial</Badge>
                  )}
                </div>
                <div className={pitchSizeClass(profile.format)}>
                  <FormationPitch slots={pitchSlots} format={profile.format} />
                </div>
                <Link to={`/jugador/partidos/${upcomingMatch.id}`} className="btn btn-outline btn-sm self-start">
                  Ver detalle del partido
                  <Icon name="arrowRight" size={14} />
                </Link>
              </>
            ) : (
              <EmptyState
                title="Sin próximo partido"
                message="Cuando se programe un encuentro vas a ver acá tu posición en el campo."
                icon="futbol"
              />
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody className="gap-2">
              <CardTitle className="text-base">Últimos 5 partidos</CardTitle>
              <RatingTrendChart points={trendPoints} />
            </CardBody>
          </Card>

          {inscription && inscription.status !== 'pagada' ? (
            <Alert tone="warning" title="Inscripción no saldada">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Pagaste <Money value={inscription.paid} /> de <Money value={inscription.amount} /> · falta{' '}
                  <Money value={pending} />
                </span>
                <Link to="/jugador/inscripcion" className="btn btn-xs btn-outline">
                  Ver detalle
                </Link>
              </div>
            </Alert>
          ) : (
            <Alert tone="success" title="Inscripción al día">
              Tu inscripción está saldada. ¡Gracias!
            </Alert>
          )}

          <Card>
            <CardBody className="gap-2">
              <CardTitle className="text-base">Uniformes</CardTitle>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Icon name="camiseta" size={16} className="text-primary" />
                  {uniforms.issued.length} en uso
                </span>
                <span className="inline-flex items-center gap-2">
                  <Icon name="clipboard" size={16} className="text-primary" />
                  {uniforms.pendingRequests} solicitudes pendientes
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
