import type { ReactNode } from 'react';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'accent';

const TONE_CLASS: Record<ProgressTone, string> = {
  primary: 'progress-primary',
  success: 'progress-success',
  warning: 'progress-warning',
  error: 'progress-error',
  info: 'progress-info',
  accent: 'progress-accent',
};

export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: ProgressTone;
  /** Muestra `72%` junto al label. */
  showPercent?: boolean;
  label?: ReactNode;
  className?: string;
}

/** Barra de progreso DaisyUI (`<progress>`). */
export function ProgressBar({
  value,
  max = 100,
  tone = 'primary',
  showPercent = false,
  label,
  className = '',
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.max(0, Math.min(value, safeMax));
  const percent = Math.round((clamped / safeMax) * 100);

  return (
    <div className={className}>
      {label || showPercent ? (
        <div className="flex items-center justify-between text-xs mb-1 text-base-content/70">
          <span>{label}</span>
          {showPercent ? <span className="font-semibold tabular-nums">{percent}%</span> : null}
        </div>
      ) : null}
      <progress
        className={`progress ${TONE_CLASS[tone]} w-full`}
        value={clamped}
        max={safeMax}
        aria-label={typeof label === 'string' ? label : 'Progreso'}
      />
    </div>
  );
}
