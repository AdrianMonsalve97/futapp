import { ValidationError } from "./errors";
import {
  formationBelongsTo,
  formationsFor,
  getFormation,
  type FormationSlot,
} from "./formations";
import type { TeamFormat } from "./formats";

export type PitchPhase = "estructura" | "ataque" | "repliegue";
export interface PhaseFormations {
  ataque: string;
  repliegue: string;
}

/** League restrictions apply to every phase, with the goalkeeper included. */
export function phaseFormationOptions(
  format: TeamFormat,
  allowed?: readonly string[],
) {
  return formationsFor(format).filter(
    (item) => !allowed || allowed.includes(item.key),
  );
}

export function validatePhaseFormations(
  value: unknown,
  format: TeamFormat,
  allowed?: readonly string[],
): PhaseFormations {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ValidationError("Indica los sistemas con balón y sin balón");
  const input = value as Record<string, unknown>;
  const keys = ["ataque", "repliegue"] as const;
  const options = phaseFormationOptions(format, allowed);
  if (
    Object.keys(input).length !== 2 ||
    keys.some(
      (key) =>
        !Object.hasOwn(input, key) ||
        typeof input[key] !== "string" ||
        !options.some((option) => option.key === input[key]),
    )
  ) {
    throw new ValidationError(
      "Los sistemas de cada fase deben pertenecer al formato y estar permitidos por el torneo",
    );
  }
  return {
    ataque: input.ataque as string,
    repliegue: input.repliegue as string,
  };
}

/** Defaults are proposals, never additional rules or persisted changes. */
export function resolvePhaseFormations(
  base: string,
  format: TeamFormat,
  saved?: PhaseFormations | null,
  allowed?: readonly string[],
): PhaseFormations {
  const options = phaseFormationOptions(format, allowed);
  const score = (key: string) => {
    const slots = getFormation(key, format).slots;
    return (
      slots.filter((slot) => slot.role === "DEL").length * 3 -
      slots.filter((slot) => slot.role === "DEF").length * 2
    );
  };
  const ranked = [...options].sort(
    (a, b) => score(b.key) - score(a.key) || a.key.localeCompare(b.key),
  );
  const permitted = (key?: string) =>
    options.some((option) => option.key === key);
  return {
    ataque: permitted(saved?.ataque) ? saved!.ataque : (ranked[0]?.key ?? base),
    repliegue: permitted(saved?.repliegue)
      ? saved!.repliegue
      : (ranked.at(-1)?.key ?? base),
  };
}

/** Minimum-cost assignment keeps identities, sides and natural roles across systems.
 * slotIndex remains the player's base anchor, so plays and selection follow that player.
 */
export function phaseSlots<T extends FormationSlot>(
  slots: readonly T[],
  targetKey: string,
  format: TeamFormat,
): T[] {
  if (!formationBelongsTo(targetKey, format))
    throw new ValidationError("El sistema no pertenece al formato de juego");
  const targets = getFormation(targetKey, format).slots;
  if (
    slots.length !== targets.length ||
    slots.filter((slot) => slot.role === "POR").length !== 1
  )
    throw new ValidationError(
      "La fase debe conservar el equipo completo y un portero",
    );
  const players = slots.filter((slot) => slot.role !== "POR");
  const positions = targets.filter((slot) => slot.role !== "POR");
  const memo = new Map<number, { cost: number; choices: number[] }>();
  const assign = (mask: number): { cost: number; choices: number[] } => {
    if (memo.has(mask)) return memo.get(mask)!;
    const index = mask.toString(2).replace(/0/g, "").length;
    if (index === players.length) return { cost: 0, choices: [] };
    let best = { cost: Infinity, choices: [] as number[] };
    positions.forEach((position, destination) => {
      if (mask & (1 << destination)) return;
      const player = players[index];
      const rest = assign(mask | (1 << destination));
      const cost =
        rest.cost +
        (player.role === position.role ? 0 : 28) +
        Math.abs(player.x - position.x) * 0.8 +
        Math.abs(player.y - position.y);
      if (cost < best.cost)
        best = { cost, choices: [destination, ...rest.choices] };
    });
    memo.set(mask, best);
    return best;
  };
  const choices = assign(0).choices;
  const mapped = new Map(
    players.map((player, index) => [
      player.slotIndex,
      positions[choices[index]],
    ]),
  );
  const keeper = targets.find((slot) => slot.role === "POR")!;
  return slots.map((slot) => ({
    ...slot,
    ...(slot.role === "POR" ? keeper : mapped.get(slot.slotIndex)!),
    slotIndex: slot.slotIndex,
  }));
}
