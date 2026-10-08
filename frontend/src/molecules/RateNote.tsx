import { getFormat, rateLabel } from '../data/formations';
import type { TeamFormat } from '../types/api';

export interface RateNoteProps {
  format: TeamFormat;
  minutes?:number;
  className?: string;
}

/**
 * §12.7.9 — etiqueta de normalización de métricas: "por partido" en f5/f7/f8
 * y "por 90'" solo en f11.
 */
export function RateNote({ format, minutes,className = '' }: RateNoteProps) {
  const profile = getFormat(format);
  return (
    <p className={`text-xs text-base-content/50 ${className}`.trim()}>
      Promedios y métricas normalizados{' '}
      <span className="font-semibold text-base-content/70">{minutes?`por ${minutes} minutos de juego`:rateLabel(format)}</span> · {profile.name}
    </p>
  );
}
