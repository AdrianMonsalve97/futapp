import { Badge } from '../atoms/Badge';
import type { Position } from '../types/api';

const TONE: Record<Position, 'warning' | 'info' | 'primary' | 'error'> = {
  POR: 'warning',
  DEF: 'info',
  MED: 'primary',
  DEL: 'error',
};

const LABEL: Record<Position, string> = {
  POR: 'POR',
  DEF: 'DEF',
  MED: 'MED',
  DEL: 'DEL',
};

const TITLE: Record<Position, string> = {
  POR: 'Portero',
  DEF: 'Defensor',
  MED: 'Mediocampista',
  DEL: 'Delantero',
};

export interface PositionBadgeProps {
  position: Position;
  showTitle?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

/** Badge de posición con color propio por línea (POR/DEF/MED/DEL). */
export function PositionBadge({ position, showTitle = false, size = 'sm' }: PositionBadgeProps) {
  return (
    <Badge tone={TONE[position]} size={size} className="font-mono tracking-wide" title={TITLE[position]}>
      {showTitle ? TITLE[position] : LABEL[position]}
    </Badge>
  );
}
