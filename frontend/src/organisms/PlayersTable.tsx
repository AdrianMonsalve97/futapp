import { Link } from 'react-router-dom';
import { Alert } from '../atoms/Alert';
import { Avatar } from '../atoms/Avatar';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { EmptyState } from '../atoms/EmptyState';
import { Icon } from '../atoms/Icon';
import { Spinner } from '../atoms/Spinner';
import { PositionBadge } from '../molecules/PositionBadge';
import { RatingBadge } from '../molecules/RatingBadge';
import { StatusBadge } from '../molecules/StatusBadge';
import { ConfirmAction } from '../molecules/ConfirmAction';
import { ProgressBar } from '../atoms/ProgressBar';
import { ageFrom, formatMoney } from '../utils/format';
import type { PlayerListItem } from '../types/api';

export interface PlayersTableProps {
  players: PlayerListItem[];
  /** Base de rutas para el detalle (por defecto `/admin/jugadores`). */
  detailBase?: string;
  onEdit?: (item: PlayerListItem) => void;
  onToggleActive?: (item: PlayerListItem) => void;
  isLoading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyMessage?: string;
}

/** Tabla del plantel: dorsal, posición, edad, inscripción, calificación y sanciones. */
export function PlayersTable({
  players,
  detailBase = '/admin/jugadores',
  onEdit,
  onToggleActive,
  isLoading = false,
  error = null,
  emptyTitle = 'Sin jugadores',
  emptyMessage = 'Todavía no hay integrantes en el plantel.',
}: PlayersTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) return <Alert tone="error">No se pudo cargar el plantel: {error}</Alert>;
  if (players.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} icon="usuarios" />;
  }

  return (
    <div className="overflow-x-auto scroll-slim rounded-xl border border-base-200 bg-base-100">
      <table className="table table-sm">
        <thead className="bg-base-200">
          <tr>
            <th className="text-center">Nº</th>
            <th>Jugador</th>
            <th>Posición</th>
            <th className="text-center">Edad</th>
            <th>Inscripción</th>
            <th className="text-center">Calificación</th>
            <th className="text-center">Sanciones</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {players.map((item) => {
            const age = ageFrom(item.player.birthDate);
            const inscription = item.inscription;
            const pending = inscription ? Math.max(0, inscription.amount - inscription.paid) : 0;
            return (
              <tr key={item.player.id} className="hover">
                <td className="text-center">
                  <span className="inline-block min-w-7 font-bold tabular-nums bg-base-200 rounded-btn px-1.5 py-0.5 text-sm">
                    {item.player.shirtNumber ?? '—'}
                  </span>
                </td>
                <td>
                  <Link to={`${detailBase}/${item.player.id}`} className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={item.user.fullName} src={item.user.avatarUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-medium leading-tight truncate">{item.user.fullName}</span>
                      <span className="block text-xs text-base-content/50 truncate">{item.user.email}</span>
                    </span>
                    {item.user.active ? null : <Badge tone="neutral" size="xs">Baja</Badge>}
                  </Link>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <PositionBadge position={item.player.position} size="xs" />
                    {item.player.secondaryPosition ? (
                      <PositionBadge position={item.player.secondaryPosition} size="xs" />
                    ) : null}
                  </div>
                </td>
                <td className="text-center tabular-nums">{age ?? '—'}</td>
                <td>
                  {inscription ? (
                    <div className="min-w-36">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={inscription.status} size="xs" />
                        <span className="text-xs text-base-content/50">{inscription.season}</span>
                      </div>
                      <ProgressBar
                        value={inscription.paid}
                        max={inscription.amount}
                        tone={inscription.status === 'pagada' ? 'success' : 'primary'}
                      />
                      {pending > 0 ? (
                        <span className="text-[11px] text-base-content/50">
                          Falta {formatMoney(pending)}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-base-content/40">Sin inscripción</span>
                  )}
                </td>
                <td className="text-center">
                  <RatingBadge value={item.stats.avgRating} />
                </td>
                <td className="text-center">
                  {item.activeSanctions > 0 ? (
                    <Badge tone="error" size="sm">{item.activeSanctions}</Badge>
                  ) : (
                    <span className="text-xs text-base-content/40">0</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      to={`${detailBase}/${item.player.id}`}
                      className="btn btn-ghost btn-xs"
                      title="Ver ficha"
                    >
                      <Icon name="eye" size={15} />
                    </Link>
                    {onEdit ? (
                      <Button size="xs" variant="ghost" title="Editar" onClick={() => onEdit(item)}>
                        <Icon name="edit" size={15} />
                      </Button>
                    ) : null}
                    {onToggleActive ? (
                      <ConfirmAction
                        title={item.user.active ? 'Dar de baja' : 'Reactivar jugador'}
                        message={
                          item.user.active
                            ? `${item.user.fullName} pasará a inactivo: no podrá acceder ni ser convocado. ¿Continuar?`
                            : `${item.user.fullName} volverá a estar activo en el plantel. ¿Continuar?`
                        }
                        confirmLabel={item.user.active ? 'Dar de baja' : 'Reactivar'}
                        variant={item.user.active ? 'danger' : 'primary'}
                        size="xs"
                        onConfirm={() => onToggleActive(item)}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
