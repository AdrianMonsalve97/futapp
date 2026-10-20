export const TACTICAL_TILE_HEIGHT = 72;

/** Fit the whole pitch in its container without changing the stored formation. */
export function tacticalLayout<
  T extends { x: number; y: number; role: string },
>(slots: T[], fieldWidth = 320) {
  const rows: number[][] = [];
  for (const y of [...new Set(slots.map((slot) => slot.y))].sort(
    (a, b) => a - b,
  )) {
    if (rows.length && y - rows.at(-1)![0] <= 7) rows.at(-1)!.push(y);
    else rows.push([y]);
  }
  const projected = slots.map((slot) => {
    const row = rows.findIndex((values) => values.includes(slot.y));
    const depth = rows.length < 2 ? 0.5 : row / (rows.length - 1);
    return {
      ...slot,
      left: 50 + (slot.x - 50) * (0.72 + 0.24 * depth),
      top: 12 + depth * 76,
    };
  });
  const tileWidth = Math.min(76, Math.max(44, fieldWidth * 0.12));
  const gap = ((tileWidth + 4) * 100) / fieldWidth;
  const edge = ((tileWidth / 2 + 18) * 100) / fieldWidth;
  // Spread crowded lines only as needed. Keep their centre and left/right order.
  for (const row of rows) {
    const line = projected
      .filter((slot) => row.includes(slot.y))
      .sort((a, b) => a.left - b.left);
    if (!line.length) continue;
    const centre =
      line.reduce((total, slot) => total + slot.left, 0) / line.length;
    for (let index = 1; index < line.length; index++)
      line[index].left = Math.max(line[index].left, line[index - 1].left + gap);
    if (line.length > 1 && line.at(-1)!.left - line[0].left > 100 - 2 * edge) {
      line.forEach((slot, index) => {
        slot.left = edge + (index * (100 - 2 * edge)) / (line.length - 1);
      });
      continue;
    }
    const shift = Math.max(
      edge - line[0].left,
      Math.min(
        100 - edge - line.at(-1)!.left,
        centre -
          line.reduce((total, slot) => total + slot.left, 0) / line.length,
      ),
    );
    for (const slot of line) slot.left += shift;
  }
  return {
    slots: projected,
    tileWidth,
    // Includes a gap between targets and leaves the goalkeeper anchored.
    height: Math.max(
      320,
      rows.length < 2
        ? 0
        : Math.ceil((TACTICAL_TILE_HEIGHT + 12) / (0.76 / (rows.length - 1))),
    ),
  };
}
