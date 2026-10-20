import type { CSSProperties } from "react";
import type { TeamFormat } from "../types/api";
import type { PitchSlot, PitchPhase } from "../types/tactics";
import { useElementWidth } from "../hooks/useElementWidth";
import { tacticalLayout, TACTICAL_TILE_HEIGHT } from "../utils/tactical-board";
import { tacticalBallPoint, tacticalRoute } from "../utils/tactical-play";
import { TacticalPosition } from "../molecules/TacticalPosition";
import { TacticalPitch } from "../molecules/TacticalPitch";
import { TacticalPlayRoute } from "../molecules/TacticalPlayRoute";
import { tacticalMotion } from "../utils/tactical-motion";

export function TacticalField({
  slots,
  format,
  phase,
  selectedSlotIndex,
  onSlotSelect,
  editable = false,
  focusRole,
  connections = false,
  playback,
}: {
  slots: PitchSlot[];
  format: TeamFormat;
  editable?: boolean;
  phase: PitchPhase;
  selectedSlotIndex?: number | null;
  onSlotSelect?: (slot: PitchSlot) => void;
  focusRole?: PitchSlot["role"];
  connections?: boolean;
  playback?: { route: number[]; step: number };
}) {
  const field = useElementWidth();
  const layout = tacticalLayout(slots, field.width ?? 320);
  const positions = playback
    ? tacticalMotion(
        layout.slots,
        playback.route,
        playback.step,
        field.width ?? 320,
        layout.height,
        layout.tileWidth,
      )
    : layout.slots;
  const route = tacticalRoute(playback?.route ?? [], positions);
  const points = route.map((slot) =>
    tacticalBallPoint(slot, layout.tileWidth, field.width ?? 320),
  );
  const receiver = route[playback?.step ?? 0];
  const ball = points[playback?.step ?? 0];
  const next = route[(playback?.step ?? 0) + 1];
  return (
    <div className="fc-field-viewport">
      <div
        ref={field.ref}
        className="fc-tactical-field"
        data-format={format}
        data-phase={phase}
        data-playback={Boolean(playback)}
        style={
          {
            height: layout.height,
            "--tile-width": `${layout.tileWidth}px`,
            "--tile-height": `${TACTICAL_TILE_HEIGHT}px`,
          } as CSSProperties
        }
      >
        <TacticalPitch>
          {playback &&
            positions.map((slot, index) => {
              const start = layout.slots[index];
              if (
                Math.hypot(start.left - slot.left, start.top - slot.top) < 0.5
              )
                return null;
              return (
                <path
                  key={`run-${slot.slotIndex}`}
                  className="fc-running-lane"
                  d={`M${start.left} ${start.top}Q${slot.left} ${start.top} ${slot.left} ${slot.top}`}
                />
              );
            })}
          {focusRole &&
            positions
              .filter((slot) => slot.role === focusRole)
              .map((slot) => (
                <ellipse
                  key={slot.slotIndex}
                  cx={slot.left}
                  cy={slot.top}
                  rx="12"
                  ry="10"
                  className="fc-role-zone"
                />
              ))}
          {connections &&
            positions.flatMap((from, index) =>
              positions
                .slice(index + 1)
                .filter(
                  (to) =>
                    from.playerId != null &&
                    to.playerId != null &&
                    Math.hypot(from.x - to.x, from.y - to.y) < 45,
                )
                .map((to) => (
                  <path
                    className="fc-support-line"
                    key={`${from.slotIndex}-${to.slotIndex}`}
                    d={`M${from.left} ${from.top}L${to.left} ${to.top}`}
                  />
                )),
            )}
          {playback && (
            <TacticalPlayRoute
              points={points}
              step={playback.step}
              defending={phase === "repliegue"}
            />
          )}
        </TacticalPitch>
        <span className="fc-field-direction" aria-hidden="true">
          ATAQUE ↑
        </span>
        {positions.map((slot) => (
          <div
            key={slot.slotIndex}
            className="fc-position-anchor"
            data-role={slot.role}
            data-possession={playback && slot.slotIndex === receiver?.slotIndex}
            data-next={playback && slot.slotIndex === next?.slotIndex}
            style={
              {
                left: `${slot.left}%`,
                top: `${slot.top}%`,
                "--card-order": slot.slotIndex,
              } as CSSProperties
            }
          >
            <TacticalPosition
              slot={slot}
              selected={
                slot.slotIndex === (receiver?.slotIndex ?? selectedSlotIndex)
              }
              onSelect={
                onSlotSelect && (slot.playerId != null || editable)
                  ? () => onSlotSelect(slot)
                  : undefined
              }
            />
          </div>
        ))}
        {ball && (
          <span
            className="fc-play-ball"
            style={{ left: `${ball.left}%`, top: `${ball.top}%` }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
