import type { CSSProperties } from "react";
import type { TeamFormat } from "../types/api";
import type { PitchSlot, PitchPhase } from "../types/tactics";
import { useElementWidth } from "../hooks/useElementWidth";
import { tacticalLayout } from "../utils/tactical-board";
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
  enlarged = false,
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
  enlarged?: boolean;
  playback?: { route: number[]; step: number };
}) {
  const layout = tacticalLayout(slots, phase);
  const field = useElementWidth(Boolean(playback));
  const route = tacticalRoute(playback?.route ?? [], layout.slots);
  const points = route.map((slot) =>
    tacticalBallPoint(slot, layout.tileWidth, field.width ?? layout.minWidth),
  );
  const receiver = route[playback?.step ?? 0];
  const ball = points[playback?.step ?? 0];
  return (
    <div
      className="fc-board-scroll"
      tabIndex={0}
      role="region"
      aria-label="Cancha; desliza horizontalmente si la formación necesita más espacio"
    >
      <div
        ref={field.ref}
        className="fc-tactical-field"
        data-format={format}
        data-phase={phase}
        style={
          {
            minWidth: Math.max(layout.minWidth, enlarged ? 850 : 0),
            minHeight: layout.minHeight,
            "--tile-width": `${layout.tileWidth}%`,
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
