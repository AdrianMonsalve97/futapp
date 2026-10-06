import { useFetch } from '../../hooks/useFetch';
import { useTeamFormat } from '../../context/SettingsContext';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { EmptyState } from '../../atoms/EmptyState';
import { Spinner } from '../../atoms/Spinner';
import { StatCardsRow } from '../../organisms/StatCardsRow';
import { PerformanceChart } from '../../organisms/PerformanceChart';
import { RatingTrendChart } from '../../organisms/RatingTrendChart';
import { RatingBadge } from '../../molecules/RatingBadge';
import { RateNote } from '../../molecules/RateNote';
import { formatMinutes, formatNumber } from '../../utils/format';
import type { MeMatchesResponse, MeStatsResponse } from '../../types/api';

/** Mis estadísticas (SPEC §10.4): resumen, tabla por partido y charts. */
export function MyStatsPage() {
  const stats = useFetch<MeStatsResponse>('/api/me/stats');
  const matches = useFetch<MeMatchesResponse>('/api/me/matches');
  /** §12.7.9 — las métricas se normalizan "por partido" (salvo f11: "por 90'"). */
  const profile = useTeamFormat();

  if (stats.loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (stats.error) {
    return (
      <>
        <PageHeader title="Mis estadísticas" subtitle="Tu rendimiento en la temporada" />
        <Alert tone="error" title="No se pudieron cargar tus estadísticas" onClose={stats.reload}>
          {stats.error}
        </Alert>
      </>
    );
  }

  const summary = stats.data?.summary;
  const rows = stats.data?.matches ?? [];
  const opponents = new Map((matches.data?.finished ?? []).map((match) => [match.id, match.opponent]));
  const label = (matchId: number) => opponents.get(matchId) ?? `#${matchId}`;
  const ordered = [...rows].sort((a, b) => a.matchId - b.matchId);

  if (!summary) {
    return (
      <>
        <PageHeader title="Mis estadísticas" subtitle="Tu rendimiento en la temporada" />
        <EmptyState title="Sin estadísticas" message="Todavía no hay datos de tu rendimiento." icon="clipboard" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Mis estadísticas" subtitle="Tu rendimiento en la temporada" />

      <RateNote format={profile.format} className="-mt-3 mb-4" />

      <StatCardsRow
        columns={5}
        tiles={[
          { label: 'Partidos', value: summary.appearances, icon: 'futbol', tone: 'primary' },
          {
            label: 'Minutos',
            value: formatNumber(summary.minutes),
            icon: 'calendar',
            tone: 'neutral',
            hint: formatMinutes(summary.minutes),
          },
          { label: 'Goles', value: summary.goals, icon: 'trofeo', tone: 'success' },
          {
            label: 'Asistencias',
            value: summary.assists,
            icon: 'arrowRight',
            tone: 'info',
            hint: `${summary.shotsOnTarget} tiros a puerta`,
          },
          {
            label: 'Calificación promedio',
            value: summary.avgRating.toFixed(1),
            icon: 'chart',
            tone: 'primary',
            hint: `${formatNumber(summary.passesCompleted)}/${formatNumber(summary.passes)} pases completados`,
          },
        ]}
      />

      <Card className="mt-4">
        <CardBody className="gap-3">
          <CardTitle className="text-base">Detalle por partido</CardTitle>
          {ordered.length === 0 ? (
            <EmptyState
              title="Sin partidos con estadísticas"
              message="Cuando se carguen tus números van a aparecer acá."
              icon="clipboard"
            />
          ) : (
            <div className="overflow-x-auto scroll-slim rounded-xl border border-base-200">
              <table className="table table-sm">
                <thead className="bg-base-200">
                  <tr>
                    <th>Rival</th>
                    <th className="text-center">Min</th>
                    <th className="text-center">G</th>
                    <th className="text-center">A</th>
                    <th className="text-center">Tiros</th>
                    <th className="text-center">Pases</th>
                    <th className="text-center">Recuper.</th>
                    <th className="text-center">Tarjetas</th>
                    <th className="text-center">Calificación</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((stat) => (
                    <tr key={`${stat.matchId}-${stat.playerId}`} className="hover">
                      <td className="font-medium whitespace-nowrap">{label(stat.matchId)}</td>
                      <td className="text-center tabular-nums">{stat.minutes}</td>
                      <td className="text-center tabular-nums font-semibold">{stat.goals}</td>
                      <td className="text-center tabular-nums font-semibold">{stat.assists}</td>
                      <td className="text-center tabular-nums">
                        {stat.shots}
                        {stat.shotsOnTarget > 0 ? <span className="text-base-content/50"> ({stat.shotsOnTarget})</span> : null}
                      </td>
                      <td className="text-center tabular-nums">
                        {stat.passesCompleted}/{stat.passes}
                      </td>
                      <td className="text-center tabular-nums">{stat.recoveries}</td>
                      <td className="text-center">
                        {stat.yellowCards > 0 ? <span className="text-warning font-bold">{stat.yellowCards}A</span> : null}
                        {stat.redCards > 0 ? <span className="text-error font-bold"> {stat.redCards}R</span> : null}
                        {stat.yellowCards === 0 && stat.redCards === 0 ? <span className="text-base-content/40">—</span> : null}
                      </td>
                      <td className="text-center">
                        <RatingBadge value={stat.rating} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 mt-4 lg:grid-cols-2">
        <Card>
          <CardBody className="gap-2">
            <CardTitle className="text-base">Goles y asistencias por partido</CardTitle>
            <PerformanceChart
              series={[
                { name: 'Goles', fill: 'fill-primary' },
                { name: 'Asistencias', fill: 'fill-secondary' },
              ]}
              items={ordered.map((stat) => ({
                label: label(stat.matchId),
                values: [stat.goals, stat.assists],
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-2">
            <CardTitle className="text-base">Evolución de la calificación</CardTitle>
            <RatingTrendChart
              points={ordered.map((stat) => ({ label: label(stat.matchId), value: stat.rating }))}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
