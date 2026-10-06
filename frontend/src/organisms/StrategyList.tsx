import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { EmptyState } from '../atoms/EmptyState';
import { Icon } from '../atoms/Icon';
import { ConfirmAction } from '../molecules/ConfirmAction';
import { humanize } from '../utils/format';
import type { Strategy, StrategyKind } from '../types/api';

const KIND_TONE: Record<StrategyKind, 'primary' | 'error' | 'info' | 'warning' | 'accent'> = {
  general: 'primary',
  ataque: 'error',
  defensa: 'info',
  pelota_parada: 'warning',
  transicion: 'accent',
};

export interface StrategyListProps {
  strategies: Strategy[];
  /** Acciones de edición/borrado (solo admin). */
  onEdit?: (strategy: Strategy) => void;
  onDelete?: (strategy: Strategy) => void;
  emptyTitle?: string;
  emptyMessage?: string;
}

/** Cronología (`timeline` de DaisyUI) de estrategias del partido. */
export function StrategyList({
  strategies,
  onEdit,
  onDelete,
  emptyTitle = 'Sin estrategias',
  emptyMessage = 'Todavía no se cargaron planes tácticos para este partido.',
}: StrategyListProps) {
  if (strategies.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} icon="clipboard" />;
  }

  return (
    <ol className="timeline timeline-vertical timeline-snap-icon">
      {strategies.map((strategy, index) => {
        const isLast = index === strategies.length - 1;
        return (
          <li key={strategy.id}>
            <div className="timeline-start w-24 sm:w-32 text-right">
              <p className="text-[11px] uppercase text-base-content/50">
                {new Date(strategy.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
              </p>
            </div>
            <div className="timeline-middle">
              <span className="w-3 h-3 rounded-full bg-primary block" />
            </div>
            <div className="timeline-end timeline-box bg-base-100 border border-base-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={KIND_TONE[strategy.kind] ?? 'primary'} size="xs">
                      {humanize(strategy.kind)}
                    </Badge>
                    <p className="font-semibold text-sm">{strategy.title}</p>
                  </div>
                  <p className="text-sm text-base-content/70 whitespace-pre-wrap mt-1">{strategy.content}</p>
                </div>
                {onEdit || onDelete ? (
                  <div className="flex items-center gap-1 shrink-0">
                    {onEdit ? (
                      <Button size="xs" variant="ghost" aria-label="Editar estrategia" onClick={() => onEdit(strategy)}>
                        <Icon name="edit" size={14} />
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <ConfirmAction
                        title="Eliminar estrategia"
                        message={`Se eliminará "${strategy.title}". ¿Continuar?`}
                        confirmLabel="Eliminar"
                        size="xs"
                        variant="ghost"
                        onConfirm={() => onDelete(strategy)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <hr className={isLast ? 'hidden' : ''} />
          </li>
        );
      })}
    </ol>
  );
}
