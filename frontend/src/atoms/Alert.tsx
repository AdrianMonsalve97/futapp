import type { ReactNode } from 'react';

export type AlertTone = 'info' | 'success' | 'warning' | 'error' | 'neutral';

const TONE_CLASS: Record<AlertTone, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
  neutral: 'alert-neutral',
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  /** Muestra botón de cierre si se pasa. */
  onClose?: () => void;
  className?: string;
}

/** Alerta DaisyUI (errores, vacíos informativos, avisos de negocio). */
export function Alert({ tone = 'info', title, children, onClose, className = '' }: AlertProps) {
  return (
    <div className={`alert ${TONE_CLASS[tone]} ${className}`.trim()} role="alert">
      <div className="flex-1 text-sm">
        {title ? <h3 className="font-bold">{title}</h3> : null}
        {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
      </div>
      {onClose ? (
        <button type="button" className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Cerrar aviso">
          ✕
        </button>
      ) : null}
    </div>
  );
}
