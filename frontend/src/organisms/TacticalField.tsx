import type { CSSProperties } from "react";
import type { TeamFormat } from "../types/api";
import type { PitchSlot, PitchPhase } from "../types/tactics";
import { useElementWidth } from "../hooks/useElementWidth";
import { tacticalLayout, TACTICAL_TILE_HEIGHT } from "../utils/tactical-board";
import { tacticalBallPoint, tacticalRoute } from "../utils/tactical-play";
import { TacticalPosition } from "../molecules/TacticalPosition";
import { TacticalPitch } from "../molecules/TacticalPitch";
import { TacticalPlayRoute } from "../molecules/TacticalPlayRoute";

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
  const route = tacticalRoute(playback?.route ?? [], layout.slots);
  const points = route.map((slot) =>
    tacticalBallPoint(slot, layout.tileWidth, field.width ?? 320),
  );
  const receiver = route[playback?.step ?? 0];
  const ball = points[playback?.step ?? 0];
  return (
    <div className="fc-field-viewport">
      <div
        ref={field.ref}
        className="fc-tactical-field"
        data-format={format}
        data-phase={phase}
        style={
          {
            height: layout.height,
            "--tile-width": `${layout.tileWidth}px`,
            "--tile-height": `${TACTICAL_TILE_HEIGHT}px`,
          } as CSSProperties
        }
      >
        <TacticalPitch>
          {focusRole &&
            layout.slots
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
            layout.slots.flatMap((from, index) =>
              layout.slots
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
        {layout.slots.map((slot) => (
          <div
            key={slot.slotIndex}
            className="fc-position-anchor"
            style={{ left: `${slot.left}%`, top: `${slot.top}%` }}
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
