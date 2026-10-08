import { shortName } from '../utils/format';
import { getFormation } from '../data/formations';
import type { LineupSlot, TeamFormat } from '../types/api';

export interface PitchSlot {
  slotIndex: number;
  x: number;
  y: number;
  role: 'POR' | 'DEF' | 'MED' | 'DEL';
  label: string;
  playerId?: number | null;
  playerName?: string | null;
  shirtNumber?: number | null;
  /** Resalta el slot (posición propia en vistas de jugador). */
  highlighted?: boolean;
}

export interface FormationPitchProps {
  slots: PitchSlot[];
  /** `edit` hace clicables los slots (vacíos con borde punteado). */
  variant?: 'view' | 'edit';
  onSlotClick?: (slot: PitchSlot) => void;
  selectedSlotIndex?: number | null;
  /** Índice a resaltar (p.ej. mi posición en el XI). */
  highlightSlotIndex?: number | null;
  /** Mensaje cuando no hay slots cargados. */
  emptyMessage?: string;
  /** §12.7.2 — formato del partido/equipo: define la relación de aspecto del lienzo. */
  format?: TeamFormat;
  className?: string;
}

const ROLE_FILL: Record<'POR' | 'DEF' | 'MED' | 'DEL', string> = {
  POR: '#f59e0b',
  DEF: '#3b82f6',
  MED: '#a855f7',
  DEL: '#ef4444',
};

/** §12.7.2 — relación de aspecto del lienzo según formato. */
const ASPECT_CLASS: Record<TeamFormat, string> = {
  5: 'aspect-[2/1]',
  7: 'aspect-[3/2]',
  8: 'aspect-[7/5]',
  11: 'aspect-[2/3]',
};

/** Altura interna del viewBox: `100 * (alto/ancho)` del aspecto del formato. */
const VIEW_HEIGHT: Record<TeamFormat, number> = {
  5: 50,
  7: 100 * (2 / 3),
  8: 100 * (5 / 7),
  11: 150,
};

const W = 100;

/** Ancho del bloque del pitch según formato (clases literales para Tailwind). */
export function pitchSizeClass(format: TeamFormat): string {
  return format === 11 ? 'max-w-[300px] mx-auto' : 'max-w-[540px] mx-auto';
}

/** Columna izquierda del grid del editor/AI según formato (literales Tailwind). */
export function pitchGridClass(format: TeamFormat): string {
  return format === 11 ? 'lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]' : 'xl:grid-cols-2';
}

/**
 * Slots dibujables a partir del catálogo de la formación, fusionados con la
 * alineación guardada (si existe). Garantiza los slots del formato.
 */
export function pitchSlotsFrom(
  formationKey: string,
  lineup?: LineupSlot[] | null,
  format?: TeamFormat,
): PitchSlot[] {
  const catalog = getFormation(formationKey, format).slots;
  const byIndex = new Map<number, LineupSlot>((lineup ?? []).map((item) => [item.slotIndex, item]));
  return catalog.map((item) => {
    const saved = byIndex.get(item.slotIndex);
    return {
      slotIndex: item.slotIndex,
      x: saved?.x ?? item.x,
      y: saved?.y ?? item.y,
      role: item.role,
      label: item.label,
      playerId: saved?.playerId ?? null,
      playerName: saved?.playerName ?? null,
      shirtNumber: saved?.shirtNumber ?? null,
    };
  });
}

/**
 * Cancha en SVG (SPEC §10.4 + §12.7.2): coordenadas en % de la cancha,
 * `y=0` arco rival (arriba), `y=100` arco propio (abajo). El formato solo
 * cambia la relación de aspecto del contenedor: f5 `2/1`, f7 `3/2`,
 * f8 `7/5` y f11 `2/3`.
 */
export function FormationPitch({
  slots,
  variant = 'view',
  onSlotClick,
  selectedSlotIndex = null,
  highlightSlotIndex = null,
  emptyMessage = 'Sin alineación cargada',
  format = 11,
  className = '',
}: FormationPitchProps) {
  const fmt: TeamFormat = format === 5 || format === 7 || format === 8 ? format : 11;
  const H = VIEW_HEIGHT[fmt];
  const stripes = Array.from({ length: 10 }, (_, index) => index);

  // Geometría proporcional al formato (en f11 conserva los valores de §10.4).
  const boxH = Math.min(17, H * (17 / 150));
  const goalAreaH = boxH * (7 / 17);
  const centerR = Math.min(11, H * (11 / 150));
  const goalH = Math.max(1.6, H * 0.016);
  const goalY = goalH * 0.25;
  const chipR = Math.min(6, H * 0.065);
  const numberFont = chipR * 0.83;
  const labelFont = Math.min(3.4, chipR * 0.57);
  const nameFont = Math.min(3.3, chipR * 0.6);
  const ringR = chipR + 2.6;
  const halfText = nameFont * 3.5;
  const emptyFont = Math.min(4.5, H * 0.06);

  const cyOf = (slot: PitchSlot) => (slot.y / 100) * H;

  /** Nombre del jugador si entra en el lienzo sin pisarse con otro chip. */
  const nameY = (slot: PitchSlot): number | null => {
    const cy = cyOf(slot);
    const collides = (y: number, other: PitchSlot) => {
      const otherCy = cyOf(other);
      const dx = Math.abs(other.x - slot.x);
      if (dx >= chipR + halfText) return false;
      const textTop = y - nameFont;
      const textBottom = y + nameFont * 0.3;
      return textBottom > otherCy - chipR && textTop < otherCy + chipR;
    };
    const others = slots.filter((other) => other.slotIndex !== slot.slotIndex);
    const below = cy + chipR + 1 + nameFont;
    if (below + nameFont * 0.3 <= H && !others.some((other) => collides(below, other))) return below;
    const above = cy - chipR - 1;
    if (above - nameFont >= 0 && !others.some((other) => collides(above, other))) return above;
    return null;
  };

  return (
    <div className={`formation-field relative w-full ${ASPECT_CLASS[fmt]} ${className}`.trim()}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 w-full h-full rounded-xl shadow-inner"
        role={variant === 'edit' ? 'group' : 'img'}
        aria-label="Cancha con la alineación"
      >
        {/* Césped con franjas */}
        <rect x={0} y={0} width={W} height={H} fill="#15803d" />
        {stripes.map((index) => (
          <rect
            key={index}
            x={0}
            y={index * (H / stripes.length)}
            width={W}
            height={H / stripes.length}
            fill={index % 2 === 0 ? '#166534' : '#15803d'}
            opacity={0.85}
          />
        ))}

        {/* Líneas de la cancha */}
        <g stroke="#ffffff" strokeOpacity={0.7} strokeWidth={0.7} fill="none">
          <rect x={3} y={3} width={W - 6} height={H - 6} />
          <line x1={3} y1={H / 2} x2={W - 3} y2={H / 2} />
          <circle cx={W / 2} cy={H / 2} r={centerR} />
          <rect x={27} y={3} width={46} height={boxH} />
          <rect x={39} y={3} width={22} height={goalAreaH} />
          <rect x={27} y={H - 3 - boxH} width={46} height={boxH} />
          <rect x={39} y={H - 3 - goalAreaH} width={22} height={goalAreaH} />
        </g>
        {/* Arcos */}
        <rect x={42} y={goalY} width={16} height={goalH} fill="#ffffff" fillOpacity={0.75} />
        <rect x={42} y={H - goalY - goalH} width={16} height={goalH} fill="#ffffff" fillOpacity={0.75} />

        {slots.length === 0 ? (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={emptyFont} fill="#ffffff" fillOpacity={0.85}>
            {emptyMessage}
          </text>
        ) : null}

        {slots.map((slot) => {
          const cx = slot.x;
          const cy = cyOf(slot);
          const occupied = Boolean(slot.playerId) || Boolean(slot.playerName);
          const isSelected = selectedSlotIndex === slot.slotIndex;
          const isHighlighted = slot.highlighted || highlightSlotIndex === slot.slotIndex;
          const displayName = slot.playerName ? shortName(slot.playerName, 13) : '';
          const clickable = variant === 'edit' && Boolean(onSlotClick);
          const labelY = nameY(slot);
          const caption = occupied ? displayName : variant === 'edit' ? 'Vacante' : '';

          return (
            <g
              key={slot.slotIndex}
              transform={`translate(${cx} ${cy})`}
              className={`pitch-player ${clickable ? 'cursor-pointer' : ''}`}
              onClick={clickable && onSlotClick ? () => onSlotClick(slot) : undefined}
              role={clickable ? 'button' : undefined}
              aria-label={clickable ? `Editar ${slot.label}: ${slot.playerName ?? 'Vacante'}` : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={
                clickable && onSlotClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSlotClick(slot);
                      }
                    }
                  : undefined
              }
            >
              <title>
                {occupied ? `${slot.playerName ?? 'Jugador'} · ${slot.label}` : `Vacante ${slot.label}`}
              </title>

              {isHighlighted ? (
                <circle r={ringR} fill="none" stroke="#facc15" strokeWidth={1.1} strokeDasharray="2 1.6" />
              ) : null}
              {isSelected ? (
                <circle r={ringR} fill="none" stroke="#ffffff" strokeWidth={1.4} />
              ) : null}

              <circle
                r={chipR}
                fill={ROLE_FILL[slot.role]}
                stroke="#ffffff"
                strokeWidth={0.9}
                strokeOpacity={occupied ? 1 : 0.75}
                strokeDasharray={occupied ? undefined : '2 2'}
              />

              {occupied ? (
                <text x={0} y={numberFont * 0.35} textAnchor="middle" fontSize={numberFont} fontWeight={700} fill="#ffffff">
                  {slot.shirtNumber ?? slot.label}
                </text>
              ) : (
                <text x={0} y={labelFont * 0.47} textAnchor="middle" fontSize={labelFont} fontWeight={700} fill="#ffffff" fillOpacity={0.9}>
                  {slot.label}
                </text>
              )}

              {labelY !== null && caption ? (
                <text
                  x={0}
                  y={labelY - cy}
                  textAnchor="middle"
                  fontSize={nameFont}
                  fill="#ffffff"
                  fillOpacity={0.95}
                >
                  {caption}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
