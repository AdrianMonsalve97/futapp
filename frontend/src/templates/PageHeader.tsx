import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Acciones alineadas a la derecha (botones). */
  actions?: ReactNode;
  className?: string;
}

/** Cabecera de página: título + subtítulo + acciones a la derecha. */
export function PageHeader({ title, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5 ${className}`.trim()}
    >
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold leading-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-base-content/60 mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
