import { Alert } from '../atoms/Alert';
import { Badge } from '../atoms/Badge';
import { EmptyState } from '../atoms/EmptyState';
import { Spinner } from '../atoms/Spinner';
import { DateLabel } from '../molecules/DateLabel';
import { StatusBadge } from '../molecules/StatusBadge';
import { ConfirmAction } from '../molecules/ConfirmAction';
import type { UniformRequest, UniformRequestStatus } from '../types/api';
import { uniformRecipientLabel } from '../utils/uniforms';

export interface UniformRequestsPanelProps {
  requests: UniformRequest[];
  /** Cambia el estado de la solicitud (`PUT /api/uniform-requests/:id`). */
  onReview: (request: UniformRequest, status: UniformRequestStatus) => void;
  isLoading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyMessage?: string;
}

/** Panel de solicitudes de uniforme con aprobación/rechazo/entrega. */
export function UniformRequestsPanel({
  requests,
  onReview,
  isLoading = false,
  error = null,
  emptyTitle = 'Sin solicitudes',
  emptyMessage = 'No hay solicitudes de uniforme pendientes de revisión.',
}: UniformRequestsPanelProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) return <Alert tone="error">No se pudieron cargar las solicitudes: {error}</Alert>;
  if (requests.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} icon="camiseta" />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {requests.map((request) => (
        <div key={request.id} className="card bg-base-100 border border-base-200 shadow-sm">
          <div className="card-body p-4 gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold truncate">{request.playerName ?? `Jugador #${request.playerId}`}</p>
                <p className="text-sm text-base-content/70 truncate">
                  {request.uniformName ?? `Uniforme #${request.uniformId}`} · Talla {request.size}
                </p>
              </div>
              <StatusBadge status={request.status} />
            </div>

            <p className="text-sm break-words">Destinatario: {uniformRecipientLabel(request)}</p>
            {request.reason ? (
              <p className="text-sm text-base-content/60">
                <span className="font-medium text-base-content/70">Detalle:</span> {request.reason}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/50">
              <span>
                Pedida el <DateLabel value={request.createdAt} />
              </span>
              {request.reviewedAt ? (
                <span>
                  · Revisada el <DateLabel value={request.reviewedAt} />
                </span>
              ) : null}
              {request.reviewNotes ? (
                <Badge tone="neutral" size="xs">
                  {request.reviewNotes}
                </Badge>
              ) : null}
            </div>

            <div className="card-actions justify-end pt-2">
              {request.status === 'pendiente' ? (
                <>
                  <ConfirmAction
                    title="Aprobar solicitud"
                    message={`¿Aprobar la solicitud de ${request.uniformName ?? 'uniforme'} de ${request.playerName ?? 'este jugador'}?`}
                    confirmLabel="Aprobar"
                    variant="primary"
                    onConfirm={() => onReview(request, 'aprobada')}
                  />
                  <ConfirmAction
                    title="Rechazar solicitud"
                    message={`¿Rechazar la solicitud de ${request.playerName ?? 'este jugador'}? No se descontará stock.`}
                    confirmLabel="Rechazar"
                    variant="danger"
                    onConfirm={() => onReview(request, 'rechazada')}
                  />
                </>
              ) : null}
              {request.status === 'aprobada' ? (
                <ConfirmAction
                  title="Entregar uniforme"
                  message="Al entregar se descuenta el stock, se registra la entrega con el precio de la prenda y se marca como revisada. ¿Continuar?"
                  confirmLabel="Marcar entregada"
                  variant="primary"
                  onConfirm={() => onReview(request, 'entregada')}
                />
              ) : null}
              {request.status === 'rechazada' || request.status === 'entregada' ? (
                <span className="text-xs text-base-content/40">Sin acciones disponibles</span>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
