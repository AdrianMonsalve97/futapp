import { layoutPitch, type PitchPhase } from "./pitch-layout";
import type { TeamFormat } from "../types/api";

/** Project existing positions onto a trapezoidal pitch, keeping touch targets apart. */
export function tacticalLayout<
  T extends { x: number; y: number; role: string },
>(slots: T[], format: TeamFormat, phase: PitchPhase) {
  const structured = layoutPitch(slots, format, "estructura");
  const rows: number[][] = [];
  for (const y of [...new Set(structured.map((slot) => slot.y))].sort(
    (a, b) => a - b,
  )) {
    if (rows.length && y - rows.at(-1)![0] <= 7) rows.at(-1)!.push(y);
    else rows.push([y]);
  }
  const projected = structured.map((slot) => {
    const row = rows.findIndex((values) => values.includes(slot.y));
    const position = rows.length < 2 ? 50 : 14 + (row * 76) / (rows.length - 1);
    const shift =
      slot.role === "POR"
        ? 0
        : phase === "ataque"
          ? -2
          : phase === "repliegue"
            ? 2
            : 0;
    const depth = Math.max(10, Math.min(92, position + shift)) / 100;
    return {
      ...slot,
      left: 50 + (slot.x - 50) * (0.68 + 0.28 * depth),
      top: 7 + depth * 84,
    };
  });
  let width = 17;
  for (const [index, slot] of projected.entries())
    for (const other of projected.slice(index + 1)) {
      if (Math.abs(slot.top - other.top) < 1)
        width = Math.min(width, Math.abs(slot.left - other.left) - 2);
    }
  width = Math.max(9, width);
  return {
    slots: projected,
    tileWidth: width,
    minWidth: Math.max(320, Math.ceil((48 * 100) / width)),
    minHeight: Math.max(420, Math.ceil(((rows.length - 1) * 68) / 0.6384)),
  };
}
