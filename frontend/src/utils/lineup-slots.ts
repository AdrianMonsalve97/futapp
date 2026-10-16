import { getFormation } from "../data/formations";
import type { LineupSlot, TeamFormat } from "../types/api";
import type { PitchSlot } from "../types/tactics";

type Selection = Pick<
  PitchSlot,
  "playerId" | "playerName" | "shirtNumber" | "avatarUrl" | "playerPosition"
>;
export function assignLineupSlot(
  slots: PitchSlot[],
  slotIndex: number,
  selection: Selection | null,
): PitchSlot[] {
  if (!slots.some((slot) => slot.slotIndex === slotIndex)) return slots;
  const clear = {
    playerId: null,
    playerName: null,
    shirtNumber: null,
    avatarUrl: null,
    playerPosition: null,
  };
  return slots.map((slot) =>
    slot.slotIndex === slotIndex
      ? { ...slot, ...clear, ...selection }
      : selection?.playerId != null && slot.playerId === selection.playerId
        ? { ...slot, ...clear }
        : slot,
  );
}

/** Merge player identities with the format catalog without mutating the saved lineup. */
export function pitchSlotsFrom(
  formationKey: string,
  lineup?: LineupSlot[] | null,
  format?: TeamFormat,
): PitchSlot[] {
  const catalog = getFormation(formationKey, format).slots;
  const byIndex = new Map<number, LineupSlot>(
    (lineup ?? []).map((item) => [item.slotIndex, item]),
  );
  return catalog.map((item) => {
    const saved = byIndex.get(item.slotIndex);
    return {
      slotIndex: item.slotIndex,
      x: saved?.x ?? item.x,
      y: saved?.y ?? item.y,
      role: item.role,
      label: item.label,
      playerId: saved?.playerId ?? null,
      playerName: saved?.playerName ?? null,
      shirtNumber: saved?.shirtNumber ?? null,
      avatarUrl: saved?.avatarUrl ?? null,
      playerPosition: saved?.playerPosition ?? null,
    };
  });
}
