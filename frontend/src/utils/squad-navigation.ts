import type { Role } from "../types/api";

export type SquadView = "gallery" | "system" | "management";

export function squadView(
  value: string | null,
  role: Role | undefined,
): SquadView {
  if (value === "system") return "system";
  if (value === "management" && role === "admin") return "management";
  return "gallery";
}

/** Cambia un filtro sin perder el torneo ni la sección seleccionada. */
export function squadParams(
  current: URLSearchParams,
  key: "vista" | "torneo",
  value: string,
) {
  const next = new URLSearchParams(current);
  if (value) next.set(key, value);
  else next.delete(key);
  return next;
}
