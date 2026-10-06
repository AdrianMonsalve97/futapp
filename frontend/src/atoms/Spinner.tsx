export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Texto accesible (se muestra centrado si se pasa). */
  label?: string;
  className?: string;
}

const SIZE_CLASS: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'loading-xs',
  sm: 'loading-sm',
  md: 'loading-md',
  lg: 'loading-lg',
};

/** Indicador de carga DaisyUI. */
export function Spinner({ size = 'md', label = 'Cargando…', className = '' }: SpinnerProps) {
  return (
    <span
      className={`loading loading-spinner ${SIZE_CLASS[size]} ${className}`.trim()}
      role="status"
      aria-label={label}
    />
  );
}
