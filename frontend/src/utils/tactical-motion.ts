import type { PitchSlot } from "../types/tactics";
import { tacticalRoute } from "./tactical-play";

type ProjectedSlot = PitchSlot & { left: number; top: number };
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Off-ball rehearsal in screen space: preserve identity, spacing, keeper and saved coordinates. */
export function tacticalMotion<T extends ProjectedSlot>(
  slots: T[],
  routeIds: number[],
  step: number,
  width: number,
  height: number,
  tileWidth: number,
): T[] {
  const route = tacticalRoute(routeIds, slots);
  const holder = route[step];
  if (!holder || step === 0) return slots;
  const next = route[step + 1];
  const previous = route[step - 1];
  const desired = slots.map((slot) => {
    if (slot.role === "POR") return { left: slot.left, top: slot.top };
    const receiving = slot.slotIndex === next?.slotIndex;
    const supporting = slot.slotIndex === previous?.slotIndex;
    const side =
      holder.x === 50 ? (step % 2 ? 1 : -1) : Math.sign(holder.x - 50);
    const lateral = receiving ? -side : supporting ? side * 0.5 : side * 0.65;
    const depth = receiving
      ? -1
      : supporting
        ? 0.65
        : slot.role === "DEL"
          ? -0.65
          : 0.2;
    return {
      left: clamp(
        slot.left + lateral * Math.min(5, 2200 / width),
        ((tileWidth / 2 + 5) * 100) / width,
        100 - ((tileWidth / 2 + 5) * 100) / width,
      ),
      top: clamp(slot.top + depth * 5, 12, 88),
    };
  });
  // Limit the whole movement together, so cards never overlap even on a narrow phone.
  for (const scale of [1, 0.75, 0.5, 0.25]) {
    const frame = slots.map((slot, index) => ({
      ...slot,
      left: slot.left + (desired[index].left - slot.left) * scale,
      top: slot.top + (desired[index].top - slot.top) * scale,
    }));
    if (
      frame.every((slot, index) =>
        frame
          .slice(index + 1)
          .every(
            (other) =>
              (Math.abs(slot.left - other.left) * width) / 100 >=
                tileWidth + 3.99 ||
              (Math.abs(slot.top - other.top) * height) / 100 >= 52,
          ),
      )
    )
      return frame;
  }
  return slots;
}
