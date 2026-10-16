import type { LineupSlot } from "./entities";

/** Resolve actual positions once; missing photos or vacant players do not create fictional teammates. */
export function coachingContext(slots: LineupSlot[]) {
  const keeper = slots.find((slot) => slot.role === "POR");
  const field = slots
    .filter((slot) => slot.role !== "POR")
    .sort((a, b) => a.x - b.x || a.slotIndex - b.slotIndex);
  const defenders = field.filter((slot) => slot.role === "DEF");
  const midfield = field.filter((slot) => slot.role === "MED");
  const forwards = field.filter((slot) => slot.role === "DEL");
  const central = (items: LineupSlot[]) =>
    [...items].sort(
      (a, b) =>
        Math.abs(a.x - 50) - Math.abs(b.x - 50) || a.slotIndex - b.slotIndex,
    )[0];
  const striker = central(forwards);
  const centre = central(midfield) ?? defenders.at(-1);
  const supports = field.filter(
    (slot) =>
      slot.slotIndex !== centre?.slotIndex &&
      slot.slotIndex !== striker?.slotIndex,
  );
  const left =
    supports.find(
      (slot) => slot.role === "MED" && slot.x < (centre?.x ?? 50),
    ) ?? supports[0];
  const right =
    [...supports]
      .reverse()
      .find(
        (slot) =>
          slot.slotIndex !== left?.slotIndex &&
          slot.role === "MED" &&
          slot.x > (centre?.x ?? 50),
      ) ??
    [...supports].reverse().find((slot) => slot.slotIndex !== left?.slotIndex);
  const leftDefender = defenders[0],
    rightDefender = defenders.at(-1);
  if (
    !keeper ||
    !centre ||
    !striker ||
    !left ||
    !right ||
    !leftDefender ||
    !rightDefender
  )
    return null;
  const person = (slot: LineupSlot) =>
    `${slot.label} (${slot.playerName ?? "puesto vacante"})`;
  // Return passes matter; only consecutive references to the same receiver are redundant.
  const route = (items: LineupSlot[]) =>
    items
      .map((slot) => slot.slotIndex)
      .filter(
        (index, position, all) => position === 0 || index !== all[position - 1],
      );
  return {
    keeper,
    leftDefender,
    rightDefender,
    centre,
    striker,
    left,
    right,
    person,
    route,
  };
}

export type CoachingContext = NonNullable<ReturnType<typeof coachingContext>>;
