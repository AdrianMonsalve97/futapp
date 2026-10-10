import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Avatar } from '../../atoms/Avatar';
import { Badge } from '../../atoms/Badge';
import { Card, CardBody } from '../../atoms/Card';
import { Icon } from '../../atoms/Icon';
import { Spinner } from '../../atoms/Spinner';
import { StatCardsRow } from '../../organisms/StatCardsRow';
import { UniformIssueList } from '../../organisms/UniformIssueList';
import { SanctionsTable } from '../../organisms/SanctionsTable';
import { PerformanceChart } from '../../organisms/PerformanceChart';
import { RatingTrendChart } from '../../organisms/RatingTrendChart';
import { AiPlayerCard } from '../../organisms/AiPlayerCard';
import { HealthForm } from '../../organisms/HealthForm';
import {PlayerRecoveryDialog} from '../../organisms/PlayerRecoveryDialog';
import { PositionBadge } from '../../molecules/PositionBadge';
import { RatingBadge } from '../../molecules/RatingBadge';
import { StatusBadge } from '../../molecules/StatusBadge';
import { Money } from '../../molecules/Money';
import { ProgressBar } from '../../atoms/ProgressBar';
import { ageFrom, formatDate, formatMinutes, formatNumber } from '../../utils/format';
import type { Match, PlayerDetailResponse } from '../../types/api';

type Tab = 'inscripciones' | 'uniformes' | 'sanciones' | 'estadisticas' | 'ia' | 'salud';

const TABS: { key: Tab; label: string }[] = [
  { key: 'inscripciones', label: 'Inscripciones' },
  { key: 'uniformes', label: 'Uniformes' },
  { key: 'salud', label: 'Salud' },
  { key: 'sanciones', label: 'Sanciones' },
  { key: 'estadisticas', label: 'Estadísticas' },
  { key: 'ia', label: 'IA' },
];

/** Ficha de jugador (admin): pestañas de inscripciones, uniformes, sanciones, stats e IA. */
export function PlayerDetailPage() {
  const { id } = useParams();
  const playerId = Number(id);
  const valid = Number.isFinite(playerId) && playerId > 0;
  const { data, loading, error, reload } = useFetch<PlayerDetailResponse>(
    valid ? `/api/players/${playerId}` : null,
  );
  const matches = useFetch<Match[]>('/api/matches');
  const [tab, setTab] = useState<Tab>('inscripciones');

  if (!valid) {
    return (
      <>
        <PageHeader title="Ficha del jugador" />
        <Alert tone="error">Identificador de jugador inválido.</Alert>
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
        <PageHeader title="Ficha del jugador" />
        <Alert tone="error" title="No se pudo cargar la ficha" onClose={reload}>
          {error ?? 'Sin datos disponibles.'}
        </Alert>
      </>
    );
  }

  const { user, player, inscriptions, uniformIssues, sanctions, stats, summary, ai } = data;
  const age = ageFrom(player.birthDate);
  const opponents = new Map((matches.data ?? []).map((match) => [match.id, match.opponent]));
  const label = (matchId: number) => opponents.get(matchId) ?? `#${matchId}`;
  const ordered = [...stats].sort((a, b) => a.matchId - b.matchId);
  const current = inscriptions[0] ?? null;

  return (
    <>
      <PageHeader
        title={user.fullName}
        subtitle={`${user.email} · ${user.phone ?? 'sin teléfono'}`}
        actions={
          <><div>{user.active&&user.role==='player'?<PlayerRecoveryDialog userId={user.id} name={user.fullName}/>:null}</div>
          <Link to="/admin/jugadores" className="btn btn-outline btn-sm">
            <Icon name="arrowLeft" size={14} />
            Volver al plantel
          </Link>
          </>
        }
      />

      {/* Ficha */}
      <Card className="mb-4">
        <CardBody>
          <div className="flex flex-wrap items-start gap-4">
            <Avatar name={user.fullName} src={user.avatarUrl} size="lg" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-primary badge-lg font-bold">{player.shirtNumber ?? '—'}</span>
                <PositionBadge position={player.position} size="md" showTitle />
                {player.secondaryPosition ? (
                  <PositionBadge position={player.secondaryPosition} size="sm" />
                ) : null}
                <Badge tone={user.active ? 'success' : 'neutral'} size="sm">
                  {user.active ? 'Activo' : 'Baja'}
                </Badge>
                <Badge tone="neutral" size="sm" className="capitalize">
                  {user.role === 'admin' ? 'Administrador' : 'Jugador'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {[
                  { label: 'Edad', value: age !== null ? `${age} años` : '—' },
                  { label: 'DNI', value: player.dni ?? '—' },
                  { label: 'Nacimiento', value: formatDate(player.birthDate) },
                  { label: 'Alta', value: formatDate(player.joinedAt) },
                  { label: 'Estatura', value: player.heightCm ? `${player.heightCm} cm` : '—' },
                  { label: 'Peso', value: player.weightKg ? `${player.weightKg} kg` : '—' },
                  {
                    label: 'Pie',
                    value: player.foot ? (player.foot === 'izq' ? 'Izquierdo' : player.foot === 'der' ? 'Derecho' : 'Ambos') : '—',
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-base-200 px-3 py-2 min-w-0">
                    <p className="text-xs text-base-content/60">{item.label}</p>
                    <p className="font-semibold truncate">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full sm:w-64 rounded-xl border border-base-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Inscripción actual</p>
                {current ? <StatusBadge status={current.status} size="xs" /> : null}
              </div>
              {current ? (
                <>
                  <p className="text-xs text-base-content/60 mb-2">
                    {current.season} · {current.concept}
                  </p>
                  <ProgressBar
                    value={current.paid}
                    max={current.amount}
                    tone={current.status === 'pagada' ? 'success' : 'primary'}
                    showPercent
                    label="Pago"
                  />
                  <p className="text-xs text-base-content/60 mt-2">
                    <Money value={current.paid} /> de <Money value={current.amount} />
                  </p>
                </>
              ) : (
                <p className="text-sm text-base-content/50">Sin inscripción cargada.</p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Pestañas */}
      <div role="tablist" className="tabs tabs-boxed w-fit mb-4 bg-base-200 p-1 flex-wrap">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            className={`tab ${tab === item.key ? 'tab-active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'inscripciones' ? (
        inscriptions.length === 0 ? (
          <Alert tone="info">Este jugador no tiene inscripciones registradas.</Alert>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-base-200 bg-base-100">
            <table className="table table-sm">
              <thead className="bg-base-200">
                <tr>
                  <th>Temporada</th>
                  <th>Concepto</th>
                  <th className="text-right">Monto</th>
                  <th className="text-right">Pagado</th>
                  <th>Progreso</th>
                  <th>Vence</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {inscriptions.map((item) => (
                  <tr key={item.id} className="hover">
                    <td>{item.season}</td>
                    <td>{item.concept}</td>
                    <td className="text-right">
                      <Money value={item.amount} />
                    </td>
                    <td className="text-right text-success">
                      <Money value={item.paid} />
                    </td>
                    <td className="w-40">
                      <ProgressBar
                        value={item.paid}
                        max={item.amount}
                        tone={item.status === 'pagada' ? 'success' : 'primary'}
                      />
                    </td>
                    <td className="text-sm">{formatDate(item.dueDate)}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'uniformes' ? <UniformIssueList issues={uniformIssues} showPlayer={false} /> : null}

      {tab === 'salud' ? <Card><CardBody>
        <h2 className="font-semibold text-lg">Salud</h2>
        <HealthForm player={player} endpoint={`/api/players/${player.id}`} onSaved={reload} />
      </CardBody></Card> : null}

      {tab === 'sanciones' ? (
        sanctions.length === 0 ? (
          <Alert tone="success">Sin sanciones registradas. ¡Todo en regla!</Alert>
        ) : (
          <SanctionsTable sanctions={sanctions} />
        )
      ) : null}

      {tab === 'estadisticas' ? (
        <div className="space-y-4">
          <StatCardsRow
            tiles={[
              { label: 'Partidos', value: summary.appearances, icon: 'futbol', tone: 'primary' },
              { label: 'Minutos', value: formatNumber(summary.minutes), icon: 'calendar', tone: 'neutral', hint: formatMinutes(summary.minutes) },
              { label: 'Goles', value: summary.goals, icon: 'trofeo', tone: 'success' },
              { label: 'Asistencias', value: summary.assists, icon: 'arrowRight', tone: 'info' },
              {
                label: 'Calificación',
                value: summary.avgRating.toFixed(1),
                icon: 'chart',
                tone: 'primary',
                hint: `${summary.yellowCards}A · ${summary.redCards}R`,
              },
            ]}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardBody className="gap-2">
                <p className="font-semibold text-sm">Goles y asistencias por partido</p>
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
                <p className="font-semibold text-sm">Evolución de calificación</p>
                <RatingTrendChart
                  points={ordered.map((stat) => ({ label: label(stat.matchId), value: stat.rating }))}
                />
              </CardBody>
            </Card>
          </div>

          {ordered.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-base-200 bg-base-100">
              <table className="table table-sm">
                <thead className="bg-base-200">
                  <tr>
                    <th>Partido</th>
                    <th className="text-center">Min</th>
                    <th className="text-center">G</th>
                    <th className="text-center">A</th>
                    <th className="text-center">Tiros</th>
                    <th className="text-center">Pases</th>
                    <th className="text-center">Tck</th>
                    <th className="text-center">Tarjetas</th>
                    <th className="text-center">Calificación</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((stat) => (
                    <tr key={stat.id ?? `${stat.matchId}-${stat.playerId}`} className="hover">
                      <td className="font-medium">{label(stat.matchId)}</td>
                      <td className="text-center tabular-nums">{stat.minutes}</td>
                      <td className="text-center font-semibold tabular-nums">{stat.goals}</td>
                      <td className="text-center font-semibold tabular-nums">{stat.assists}</td>
                      <td className="text-center tabular-nums">
                        {stat.shots} ({stat.shotsOnTarget})
                      </td>
                      <td className="text-center tabular-nums">
                        {stat.passesCompleted}/{stat.passes}
                      </td>
                      <td className="text-center tabular-nums">{stat.tackles}</td>
                      <td className="text-center">
                        <span className="text-warning font-bold">{stat.yellowCards}A</span>{' '}
                        <span className="text-error font-bold">{stat.redCards}R</span>
                      </td>
                      <td className="text-center">
                        <RatingBadge value={stat.rating} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Alert tone="info">Todavía no hay estadísticas cargadas para este jugador.</Alert>
          )}
        </div>
      ) : null}

      {tab === 'ia' ? <AiPlayerCard insight={ai} /> : null}
    </>
  );
}
