import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type StatTone = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

const VALUE_TONE_CLASS: Record<StatTone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-info',
  neutral: 'text-base-content',
};

const ICON_TONE_CLASS: Record<StatTone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning-content',
  error: 'bg-error/10 text-error',
  info: 'bg-info/10 text-info',
  neutral: 'bg-base-200 text-base-content',
};

export interface StatTileProps {
  label: string;
  value: ReactNode;
  icon?: IconName;
  hint?: ReactNode;
  tone?: StatTone;
  className?: string;
}

/** Tarjeta de indicador (`stat` de DaisyUI) usada en dashboards y resúmenes. */
export function StatTile({ label, value, icon, hint, tone = 'primary', className = '' }: StatTileProps) {
  return (
    <div className={`card stat-tile bg-base-100 shadow-sm border border-base-200 ${className}`.trim()}>
      <div className="card-body p-5 gap-3">
        <div className="flex justify-between items-start gap-3">
          <p className="text-xs uppercase tracking-wide text-base-content/60">{label}</p>
        {icon ? (
          <div className={`w-8 h-8 shrink-0 rounded-lg grid place-items-center ${ICON_TONE_CLASS[tone]}`}>
            <Icon name={icon} size={17} />
          </div>
        ) : null}
        </div>
        <p className={`stat-tile-value font-bold leading-tight ${VALUE_TONE_CLASS[tone]}`}>{value}</p>
        {hint ? <p className="text-xs text-base-content/60">{hint}</p> : null}
      </div>
    </div>
  );
}
