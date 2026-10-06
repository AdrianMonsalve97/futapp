import { useState, type ReactNode } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '../atoms/Button';
import { Modal } from '../atoms/Modal';

export interface ConfirmActionProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Botón disparador personalizado; si no se pasa se usa un botón con `label`. */
  label?: string;
  children?: ReactNode;
  onConfirm: () => void | Promise<void>;
  className?: string;
}

/** Acción destructiva con modal de confirmación (DaisyUI `modal`). */
export function ConfirmAction({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  size = 'sm',
  label,
  children,
  onConfirm,
  className = '',
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {children ? (
        <span onClick={() => setOpen(true)} className="contents">
          {children}
        </span>
      ) : (
        <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
          {label ?? confirmLabel}
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button variant={variant} onClick={() => void handleConfirm()} loading={busy}>
              {confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-sm">{message}</p>
      </Modal>
    </>
  );
}
