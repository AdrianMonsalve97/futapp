import {
  phaseFormationOptions,
  phaseSlots,
  resolvePhaseFormations,
} from "../../../backend/src/domain/tactical-phases";
import type { PhaseFormations } from "../types/tactics";
import { Select } from "../atoms/Select";
import type { PitchSlot, PitchPhase } from "../types/tactics";
import type { TeamFormat } from "../types/api";
import { useTacticalBoard } from "../hooks/useTacticalBoard";
import { TACTICAL_ROLE_NAMES } from "../molecules/TacticalPosition";
import { SectionNavigation } from "../molecules/SectionNavigation";
import { TacticalField } from "./TacticalField";

export function TacticalBoard({
  slots,
  format,
  formation,
  phaseFormations,
  allowedFormations,
  onPhaseFormationChange,
  phaseEditingDisabled = false,
  selectedSlotIndex,
  onSlotSelect,
  onPlayerSelect,
  phase: controlledPhase,
  onPhaseChange,
  focusRole,
}: {
  slots: PitchSlot[];
  format: TeamFormat;
  formation: string;
  phaseFormations?: PhaseFormations | null;
  allowedFormations?: string[];
  onPhaseFormationChange?: (
    phase: "ataque" | "repliegue",
    formation: string,
  ) => void;
  phaseEditingDisabled?: boolean;
  selectedSlotIndex?: number | null;
  onSlotSelect?: (slot: PitchSlot) => void;
  onPlayerSelect?: (id: number) => void;
  phase?: PitchPhase;
  onPhaseChange?: (phase: PitchPhase) => void;
  focusRole?: PitchSlot["role"];
}) {
  const view = useTacticalBoard();
  const phase = controlledPhase ?? view.phase;
  const systems = resolvePhaseFormations(
    formation,
    format,
    phaseFormations,
    allowedFormations,
  );
  const activeSystem = phase === "estructura" ? formation : systems[phase];
  const activeSlots =
    phase === "estructura" ? slots : phaseSlots(slots, activeSystem, format);
  const selected = activeSlots.find(
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
      <div className="fc-phase-system">
        {phase !== "estructura" && onPhaseFormationChange ? (
          <label className="fc-phase-system-control">
            <span>
              Sistema {phase === "ataque" ? "con balón" : "sin balón"}
            </span>
            <Select
              disabled={phaseEditingDisabled}
              value={activeSystem}
              onChange={(event) =>
                onPhaseFormationChange(phase, event.target.value)
              }
            >
              {phaseFormationOptions(format, allowedFormations).map((item) => (
                <option key={item.key} value={item.key}>
                  {item.key}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <strong>Sistema {activeSystem}</strong>
        )}
        <span>
          Base {formation} · Con balón {systems.ataque} · Sin balón{" "}
          {systems.repliegue}
        </span>
        {!phaseFormations && (
          <small>
            Variantes de referencia. El entrenador todavía no ha definido los
            sistemas de cada fase.
          </small>
        )}
        {allowedFormations?.length === 1 && (
          <small>
            El torneo permite un único sistema. Amplía las formaciones
            permitidas en su normativa para usar variantes.
          </small>
        )}
      </div>
      <TacticalField
        editable={Boolean(onSlotSelect) && phase === "estructura"}
        slots={activeSlots}
        format={format}
        phase={phase}
        selectedSlotIndex={selected?.slotIndex}
        focusRole={focusRole}
        connections={view.connections}
        onSlotSelect={(slot) => {
          if (!onSlotSelect && slot.playerId == null) return;
          view.setFocused(slot.slotIndex);
          if (onSlotSelect && phase === "estructura") onSlotSelect(slot);
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
                ? phase === "estructura"
                  ? "Selecciona una posición para elegir jugador."
                  : "Asigna jugadores desde Estructura; aquí revisas sus movimientos y funciones."
                : "Selecciona una ficha para explorar a tu compañero."}
            </strong>
            <span>
              Cada fase redistribuye al mismo equipo. Las líneas muestran apoyos
              de la formación activa.{" "}
              {onPhaseFormationChange
                ? "Guarda y publica para compartir el plan."
                : "Sigue tu ficha al cambiar de fase."}
            </span>
          </>
        )}
      </div>
    </section>
  );
}
