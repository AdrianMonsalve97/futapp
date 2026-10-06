import { Badge, type BadgeTone, type BadgeProps } from '../atoms/Badge';
import { humanize } from '../utils/format';

// Colores consistentes por estado en TODA la app (inscripción, uniforme,
// sanción, partido, usuario).
const TONE_BY_STATUS: Record<string, BadgeTone> = {
  // Inscripciones
  pendiente: 'warning',
  parcial: 'info',
  pagada: 'success',
  // Solicitudes de uniforme
  aprobada: 'info',
  rechazada: 'error',
  entregada: 'success',
  // Sanciones
  activa: 'error',
  cumplida: 'success',
  anulada: 'neutral',
  // Partidos
  programado: 'info',
  jugado: 'success',
  cancelado: 'error',
  pospuesto: 'warning',
  // Usuarios / condiciones
  activo: 'success',
  inactivo: 'neutral',
  nuevo: 'success',
  bueno: 'info',
  regular: 'warning',
  danado: 'error',
};

const LABEL_BY_STATUS: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagada: 'Pagada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  entregada: 'Entregada',
  activa: 'Activa',
  cumplida: 'Cumplida',
  anulada: 'Anulada',
  programado: 'Programado',
  jugado: 'Jugado',
  cancelado: 'Cancelado',
  pospuesto: 'Pospuesto',
  activo: 'Activo',
  inactivo: 'Inactivo',
  nuevo: 'Nuevo',
  bueno: 'Bueno',
  regular: 'Regular',
  danado: 'Dañado',
};

export interface StatusBadgeProps {
  status: string;
  size?: BadgeProps['size'];
}

/** Badge de estado con color y etiqueta en español consistentes. */
export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const tone = TONE_BY_STATUS[key] ?? 'neutral';
  const label = LABEL_BY_STATUS[key] ?? humanize(status);
  return (
    <Badge tone={tone} size={size} className="whitespace-nowrap">
      {label}
    </Badge>
  );
}
