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
      className={`page-header flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-6 ${className}`.trim()}
    >
      <div className="min-w-0 sm:flex-1 sm:basis-64">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-base-content/60 mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions flex max-w-full flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
