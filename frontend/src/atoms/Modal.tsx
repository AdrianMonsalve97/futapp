import { useEffect, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Cierra al hacer clic fuera del `modal-box` (por defecto sí). */
  closeOnOutside?: boolean;
}

const SIZE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

/** Modal controlado (abierto/cerrado por props) con `modal-box` de DaisyUI. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOutside = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div className={`modal ${open ? 'modal-open' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`modal-box ${SIZE_CLASS[size]}`}
        onClick={(event) => {
          if (closeOnOutside && event.target === event.currentTarget) onClose();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-bold text-lg">{title}</h3>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="py-3">{children}</div>
        {footer ? <div className="modal-action">{footer}</div> : null}
      </div>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
    </div>
  );
}
