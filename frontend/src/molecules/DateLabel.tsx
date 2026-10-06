import { formatDate, formatDateTime } from '../utils/format';

export interface DateLabelProps {
  value: string | null | undefined;
  /** Incluye la hora (`11 de octubre de 2026 · 15:00`). */
  withTime?: boolean;
  fallback?: string;
  className?: string;
}

/** Fecha en español con fallback configurable. */
export function DateLabel({ value, withTime = false, fallback = '—', className = '' }: DateLabelProps) {
  const text = !value ? fallback : withTime ? formatDateTime(value) : formatDate(value);
  return <span className={className}>{text}</span>;
}
