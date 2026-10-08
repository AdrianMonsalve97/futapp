import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** `bg-base-100` por defecto; usar `bg-base-200` para bloques secundarios. */
  tone?: 'base' | 'bordered' | 'ghost';
}

export function Card({ tone = 'base', className = '', children, ...rest }: CardProps) {
  const toneClass = tone === 'base' ? 'bg-base-100 shadow-sm' : tone === 'bordered' ? 'border border-base-300' : '';
  return (
    <div className={`card club-card min-w-0 ${toneClass} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function CardBody({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card-body ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <h2 className={`card-title ${className}`.trim()} {...rest}>
      {children}
    </h2>
  );
}
