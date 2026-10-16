import type { PitchSlot, PitchPhase } from "../types/tactics";
import type { TeamFormat } from "../types/api";
import { useTacticalBoard } from "../hooks/useTacticalBoard";
import { TACTICAL_ROLE_NAMES } from "../molecules/TacticalPosition";
import { SectionNavigation } from "../molecules/SectionNavigation";
import { TacticalField } from "./TacticalField";

export function TacticalBoard({
  slots,
  format,
  selectedSlotIndex,
  onSlotSelect,
  onPlayerSelect,
  phase: controlledPhase,
  onPhaseChange,
  focusRole,
}: {
  slots: PitchSlot[];
  format: TeamFormat;
  selectedSlotIndex?: number | null;
  onSlotSelect?: (slot: PitchSlot) => void;
  onPlayerSelect?: (id: number) => void;
  phase?: PitchPhase;
  onPhaseChange?: (phase: PitchPhase) => void;
  focusRole?: PitchSlot["role"];
}) {
  const view = useTacticalBoard();
  const phase = controlledPhase ?? view.phase;
  const selected = slots.find(
    (slot) => slot.slotIndex === (selectedSlotIndex ?? view.focused),
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
      <div className="fc-board-toolbar">
        <SectionNavigation
          label="Vista de la formación"
          value={phase}
          onChange={onPhaseChange ?? view.setPhase}
          items={[
            { key: "estructura", label: "Estructura" },
            { key: "ataque", label: "Con balón" },
            { key: "repliegue", label: "Sin balón" },
          ]}
        />
        <button
          type="button"
          className="fc-support-toggle"
          aria-pressed={view.connections}
          onClick={() => view.setConnections(!view.connections)}
        >
          Líneas de apoyo
        </button>
      </div>
      <TacticalField
        editable={Boolean(onSlotSelect)}
        slots={slots}
        format={format}
        phase={phase}
        selectedSlotIndex={selected?.slotIndex}
        focusRole={focusRole}
        connections={view.connections}
        onSlotSelect={(slot) => {
          if (!onSlotSelect && slot.playerId == null) return;
          view.setFocused(slot.slotIndex);
          if (onSlotSelect) onSlotSelect(slot);
          else if (slot.playerId != null) onPlayerSelect?.(slot.playerId);
        }}
      />
      <div className="fc-board-caption" aria-live="polite">
        {selected ? (
          <>
            <strong>
              {selected.playerName ?? "Posición vacante"}
              {selected.highlighted ? " · Tu posición" : ""}
            </strong>
            <span>
              {selected.label} · {TACTICAL_ROLE_NAMES[selected.role]}
              {selected.shirtNumber != null
                ? ` · #${selected.shirtNumber}`
                : ""}
              {selected.playerPosition &&
              selected.playerPosition !== selected.role
                ? ` · Adaptación desde ${TACTICAL_ROLE_NAMES[selected.playerPosition]}`
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
