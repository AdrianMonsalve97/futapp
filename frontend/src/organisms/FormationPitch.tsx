import { shortName } from '../utils/format';
import { getFormation } from '../data/formations';
import type { LineupSlot, TeamFormat } from '../types/api';
import { useId, useState } from 'react';
import { Avatar } from '../atoms/Avatar';
import { PitchPortrait, PITCH_COLORS } from './PitchPortrait';

export interface PitchSlot {
  slotIndex: number;
  x: number;
  y: number;
  role: 'POR' | 'DEF' | 'MED' | 'DEL';
  label: string;
  playerId?: number | null;
  playerName?: string | null;
  shirtNumber?: number | null;
  avatarUrl?: string | null;
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
      avatarUrl: saved?.avatarUrl ?? null,
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
  const [detailIndex,setDetailIndex] = useState<number|null>(null);
  const [connections,setConnections] = useState(false);
  const [zoom,setZoom] = useState(false);
  const grassId = `grass-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`;
  const detail = slots.find(slot=>slot.slotIndex===detailIndex);
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
    <section className={`tactical-arena ${className}`.trim()}>
      <div className="tactical-arena-bar"><span><span className="tactical-live-dot"/> F{fmt} · {slots.filter(slot=>slot.playerId).length}/{fmt} jugadores</span><div className="flex flex-wrap gap-2"><button type="button" className="tactical-control" aria-pressed={connections} onClick={()=>setConnections(value=>!value)}>Apoyos {connections?'✓':'+'}</button><button type="button" className="tactical-control" aria-pressed={zoom} onClick={()=>setZoom(value=>!value)}>{zoom?'Reducir':'Ampliar'}</button></div></div>
    <div className="overflow-auto"><div className={`formation-field relative w-full ${ASPECT_CLASS[fmt]}`} style={zoom?{width:'max(100%, 560px)'}:undefined}>
      <svg
        viewBox={`-8 ${-H*0.08} ${W+16} ${H*1.16}`}
        className="absolute inset-0 w-full h-full rounded-xl shadow-inner"
        role="group"
        aria-label="Cancha con la alineación"
      >
        <defs><radialGradient id={grassId} cx="50%" cy="40%" r="75%"><stop offset="0%" stopColor="#21543f"/><stop offset="100%" stopColor="#081d18"/></radialGradient></defs>
        {/* Césped con franjas */}
        <rect x={0} y={0} width={W} height={H} fill={`url(#${grassId})`} />
        {stripes.map((index) => (
          <rect
            key={index}
            x={0}
            y={index * (H / stripes.length)}
            width={W}
            height={H / stripes.length}
            fill={index % 2 === 0 ? '#ffffff' : '#000000'}
            opacity={0.035}
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
        {connections ? <g stroke="#d8b86a" strokeWidth="0.45" strokeDasharray="1.5 1.8" opacity="0.5" aria-hidden="true">
          {slots.filter(slot=>slot.playerId).flatMap(slot=>slots.filter(other=>other.playerId && other.slotIndex>slot.slotIndex && Math.hypot(other.x-slot.x,other.y-slot.y)<45).map(other=><line key={`${slot.slotIndex}:${other.slotIndex}`} x1={slot.x} y1={cyOf(slot)} x2={other.x} y2={cyOf(other)}/>))}
        </g> : null}

        {slots.length === 0 ? (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={emptyFont} fill="#ffffff" fillOpacity={0.85}>
            {emptyMessage}
          </text>
        ) : null}

        {slots.map((slot) => {
          const cx = slot.x;
          const cy = cyOf(slot);
          const occupied = Boolean(slot.playerId) || Boolean(slot.playerName);
          const isSelected = selectedSlotIndex === slot.slotIndex || detailIndex === slot.slotIndex;
          const isHighlighted = slot.highlighted || highlightSlotIndex === slot.slotIndex;
          const displayName = slot.playerName ? shortName(slot.playerName, 13) : '';
          const clickable = occupied || variant === 'edit';
          const activate = () => { setDetailIndex(slot.slotIndex); if (variant==='edit') onSlotClick?.(slot); };
          const labelY = nameY(slot);
          const caption = occupied ? displayName : variant === 'edit' ? 'Vacante' : '';

          return (
            <g
              key={slot.slotIndex}
              transform={`translate(${cx} ${cy})`}
              className={`pitch-player ${clickable ? 'cursor-pointer' : ''}`}
              onClick={clickable ? activate : undefined}
              role={clickable ? 'button' : undefined}
              aria-label={clickable ? `${variant==='edit'?'Asignar':'Ver'} ${slot.label}: ${slot.playerName ?? 'Vacante'}${isHighlighted?' · Tu posición':''}` : undefined}
              aria-pressed={clickable ? isSelected : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={
                clickable
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        activate();
                      }
                    }
                  : undefined
              }
            >
              <title>
                {occupied ? `${slot.playerName ?? 'Jugador'} · ${slot.label}` : `Vacante ${slot.label}`}
              </title>

              {isHighlighted ? (
                <circle className="pitch-own-ring" r={ringR} fill="none" stroke="#e9c76e" strokeWidth={0.8} />
              ) : null}
              {isSelected ? (
                <circle r={ringR} fill="none" stroke="#ffffff" strokeWidth={1.4} />
              ) : null}

              <circle r={Math.max(chipR+2,9)} fill="transparent"/>
              <PitchPortrait src={slot.avatarUrl} name={slot.playerName} number={slot.shirtNumber} label={slot.label} role={slot.role} radius={chipR} occupied={occupied}/>

              {labelY !== null && caption ? (
                <text
                  x={0}
                  y={labelY - cy}
                  textAnchor="middle"
                  fontSize={nameFont}
                  fill="#ffffff"
                  fillOpacity={0.95}
                  fontWeight={600}
                  stroke="#082219" strokeWidth="0.7" paintOrder="stroke"
                >
                  {caption}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
    </div>
    <div className="tactical-arena-footer">
      {detail ? <div className="tactical-player-detail" aria-live="polite"><Avatar name={detail.playerName ?? 'Vacante'} src={detail.avatarUrl} size="sm"/><div><strong>{detail.playerName ?? 'Posición vacante'} {detail.shirtNumber!==null && detail.shirtNumber!==undefined?`· #${detail.shirtNumber}`:''}</strong><span>{detail.role} · {detail.label}{detail.highlighted || highlightSlotIndex===detail.slotIndex?' · Tu posición':''}</span></div><button type="button" className="tactical-control" aria-label="Cerrar detalle del jugador" onClick={()=>setDetailIndex(null)}>×</button></div> : <p className="tactical-hint">{zoom?'Desliza la cancha para recorrer las posiciones. ':''}{variant==='edit'?'Toca una posición para asignar un jugador.':'Toca una foto para conocer su posición. Tu ubicación se resalta en dorado.'}</p>}
      <div className="tactical-role-legend">{Object.entries(PITCH_COLORS).map(([role,color])=><span key={role}><i style={{backgroundColor:color}}/>{role}</span>)}</div>
    </div>
    </section>
  );
}
