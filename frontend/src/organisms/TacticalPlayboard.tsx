import {
  phaseSlots,
  resolvePhaseFormations,
} from "../../../backend/src/domain/tactical-phases";
import type { PhaseFormations } from "../types/tactics";
import { Button } from "../atoms/Button";
import type { TeamFormat } from "../types/api";
import type { PitchSlot, TacticalPlay } from "../types/tactics";
import { useTacticalPlayback } from "../hooks/useTacticalPlayback";
import { tacticalPlayPhase, tacticalRoute } from "../utils/tactical-play";
import { TacticalField } from "./TacticalField";

export function TacticalPlayboard({
  play,
  slots,
  format,
  formation,
  phaseFormations,
  allowedFormations,
}: {
  play: TacticalPlay;
  slots: PitchSlot[];
  format: TeamFormat;
  formation: string;
  phaseFormations?: PhaseFormations | null;
  allowedFormations?: string[];
}) {
  const route = tacticalRoute(play.route, slots);
  const sequence = `${play.id}:${play.phase}:${route.map((slot) => `${slot.slotIndex}/${slot.playerId ?? "vacante"}`).join(",")}`;
  const { step, playing, seek, toggle, speed, setSpeed, loop, setLoop } =
    useTacticalPlayback(sequence, route.length);
  const phase = tacticalPlayPhase(play.phase, step);
  const systems = resolvePhaseFormations(
    formation,
    format,
    phaseFormations,
    allowedFormations,
  );
  const activeSystem = phase === "estructura" ? formation : systems[phase];
  const activeSlots =
    phase === "estructura" ? slots : phaseSlots(slots, activeSystem, format);
  const receiver = route[step];
  return (
    <section
      className="fc-board fc-playboard"
      aria-label={`Ensayo táctico: ${play.title}`}
    >
      <div className="fc-board-heading">
        <div>
          <p className="sport-eyebrow">
            ENSAYO EN CANCHA · F{format} · {play.phase} · {activeSystem}
          </p>
          <h3>{play.title}</h3>
        </div>
        <span className="fc-board-count">
          {slots.filter((slot) => slot.playerId != null).length}
          <small>/{format}</small>
        </span>
      </div>
      <TacticalField
        slots={activeSlots}
        format={format}
        phase={phase}
        playback={{ route: play.route, step }}
      />
      <div className="fc-play-controls">
        <div className="fc-replay-scoreboard">
          <span>
            <i aria-hidden="true" />{" "}
            {playing ? "JUGADA EN MOVIMIENTO" : "PIZARRA DEL ENTRENADOR"}
          </span>
          <strong>
            {String(step + 1).padStart(2, "0")}{" "}
            <small>/ {String(route.length).padStart(2, "0")}</small>
          </strong>
          <span>
            {route[step + 1]
              ? `${receiver?.label} → ${route[step + 1].label}`
              : "FIN DE LA SECUENCIA"}
          </span>
        </div>
        <div className="fc-play-transport">
          <Button
            size="sm"
            variant="outline"
            onClick={() => seek(step - 1)}
            disabled={step === 0}
          >
            Anterior
          </Button>
          <label className="fc-replay-speed">
            Ritmo
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              <option value={0.75}>0.75×</option>
              <option value={1}>1×</option>
              <option value={1.5}>1.5×</option>
            </select>
          </label>
          <button
            type="button"
            className="fc-support-toggle"
            aria-pressed={loop}
            onClick={() => setLoop(!loop)}
          >
            Repetir
          </button>
          <span role="status">
            {route.length
              ? `Paso ${step + 1}/${route.length}`
              : "Sin recorrido disponible"}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => seek(step + 1)}
            disabled={step >= route.length - 1}
          >
            Siguiente
          </Button>
          <Button
            size="sm"
            onClick={toggle}
            aria-pressed={playing}
            disabled={route.length < 2}
          >
            {playing
              ? "Pausar"
              : step === route.length - 1
                ? "Volver a reproducir"
                : "Reproducir jugada"}
          </Button>
        </div>
        {route.length > 0 && (
          <div className="fc-play-timeline" aria-label="Puntos del recorrido">
            {route.map((slot, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Paso ${index + 1}: ${slot.playerName ?? slot.label}`}
                aria-current={step === index ? "step" : undefined}
                data-complete={index < step}
                onClick={() => seek(index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{slot.label}</strong>
              </button>
            ))}
          </div>
        )}
        <p className="fc-play-receiver" aria-live="polite">
          {receiver ? (
            <>
              <strong>{receiver.playerName ?? "Posición por cubrir"}</strong> ·{" "}
              {receiver.label} ·{" "}
              {receiver.playerId != null
                ? "posesión del balón"
                : "recorrido de práctica"}
            </>
          ) : (
            "Esta jugada no tiene posiciones válidas en la formación seleccionada."
          )}
        </p>
        <p className="fc-play-note">
          Balón dorado: pase · trazos verdes: desmarques y apoyos. Los
          movimientos son de ensayo y respetan el espacio entre fichas; no
          cambian el inicial publicado.
        </p>
      </div>
    </section>
  );
}
