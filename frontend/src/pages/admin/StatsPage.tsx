import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { useTeamFormat } from '../../context/SettingsContext';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { EmptyState } from '../../atoms/EmptyState';
import { Select } from '../../atoms/Select';
import { Spinner } from '../../atoms/Spinner';
import { StatCardsRow } from '../../organisms/StatCardsRow';
import { PerformanceChart } from '../../organisms/PerformanceChart';
import { RatingBadge } from '../../molecules/RatingBadge';
import { PositionBadge } from '../../molecules/PositionBadge';
import { RateNote } from '../../molecules/RateNote';
import { StatsEntryForm } from '../../organisms/StatsEntryForm';
import { shortName } from '../../utils/format';
import type { Match, PlayerListItem, StatsEntriesResponse, TeamStats } from '../../types/api';

/** Estadísticas del equipo (SPEC §10.4) + edición de stats de cualquier partido. */
export function StatsPage() {
  const team = useFetch<TeamStats>('/api/team/stats');
  const matches = useFetch<Match[]>('/api/matches');
  const players = useFetch<PlayerListItem[]>('/api/players');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const matchList = matches.data ?? [];
  const activeId = selectedId ?? matchList[0]?.id ?? null;
  const stats = useFetch<StatsEntriesResponse>(activeId ? `/api/matches/${activeId}/stats` : null, [activeId]);
  /** §12.7.7/9 — duración del partido activo y etiqueta de normalización. */
  const activeMatch = matchList.find((match) => match.id === activeId) ?? null;
  const profile = useTeamFormat(activeMatch?.format);

  if (team.loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (team.error || !team.data) {
    return (
      <>
        <PageHeader title="Estadísticas" subtitle="Rankings y promedios del plantel" />
        <Alert tone="error" title="No se pudieron cargar las estadísticas" onClose={team.reload}>
          {team.error ?? 'Sin datos disponibles.'}
        </Alert>
      </>
    );
  }

  const { topScorers, topAssists, topRated, byPosition, teamAverages } = team.data;

  return (
    <>
      <PageHeader title="Estadísticas" subtitle="Rankings, promedios por posición y carga por partido" />

      <RateNote format={profile.format} className="-mt-3 mb-4" />

      <StatCardsRow
        columns={5}
        tiles={[
          { label: 'Goles del equipo', value: teamAverages.goals, icon: 'trofeo', tone: 'success', hint: `${teamAverages.appearances} apariciones` },
          { label: 'Asistencias', value: teamAverages.assists, icon: 'arrowRight', tone: 'info' },
          { label: 'Minutos', value: teamAverages.minutes, icon: 'calendar', tone: 'neutral' },
          { label: 'Precisión de pase', value: `${Math.round((teamAverages.passesCompleted / Math.max(teamAverages.passes, 1)) * 100)}%`, icon: 'chart', tone: 'primary' },
          { label: 'Calificación promedio', value: teamAverages.avgRating.toFixed(1), icon: 'chart', tone: 'primary', hint: `${teamAverages.yellowCards}A · ${teamAverages.redCards}R` },
        ]}
      />

      <div className="grid gap-4 mt-4 lg:grid-cols-3">
        <Card>
          <CardBody className="gap-2">
            <CardTitle className="text-base">Top goleadores</CardTitle>
            <PerformanceChart
              series={[{ name: 'Goles', fill: 'fill-primary' }]}
              items={topScorers.slice(0, 6).map((item) => ({
                label: shortName(item.playerName, 12),
                values: [item.value],
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-2">
            <CardTitle className="text-base">Top asistidores</CardTitle>
            <PerformanceChart
              series={[{ name: 'Asistencias', fill: 'fill-secondary' }]}
              items={topAssists.slice(0, 6).map((item) => ({
                label: shortName(item.playerName, 12),
                values: [item.value],
              }))}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-2">
            <CardTitle className="text-base">Mejor valorado</CardTitle>
            <PerformanceChart
              series={[{ name: 'Calificación', fill: 'fill-success' }]}
              items={topRated.slice(0, 6).map((item) => ({
                label: shortName(item.playerName, 12),
                values: [item.value],
              }))}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 mt-4 lg:grid-cols-2">
        <Card>
          <CardBody className="gap-3">
            <CardTitle className="text-base">Ranking de goleadores</CardTitle>
            {topScorers.length === 0 ? (
              <EmptyState title="Sin goles registrados" message="Aún no se cargaron estadísticas." icon="trofeo" />
            ) : (
              <ul className="space-y-2">
                {topScorers.map((item, index) => (
                  <li key={item.playerId} className="flex items-center gap-3 text-sm">
                    <span className="w-5 font-bold text-base-content/40">{index + 1}</span>
                    <span className="badge badge-neutral badge-sm font-bold">{item.shirtNumber ?? '—'}</span>
                    <span className="flex-1 truncate font-medium">{item.playerName}</span>
                    <span className="font-bold tabular-nums">{item.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-3">
            <CardTitle className="text-base">Promedios por posición</CardTitle>
            {byPosition.length === 0 ? (
              <EmptyState title="Sin datos" message="No hay jugadores con estadísticas." icon="clipboard" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-base-200">
                <table className="table table-sm">
                  <thead className="bg-base-200">
                    <tr>
                      <th>Posición</th>
                      <th className="text-center">Jugadores</th>
                      <th className="text-center">Calificación promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPosition.map((item) => (
                      <tr key={item.position} className="hover">
                        <td>
                          <PositionBadge position={item.position} showTitle />
                        </td>
                        <td className="text-center tabular-nums">{item.count}</td>
                        <td className="text-center">
                          <RatingBadge value={item.avgRating} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Carga de estadísticas por partido */}
      <Card className="mt-4">
        <CardBody className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Editar estadísticas de un partido</CardTitle>
            <div className="w-full sm:w-72">
              <Select
                value={activeId !== null ? String(activeId) : ''}
                onChange={(event) => setSelectedId(Number(event.target.value))}
                aria-label="Seleccionar partido"
              >
                <option value="">— Seleccioná un partido —</option>
                {matchList.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.kickOff.slice(0, 10)} · vs {match.opponent} ({match.status})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {matches.loading ? (
            <div className="flex justify-center py-6">
              <Spinner size="md" />
            </div>
          ) : activeId === null ? (
            <EmptyState
              title="Elegí un partido"
              message="Seleccioná un encuentro para cargar o corregir las estadísticas de cada jugador."
              icon="futbol"
            />
          ) : (
            <StatsEntryForm
              key={activeId}
              matchId={activeId}
              players={players.data ?? []}
              initial={stats.data?.entries ?? []}
              maxMinutes={activeMatch?.minutes ?? profile.matchMinutes}
              onSaved={() => stats.reload()}
            />
          )}

          {stats.error ? <Alert tone="error">{stats.error}</Alert> : null}
        </CardBody>
      </Card>
    </>
  );
}
