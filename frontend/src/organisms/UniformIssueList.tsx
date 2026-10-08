import { Alert } from '../atoms/Alert';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { EmptyState } from '../atoms/EmptyState';
import { Icon } from '../atoms/Icon';
import { Spinner } from '../atoms/Spinner';
import { DateLabel } from '../molecules/DateLabel';
import { StatusBadge } from '../molecules/StatusBadge';
import { Money } from '../molecules/Money';
import { humanize } from '../utils/format';
import { uniformKindLabel, uniformVariantLabel, uniformRecipientLabel } from '../utils/uniforms';
import type { UniformCondition, UniformIssue } from '../types/api';

export interface UniformIssueListProps {
  issues: UniformIssue[];
  /** Muestra columna de jugador (vista admin). */
  showPlayer?: boolean;
  /** Marca la prenda como devuelta → `PUT /api/uniform-issues/:id`. */
  onReturn?: (issue: UniformIssue) => void;
  isLoading?: boolean;
  error?: string | null;
}

const CONDITION_TONE: Record<UniformCondition, 'success' | 'info' | 'warning' | 'error'> = {
  nuevo: 'success',
  bueno: 'info',
  regular: 'warning',
  danado: 'error',
};

/** Lista/tabla de entregas de uniformes con estado de devolución. */
export function UniformIssueList({
  issues,
  showPlayer = false,
  onReturn,
  isLoading = false,
  error = null,
}: UniformIssueListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) return <Alert tone="error">No se pudieron cargar las entregas: {error}</Alert>;
  if (issues.length === 0) {
    return (
      <EmptyState
        title="Sin entregas registradas"
        message="Cuando se entregue una prenda a un jugador aparece acá."
        icon="camiseta"
      />
    );
  }

  return (
    <div className="overflow-x-auto scroll-slim rounded-xl border border-base-200 bg-base-100">
      <table className="table table-sm">
        <thead className="bg-base-200">
          <tr>
            {showPlayer ? <th>Jugador</th> : null}
            <th>Prenda</th>
            <th>Talla</th>
            <th>Destinatario</th>
            <th>Detalle</th>
            <th>Estado</th>
            <th>Condición</th>
            <th className="text-right">Costo</th>
            <th>Entregado</th>
            <th>Devolución</th>
            {onReturn ? <th className="text-right">Acción</th> : null}
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id} className="hover">
              {showPlayer ? <td className="font-medium whitespace-nowrap">{issue.playerName ?? `#${issue.playerId}`}</td> : null}
              <td>
                <p className="font-medium">{issue.uniformName ?? `Uniforme #${issue.uniformId}`}</p>
                {issue.kind ? (
                  <p className="text-xs text-base-content/50">
                    {uniformKindLabel(issue.kind)} · {uniformVariantLabel(issue.variant ?? 'titular')}
                  </p>
                ) : null}
              </td>
              <td>{issue.size}</td>
              <td className="text-sm break-words">{uniformRecipientLabel(issue)}</td>
              <td className="text-sm break-words">{issue.notes ?? '—'}</td>
              <td>
                <StatusBadge status={issue.returned ? 'entregada' : 'pendiente'} size="xs" />
              </td>
              <td>
                <Badge tone={CONDITION_TONE[issue.condition] ?? 'neutral'} size="xs">
                  {humanize(issue.condition)}
                </Badge>
              </td>
              <td className="text-right">
                <Money value={issue.cost} />
              </td>
              <td className="whitespace-nowrap text-sm">
                <DateLabel value={issue.issuedAt} />
              </td>
              <td>
                {issue.returned ? (
                  <span className="inline-flex items-center gap-1 text-success text-sm">
                    <Icon name="check" size={14} />
                    Devuelta
                  </span>
                ) : (
                  <span className="text-base-content/50 text-sm">En uso</span>
                )}
              </td>
              {onReturn ? (
                <td className="text-right">
                  {issue.returned ? (
                    <span className="text-xs text-base-content/40">—</span>
                  ) : (
                    <Button size="xs" variant="outline" onClick={() => onReturn(issue)}>
                      Marcar devuelta
                    </Button>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
