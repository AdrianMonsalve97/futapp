import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
}

/** Estado vacío consistente para tablas y listas sin datos. */
export function EmptyState({ title, message, icon = 'clipboard', action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-4 ${className}`.trim()}>
      <div className="w-14 h-14 rounded-2xl bg-base-200 grid place-items-center text-base-content/50 mb-3">
        <Icon name={icon} size={26} />
      </div>
      <p className="font-semibold text-base-content/80">{title}</p>
      {message ? <p className="text-sm text-base-content/60 mt-1 max-w-md">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
