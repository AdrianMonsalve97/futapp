import { Icon, type IconName } from '../atoms/Icon';
import { formatMoney, humanize } from '../utils/format';
import type { SanctionType } from '../types/api';

interface SanctionStyle {
  icon: IconName;
  label: string;
  className: string;
}

const STYLES: Record<SanctionType, SanctionStyle> = {
  tarjeta_amarilla: { icon: 'tarjeta', label: 'Tarjeta amarilla', className: 'bg-warning text-warning-content' },
  tarjeta_roja: { icon: 'tarjeta', label: 'Tarjeta roja', className: 'bg-error text-error-content' },
  suspension: { icon: 'whistle', label: 'Suspensión', className: 'bg-secondary text-secondary-content' },
  multa: { icon: 'dinero', label: 'Multa', className: 'bg-info text-info-content' },
  amonestacion: { icon: 'alert', label: 'Amonestación', className: 'bg-primary text-primary-content' },
};

export interface SanctionChipProps {
  type: SanctionType;
  /** Si tiene monto, se muestra junto al tipo. */
  amount?: number;
  className?: string;
}

/** Chip compacto de sanción (tipo + monto opcional) con color por tipo. */
export function SanctionChip({ type, amount, className = '' }: SanctionChipProps) {
  const style = STYLES[type] ?? { icon: 'alert' as IconName, label: humanize(type), className: 'bg-base-300' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-btn px-2 py-1 text-xs font-medium ${style.className} ${className}`.trim()}
    >
      <Icon name={style.icon} size={14} />
      {style.label}
      {amount && amount > 0 ? <span className="font-semibold">{formatMoney(amount)}</span> : null}
    </span>
  );
}
