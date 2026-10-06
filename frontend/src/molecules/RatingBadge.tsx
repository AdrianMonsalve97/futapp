import { formatRating } from '../utils/format';

export interface RatingBadgeProps {
  value: number | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  /** Muestra el valor con 2 decimales (para predicciones del modelo). */
  decimals?: number;
}

/** Calificación 1–10 con color por rango: ≥8 verde, ≥7 celeste, ≥6 ámbar, resto rojo. */
export function RatingBadge({ value, size = 'sm', decimals = 1 }: RatingBadgeProps) {
  const tone =
    value === null || value === undefined || Number.isNaN(value)
      ? 'badge-ghost text-base-content/60'
      : value >= 8
        ? 'badge-success text-success-content'
        : value >= 7
          ? 'badge-info text-info-content'
          : value >= 6
            ? 'badge-warning text-warning-content'
            : 'badge-error text-error-content';

  const sizeClass = size === 'lg' ? 'badge-lg' : size === 'md' ? 'badge-md' : 'badge-sm';

  return (
    <span className={`badge ${tone} ${sizeClass} font-bold tabular-nums min-w-[2.75rem] justify-center`}>
      {formatRating(value, decimals)}
    </span>
  );
}
