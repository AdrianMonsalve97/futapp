import type { PitchSlot } from "../types/tactics";
import { useId, useState, type CSSProperties } from "react";
import type { TeamFormat } from "../types/api";

import type { PitchPhase } from "../utils/pitch-layout";
import { tacticalLayout } from "../utils/tactical-board";
import {
  TacticalPosition,
  TACTICAL_ROLE_NAMES,
} from "../molecules/TacticalPosition";
import { SectionNavigation } from "../molecules/SectionNavigation";

export function TacticalBoard({
  slots,
  format,
  selectedSlotIndex,
  onSlotSelect,
  onPlayerSelect,
}: {
  slots: PitchSlot[];
  format: TeamFormat;
  selectedSlotIndex?: number | null;
  onSlotSelect?: (slot: PitchSlot) => void;
  onPlayerSelect?: (id: number) => void;
}) {
  const gradientId = `tactical-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [phase, setPhase] = useState<PitchPhase>("estructura");
  const [focused, setFocused] = useState<number | null>(null);
  const layout = tacticalLayout(slots, format, phase);
  const selected = slots.find(
    (slot) => slot.slotIndex === (selectedSlotIndex ?? focused),
  );
  return (
    <section
      className="fc-board"
      aria-label={`Cancha táctica de fútbol ${format}`}
    >
      <div className="fc-board-heading">
        <div>
          <p className="sport-eyebrow">TEAM TACTICS · F{format}</p>
          <h3>
            {phase === "ataque"
              ? "Con balón"
              : phase === "repliegue"
                ? "Sin balón"
                : "Estructura del equipo"}
          </h3>
        </div>
        <span className="fc-board-count">
          {slots.filter((slot) => slot.playerId != null).length}
          <small>/{format}</small>
        </span>
      </div>
      <SectionNavigation
        label="Vista de la formación"
        value={phase}
        onChange={setPhase}
        items={[
          { key: "estructura", label: "Estructura" },
          { key: "ataque", label: "Con balón" },
          { key: "repliegue", label: "Sin balón" },
        ]}
      />
      <div
        className="fc-board-scroll"
        tabIndex={0}
        role="region"
        aria-label="Cancha; desliza horizontalmente si la formación necesita más espacio"
      >
        <div
          className="fc-tactical-field"
          style={
            {
              minWidth: layout.minWidth,
              minHeight: layout.minHeight,
              "--tile-width": `${layout.tileWidth}%`,
            } as CSSProperties
          }
        >
          <svg
            className="fc-pitch-lines"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#142535" />
                <stop offset="1" stopColor="#23414b" />
              </linearGradient>
            </defs>
            <path d="M17 7H83L98 96H2Z" fill={`url(#${gradientId})`} />
            <g
              fill="none"
              stroke="#c0e0e1"
              strokeOpacity=".26"
              strokeWidth=".32"
            >
              <path d="M17 7H83L98 96H2ZM9.5 51.5H90.5M38 7L36 19H64L62 7M33 96L35 80H65L67 96M43 7L42.5 12H57.5L57 7M40 96L40.8 89H59.2L60 96" />
              <ellipse cx="50" cy="51.5" rx="10.5" ry="8.5" />
              <path d="M46 7V4H54V7M43 96V99H57V96" />
            </g>
            <g stroke="#d0f4e9" strokeOpacity=".025" strokeWidth="6">
              <path d="M16 18H84M14 31H86M11 44H89M9 57H91M6 70H94M4 83H96" />
            </g>
          </svg>
          {layout.slots.map((slot) => (
            <div
              key={slot.slotIndex}
              className="fc-position-anchor"
              style={{ left: `${slot.left}%`, top: `${slot.top}%` }}
            >
              <TacticalPosition
                slot={slot}
                selected={selected?.slotIndex === slot.slotIndex}
                onSelect={
                  onSlotSelect || slot.playerId != null
                    ? () => {
                        setFocused(slot.slotIndex);
                        if (onSlotSelect) onSlotSelect(slot);
                        else if (slot.playerId != null)
                          onPlayerSelect?.(slot.playerId);
                      }
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div className="fc-board-caption" aria-live="polite">
        {selected ? (
          <>
            <strong>{selected.playerName ?? "Posición vacante"}</strong>
            <span>
              {selected.label} · {TACTICAL_ROLE_NAMES[selected.role]}
              {selected.shirtNumber != null
                ? ` · #${selected.shirtNumber}`
                : ""}
            </span>
          </>
        ) : (
          <>
            <strong>
              {onSlotSelect
                ? "Selecciona una posición para elegir jugador."
                : "Selecciona una ficha para explorar a tu compañero."}
            </strong>
            <span>
              Las vistas con y sin balón son una guía visual; no modifican la
              formación guardada.
            </span>
          </>
        )}
      </div>
    </section>
  );
}
