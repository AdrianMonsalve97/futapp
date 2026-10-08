import { MediaImage } from '../atoms/MediaImage';
import { Alert } from '../atoms/Alert';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { EmptyState } from '../atoms/EmptyState';
import { Icon, type IconName } from '../atoms/Icon';
import { Spinner } from '../atoms/Spinner';
import { ConfirmAction } from '../molecules/ConfirmAction';
import { Money } from '../molecules/Money';
import { humanize } from '../utils/format';
import type { Uniform, UniformKind } from '../types/api';

const KIND_ICON: Record<UniformKind, IconName> = {
  camiseta: 'camiseta',
  pantalon: 'camiseta',
  medias: 'camiseta',
  buzo: 'camiseta',
  entrenamiento: 'usuarios',
  guantes: 'futbol',
};

const VARIANT_TONE: Record<Uniform['variant'], 'primary' | 'accent' | 'info'> = {
  titular: 'primary',
  alterna: 'accent',
  entrenamiento: 'info',
};

export interface UniformCatalogProps {
  uniforms: Uniform[];
  /** `admin` muestra acciones de editar/borrar; `player` muestra stock y botón de acción. */
  mode?: 'admin' | 'player';
  onCreate?: () => void;
  onEdit?: (uniform: Uniform) => void;
  onDelete?: (uniform: Uniform) => void;
  /** En modo jugador: acción por prenda (p.ej. "Solicitar"). */
  onSelect?: (uniform: Uniform) => void;
  selectLabel?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  error?: string | null;
}

/** Catálogo de uniformes en tarjetas, con alerta de stock bajo. */
export function UniformCatalog({
  uniforms,
  mode = 'admin',
  onCreate,
  onEdit,
  onDelete,
  onSelect,
  selectLabel = 'Solicitar',
  emptyTitle = 'Catálogo vacío',
  emptyMessage = 'Todavía no hay prendas cargadas.',
  isLoading = false,
  error = null,
}: UniformCatalogProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error) return <Alert tone="error">No se pudo cargar el catálogo: {error}</Alert>;
  if (uniforms.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        icon="camiseta"
        action={mode === 'admin' && onCreate ? <Button onClick={onCreate}>Agregar prenda</Button> : undefined}
      />
    );
  }

  const lowStock = uniforms.filter((item) => item.stock <= item.minStock);

  return (
    <div className="space-y-3">
      {mode === 'admin' && lowStock.length > 0 ? (
        <Alert tone="warning" title="Stock bajo">
          {lowStock.map((item) => item.name).join(', ')} — repuesto pronto.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {uniforms.map((item) => {
          const low = item.stock <= item.minStock;
          return (
            <div key={item.id} className="card bg-base-100 border border-base-200 shadow-sm">
              <MediaImage src={item.imageUrl} alt={`Referencia de ${item.name}`} className="uniform-reference h-48 w-full object-contain rounded-t-xl bg-base-200" />
              <div className="card-body p-4 gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-base-200 grid place-items-center shrink-0">
                      <Icon name={KIND_ICON[item.kind] ?? 'camiseta'} size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-base-content/50">
                        {humanize(item.kind)} · {humanize(item.variant)}
                      </p>
                    </div>
                  </div>
                  <Badge tone={VARIANT_TONE[item.variant] ?? 'neutral'} size="xs">
                    {humanize(item.variant)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">
                    <Money value={item.price} />
                  </span>
                  <span className={low ? 'text-error font-semibold' : 'text-base-content/60'}>
                    Stock: {item.stock}
                    {low ? ' (bajo)' : ''}
                  </span>
                </div>

                {item.issuedCount !== undefined ? (
                  <p className="text-xs text-base-content/50">{item.issuedCount} entregas registradas</p>
                ) : null}

                <div className="card-actions justify-end pt-1">
                  {mode === 'admin' ? (
                    <>
                      {onEdit ? (
                        <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                          <Icon name="edit" size={14} />
                          Editar
                        </Button>
                      ) : null}
                      {onDelete ? (
                        <ConfirmAction
                          title="Eliminar prenda"
                          message={`Se dará de baja "${item.name}" del catálogo (baja lógica). ¿Continuar?`}
                          confirmLabel="Eliminar"
                          size="xs"
                          variant="ghost"
                          onConfirm={() => onDelete(item)}
                        />
                      ) : null}
                    </>
                  ) : onSelect ? (
                    <Button size="sm" variant="outline" onClick={() => onSelect(item)} disabled={!item.active}>
                      {selectLabel}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
