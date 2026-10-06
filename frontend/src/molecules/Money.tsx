import { formatMoney } from '../utils/format';

export interface MoneyProps {
  value: number | null | undefined;
  /** Resalta en verde/rojo según signo (para cobros y egresos). */
  signed?: boolean;
  className?: string;
}

/** Monto con formato colombiano: `$ 1.200.000`. */
export function Money({ value, signed = false, className = '' }: MoneyProps) {
  const tone =
    !signed || value === null || value === undefined
      ? ''
      : value > 0
        ? 'text-success'
        : value < 0
          ? 'text-error'
          : '';
  return <span className={`tabular-nums ${tone} ${className}`.trim()}>{formatMoney(value)}</span>;
}
