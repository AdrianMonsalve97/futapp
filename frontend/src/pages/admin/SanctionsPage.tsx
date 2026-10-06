import { useMemo, useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import { Select } from '../../atoms/Select';
import { FormField } from '../../molecules/FormField';
import { Money } from '../../molecules/Money';
import { SanctionFormModal } from '../../organisms/SanctionFormModal';
import { SanctionsTable } from '../../organisms/SanctionsTable';
import { StatCardsRow } from '../../organisms/StatCardsRow';
import type { Match, PlayerListItem, Sanction, SanctionStatus, SanctionType } from '../../types/api';

/** Sanciones (SPEC §10.4): filtros, tabla, alta/edición, estados y totales. */
export function SanctionsPage() {
  const [status, setStatus] = useState<'' | SanctionStatus>('');
  const [type, setType] = useState<'' | SanctionType>('');
  const [playerId, setPlayerId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sanction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (playerId) params.set('playerId', playerId);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [status, type, playerId]);

  const sanctions = useFetch<Sanction[]>(`/api/sanctions${query}`);
  const players = useFetch<PlayerListItem[]>('/api/players');
  const matches = useFetch<Match[]>('/api/matches');

  const items = sanctions.data ?? [];
  const totals = items.reduce(
    (acc, item) => ({
      fines: acc.fines + (item.type === 'multa' ? item.amount : 0),
      amount: acc.amount + item.amount,
      active: acc.active + (item.status === 'activa' ? 1 : 0),
      points: acc.points + (item.status === 'activa' ? item.points : 0),
    }),
    { fines: 0, amount: 0, active: 0, points: 0 },
  );

  const run = async (fn: () => Promise<void>) => {
    setActionError(null);
    try {
      await fn();
      sanctions.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Sanciones"
        subtitle="Tarjetas, suspensiones y multas del plantel"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Icon name="plus" size={16} />
            Nueva sanción
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <FormField label="Estado" className="w-44">
          <Select value={status} onChange={(event) => setStatus(event.target.value as '' | SanctionStatus)}>
            <option value="">Todos</option>
            <option value="activa">Activa</option>
            <option value="cumplida">Cumplida</option>
            <option value="anulada">Anulada</option>
          </Select>
        </FormField>
        <FormField label="Tipo" className="w-52">
          <Select value={type} onChange={(event) => setType(event.target.value as '' | SanctionType)}>
            <option value="">Todos</option>
            <option value="tarjeta_amarilla">Tarjeta amarilla</option>
            <option value="tarjeta_roja">Tarjeta roja</option>
            <option value="suspension">Suspensión</option>
            <option value="multa">Multa</option>
            <option value="amonestacion">Amonestación</option>
          </Select>
        </FormField>
        <FormField label="Jugador" className="w-56">
          <Select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
            <option value="">Todos</option>
            {(players.data ?? []).map((item) => (
              <option key={item.player.id} value={item.player.id}>
                {item.user.fullName}
              </option>
            ))}
          </Select>
        </FormField>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatus('');
            setType('');
            setPlayerId('');
          }}
        >
          Limpiar filtros
        </Button>
      </div>

      <StatCardsRow
        tiles={[
          { label: 'Sanciones', value: items.length, icon: 'tarjeta', tone: 'neutral' },
          { label: 'Activas', value: totals.active, icon: 'alert', tone: totals.active > 0 ? 'error' : 'success' },
          { label: 'Total multas', value: <Money value={totals.fines} />, icon: 'dinero', tone: 'warning' },
          { label: 'Puntos en juego', value: totals.points, icon: 'clipboard', tone: 'info' },
        ]}
        className="mb-4"
      />

      {actionError ? (
        <Alert tone="error" className="mb-4" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      ) : null}

      <SanctionsTable
        sanctions={items}
        isLoading={sanctions.loading}
        error={sanctions.error}
        onEdit={(item) => {
          setEditing(item);
          setModalOpen(true);
        }}
        onStatusChange={(item, next) => {
          void run(async () => {
            await api(`/api/sanctions/${item.id}`, { method: 'PUT', json: { status: next } });
          });
        }}
        onDelete={(item) => {
          void run(async () => {
            await api(`/api/sanctions/${item.id}`, { method: 'DELETE' });
          });
        }}
        emptyTitle="Sin sanciones"
        emptyMessage="No hay sanciones con los filtros aplicados o todavía no se registraron."
      />

      <p className="text-xs text-base-content/50 mt-3">
        Total considerado en multas y sanciones visibles: <Money value={totals.amount} />
      </p>

      <SanctionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sanction={editing}
        players={players.data ?? []}
        matches={matches.data ?? []}
        onSaved={() => sanctions.reload()}
      />
    </>
  );
}
