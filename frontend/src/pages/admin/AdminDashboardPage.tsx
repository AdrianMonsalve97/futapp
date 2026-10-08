import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { api, errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { StatusBadge } from '../../molecules/StatusBadge';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { EmptyState } from '../../atoms/EmptyState';
import { Icon } from '../../atoms/Icon';
import { Spinner } from '../../atoms/Spinner';
import { StatCardsRow } from '../../organisms/StatCardsRow';
import { PaymentModal } from '../../organisms/PaymentModal';
import { MatchDayHero } from '../../organisms/MatchDayHero';
import { ClubPulse } from '../../organisms/ClubPulse';
import { Money } from '../../molecules/Money';
import { RatingBadge } from '../../molecules/RatingBadge';
import { SanctionChip } from '../../molecules/SanctionChip';
import { DateLabel } from '../../molecules/DateLabel';
import { formatMoney, pendingAmount } from '../../utils/format';
import type { DashboardAdmin, Inscription } from '../../types/api';

/** Dashboard admin (SPEC §10.4): indicadores, próximo partido, cobros y alertas. */
export function AdminDashboardPage() {
  const { data, loading, error, reload } = useFetch<DashboardAdmin>('/api/dashboard/admin');
  const [payFor, setPayFor] = useState<Inscription | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const openPayment = async (playerId: number, playerName: string) => {
    setActionError(null);
    try {
      const list = await api<Inscription[]>(`/api/inscriptions?playerId=${playerId}`);
      const open = list.find((item) => item.status !== 'pagada') ?? list[0];
      if (open) {
        setPayFor(open);
      } else {
        setActionError(`${playerName} no tiene una inscripción cargada.`);
      }
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

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
        <PageHeader title="Centro de juego" subtitle="Panel de administración del club" />
        <Alert tone="error" title="No se pudo cargar el panel" onClose={reload}>
          {error}
        </Alert>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Centro de juego" subtitle="Panel de administración del club" />
        <EmptyState title="Sin datos" message="No hay información disponible." />
      </>
    );
  }

  const { inscriptions, nextMatch, recentSanctions, lowStockUniforms, teamStats, pendingInscriptionPlayers } =
    data;

  return (
    <>
      <PageHeader
        title="Centro de juego"
        subtitle={`Temporada ${inscriptions.season} · vista general del club`}
        actions={
          <Link to="/admin/partidos" className="btn btn-outline btn-sm">
            <Icon name="futbol" size={16} />
            Ver partidos
          </Link>
        }
      />

      {actionError ? (
        <Alert tone="error" className="mb-4" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      <MatchDayHero match={nextMatch} />

      <StatCardsRow
        columns={5}
        tiles={[
          {
            label: 'Jugadores activos',
            value: `${data.activePlayers}/${data.playersCount}`,
            icon: 'usuarios',
            tone: 'primary',
            hint: `${data.playersCount - data.activePlayers} en baja`,
          },
          {
            label: 'Cobrado',
            value: <Money value={inscriptions.collected} />,
            icon: 'dinero',
            tone: 'success',
            hint: `${inscriptions.paidCount} inscripciones saldadas`,
          },
          {
            label: 'Por cobrar',
            value: <Money value={inscriptions.pending} />,
            icon: 'dinero',
            tone: 'warning',
            hint: `${inscriptions.pendingCount} inscripciones abiertas`,
          },
          {
            label: 'Solicitudes de uniforme',
            value: data.pendingUniformRequests,
            icon: 'camiseta',
            tone: data.pendingUniformRequests > 0 ? 'info' : 'neutral',
            hint: 'Pendientes de revisión',
          },
          {
            label: 'Stock bajo',
            value: lowStockUniforms.length,
            icon: 'alert',
            tone: lowStockUniforms.length > 0 ? 'error' : 'success',
            hint: 'Prendas por reponer',
          },
        ]}
      />

      <div className="grid gap-4 mt-4 lg:grid-cols-3">
        <ClubPulse total={inscriptions.total} collected={inscriptions.collected} paidCount={inscriptions.paidCount} pendingCount={inscriptions.pendingCount} />

        {/* Inscripciones pendientes */}
        <Card className="lg:col-span-2">
          <CardBody className="gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Inscripciones pendientes</CardTitle>
              <Link to="/admin/inscripciones" className="link link-primary text-sm">
                Ver todas
              </Link>
            </div>
            {pendingInscriptionPlayers.length === 0 ? (
              <EmptyState title="Todo cobrado" message="No hay inscripciones con saldo pendiente." icon="dinero" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-base-200">
                <table className="table table-sm">
                  <thead className="bg-base-200">
                    <tr>
                      <th>Jugador</th>
                      <th className="text-right">Monto</th>
                      <th className="text-right">Pagado</th>
                      <th className="text-right">Pendiente</th>
                      <th>Vence</th>
                      <th className="text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInscriptionPlayers.map((item) => (
                      <tr key={item.playerId} className="hover">
                        <td className="font-medium">{item.playerName}</td>
                        <td className="text-right">
                          <Money value={item.amount} />
                        </td>
                        <td className="text-right text-success">
                          <Money value={item.paid} />
                        </td>
                        <td className="text-right font-semibold text-warning">
                          <Money value={pendingAmount(item.amount, item.paid)} />
                        </td>
                        <td className="whitespace-nowrap text-sm">
                          <DateLabel value={item.dueDate} />
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            onClick={() => void openPayment(item.playerId, item.playerName)}
                          >
                            <Icon name="dinero" size={13} />
                            Cobrar
                          </button>
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

      <div className="grid gap-4 mt-4 lg:grid-cols-3">
        {/* Sanciones recientes */}
        <Card>
          <CardBody className="gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sanciones recientes</CardTitle>
              <Link to="/admin/sanciones" className="link link-primary text-sm">
                Ver todas
              </Link>
            </div>
            {recentSanctions.length === 0 ? (
              <EmptyState title="Sin sanciones" message="Nadie tiene sanciones registradas." icon="tarjeta" />
            ) : (
              <ul className="space-y-2">
                {recentSanctions.map((sanction) => (
                  <li key={sanction.id} className="rounded-lg border border-base-200 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{sanction.playerName ?? `#${sanction.playerId}`}</span>
                      <StatusBadge status={sanction.status} size="xs" />
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <SanctionChip type={sanction.type} />
                      <span className="text-xs text-base-content/50 truncate">{sanction.reason}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Stock bajo */}
        <Card>
          <CardBody className="gap-3">
            <CardTitle className="text-base">Uniformes con stock bajo</CardTitle>
            {lowStockUniforms.length === 0 ? (
              <EmptyState title="Stock saludable" message="Ninguna prenda está por debajo del mínimo." icon="camiseta" />
            ) : (
              <ul className="space-y-2 text-sm">
                {lowStockUniforms.map((uniform) => (
                  <li key={uniform.id} className="flex items-center justify-between gap-2 rounded-lg bg-base-200 px-3 py-2">
                    <span className="font-medium truncate">{uniform.name}</span>
                    <span className="badge badge-error badge-sm">
                      {uniform.stock}/{uniform.minStock}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Mejor valorados */}
        <Card>
          <CardBody className="gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Mejor valorados</CardTitle>
              <Link to="/admin/estadisticas" className="link link-primary text-sm">
                Estadísticas
              </Link>
            </div>
            {teamStats.topRated.length === 0 ? (
              <EmptyState title="Sin datos" message="Faltan partidos con estadísticas." icon="chart" />
            ) : (
              <ul className="space-y-2">
                {teamStats.topRated.slice(0, 5).map((item, index) => (
                  <li key={item.playerId} className="flex items-center gap-3">
                    <span className="w-5 text-sm font-bold text-base-content/40">{index + 1}</span>
                    <span className="badge badge-neutral badge-sm font-bold">{item.shirtNumber ?? '—'}</span>
                    <span className="flex-1 truncate text-sm font-medium">{item.playerName}</span>
                    <RatingBadge value={item.value} />
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-lg bg-base-200 px-3 py-2 text-sm">
              <p className="text-xs text-base-content/60">Cobro total de la temporada</p>
              <p className="font-bold">{formatMoney(inscriptions.collected)}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <PaymentModal
        inscription={payFor}
        onClose={() => setPayFor(null)}
        onSaved={() => {
          setPayFor(null);
          reload();
        }}
      />
    </>
  );
}
