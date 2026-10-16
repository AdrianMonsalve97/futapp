import type { PitchSlot, PitchPhase } from "../types/tactics";

export function tacticalPlayPhase(phase: string, step: number): PitchPhase {
  if (phase === "Transición") return step === 0 ? "repliegue" : "ataque";
  if (step === 0) return "estructura";
  return phase === "Sin balón"
    ? "repliegue"
    : ["Con balón", "Ataque organizado"].includes(phase)
      ? "ataque"
      : "estructura";
}

/** Preserve repeated receivers and skip references not present in this formation. */
export function tacticalRoute<T extends Pick<PitchSlot, "slotIndex">>(
  route: number[],
  slots: T[],
): T[] {
  const positions = new Map(slots.map((slot) => [slot.slotIndex, slot]));
  return route.flatMap((index) => {
    const slot = positions.get(index);
    return slot ? [slot] : [];
  });
}

/** A visible point beside the card, shared by arrows and the moving ball. */
export function tacticalBallPoint(
  slot: { left: number; top: number },
  tileWidth: number,
  fieldWidth: number,
) {
  const cardWidth = Math.min(tileWidth, (128 * 100) / fieldWidth);
  return {
    left: Math.min(98, slot.left + cardWidth / 2 + 1200 / fieldWidth),
    top: slot.top,
  };
}
