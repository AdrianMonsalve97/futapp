import { getFormat } from "../../../backend/src/domain/formats";

// Pure catalog shared by selection, phase changes and persistence validation.
export {
  FORMATS,
  FORMAT_LIST,
  getFormat,
} from "../../../backend/src/domain/formats";
export {
  FORMATION_LIST as FORMATIONS,
  FORMATION_KEYS,
  formationsFor,
  getFormation,
} from "../../../backend/src/domain/formations";
export type {
  FormationRole,
  FormationSlot,
  FormationDef,
} from "../../../backend/src/domain/formations";
export type {
  FormatProfile,
  TeamFormat,
} from "../../../backend/src/domain/formats";

/** §12.1 — normalización de métricas: "por 90'" solo en f11, "por partido" en el resto. */
export function rateLabel(format: number): string {
  return getFormat(format).format === 11 ? "por 90'" : "por partido";
}

/** Badge corto del formato, p.ej. `Fútbol 8 · 50'`. */
export function formatBadge(format: number, minutes?: number): string {
  const profile = getFormat(format);
  return `${profile.name} · ${minutes ?? profile.matchMinutes}'`;
}
