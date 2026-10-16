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
}: {
  play: TacticalPlay;
  slots: PitchSlot[];
  format: TeamFormat;
}) {
  const route = tacticalRoute(play.route, slots);
  const sequence = `${play.id}:${play.phase}:${route.map((slot) => `${slot.slotIndex}/${slot.playerId ?? "vacante"}`).join(",")}`;
  const { step, playing, seek, toggle } = useTacticalPlayback(
    sequence,
    route.length,
  );
  const phase = tacticalPlayPhase(play.phase, step);
  const receiver = route[step];
  return (
    <section
      className="fc-board fc-playboard"
      aria-label={`Ensayo táctico: ${play.title}`}
    >
      <div className="fc-board-heading">
        <div>
          <p className="sport-eyebrow">
            PLAY REPLAY · F{format} · {play.phase}
          </p>
          <h3>{play.title}</h3>
        </div>
        <span className="fc-board-count">
          {slots.filter((slot) => slot.playerId != null).length}
          <small>/{format}</small>
        </span>
      </div>
      <TacticalField
        slots={slots}
        format={format}
        phase={phase}
        playback={{ route: play.route, step }}
      />
      <div className="fc-play-controls">
        <div className="fc-play-transport">
          <Button
            size="sm"
            variant="outline"
            onClick={() => seek(step - 1)}
            disabled={step === 0}
          >
            Anterior
          </Button>
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
                ? "punto actual del recorrido"
                : "recorrido de práctica"}
            </>
          ) : (
            "Esta jugada no tiene posiciones válidas en la formación seleccionada."
          )}
        </p>
        <p className="fc-play-note">
          Ensayo esquemático. Las flechas muestran el recorrido; no cambian el
          inicial publicado.
        </p>
      </div>
    </section>
  );
}
