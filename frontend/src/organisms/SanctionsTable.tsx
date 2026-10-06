import { Alert } from '../atoms/Alert';
import { Button } from '../atoms/Button';
import { EmptyState } from '../atoms/EmptyState';
import { Icon } from '../atoms/Icon';
import { Select } from '../atoms/Select';
import { Spinner } from '../atoms/Spinner';
import { Money } from '../molecules/Money';
import { SanctionChip } from '../molecules/SanctionChip';
import { StatusBadge } from '../molecules/StatusBadge';
import { DateLabel } from '../molecules/DateLabel';
import { ConfirmAction } from '../molecules/ConfirmAction';
import type { Sanction, SanctionStatus } from '../types/api';

export interface SanctionsTableProps {
  sanctions: Sanction[];
  onEdit?: (sanction: Sanction) => void;
  onDelete?: (sanction: Sanction) => void;
  onStatusChange?: (sanction: Sanction, status: SanctionStatus) => void;
  isLoading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyMessage?: string;
}

/** Tabla de sanciones con filtros externos, cambio de estado y acciones. */
export function SanctionsTable({
  sanctions,
  onEdit,
  onDelete,
  onStatusChange,
  isLoading = false,
  error = null,
  emptyTitle = 'Sin sanciones',
  emptyMessage = 'No hay sanciones registradas con los filtros aplicados.',
}: SanctionsTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) return <Alert tone="error">No se pudieron cargar las sanciones: {error}</Alert>;
  if (sanctions.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} icon="tarjeta" />;
  }

  return (
    <div className="overflow-x-auto scroll-slim rounded-xl border border-base-200 bg-base-100">
      <table className="table table-sm">
        <thead className="bg-base-200">
          <tr>
            <th>Jugador</th>
            <th>Tipo</th>
            <th>Motivo</th>
            <th>Fecha / partido</th>
            <th className="text-right">Monto</th>
            <th className="text-center">Puntos</th>
            <th>Estado</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sanctions.map((sanction) => (
            <tr key={sanction.id} className="hover">
              <td className="font-medium whitespace-nowrap">
                {sanction.playerName ?? `Jugador #${sanction.playerId}`}
              </td>
              <td>
                <SanctionChip type={sanction.type} />
              </td>
              <td className="text-sm text-base-content/70 max-w-64">
                <span className="line-clamp-2">{sanction.reason}</span>
              </td>
              <td className="whitespace-nowrap text-sm">
                <DateLabel value={sanction.matchDate ?? sanction.createdAt} />
                {sanction.matchId ? <span className="text-xs text-base-content/40"> · partido</span> : null}
              </td>
              <td className="text-right">
                {sanction.amount > 0 ? <Money value={sanction.amount} /> : <span className="text-base-content/40">—</span>}
              </td>
              <td className="text-center tabular-nums">{sanction.points}</td>
              <td>
                {onStatusChange ? (
                  <Select
                    className="select-xs max-w-32"
                    value={sanction.status}
                    onChange={(event) => onStatusChange(sanction, event.target.value as SanctionStatus)}
                    aria-label={`Estado de la sanción de ${sanction.playerName ?? 'jugador'}`}
                  >
                    <option value="activa">Activa</option>
                    <option value="cumplida">Cumplida</option>
                    <option value="anulada">Anulada</option>
                  </Select>
                ) : (
                  <StatusBadge status={sanction.status} />
                )}
              </td>
              <td>
                <div className="flex items-center justify-end gap-1">
                  {onEdit ? (
                    <Button size="xs" variant="ghost" title="Editar sanción" onClick={() => onEdit(sanction)}>
                      <Icon name="edit" size={15} />
                    </Button>
                  ) : null}
                  {onDelete ? (
                    <ConfirmAction
                      title="Eliminar sanción"
                      message={`Se eliminará la sanción de ${sanction.playerName ?? 'este jugador'}. ¿Continuar?`}
                      confirmLabel="Eliminar"
                      size="xs"
                      variant="ghost"
                      onConfirm={() => onDelete(sanction)}
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
