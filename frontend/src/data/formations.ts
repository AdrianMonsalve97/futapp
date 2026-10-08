// Catálogo de formaciones POR FORMATO (docs/SPEC.md §12.2) + perfiles de
// formato (§12.1), espejo literal de `backend/src/domain/formats.ts` y
// `backend/src/domain/formations.ts`.
//
// Coordenadas en % de la cancha: y=0 es el arco DEL RIVAL (arriba) e y=100 el
// arco PROPIO (abajo); x=0 izquierda, x=100 derecha. El portero siempre y=93.

import type { FormatProfile, FormationDef, FormationSlot, TeamFormat } from '../types/api';

export type { FormationRole, FormationSlot, FormationDef, FormatProfile, TeamFormat } from '../types/api';

// ---------------------------------------------------------------------------
// §12.1 · Perfil de formato (fuente única de verdad)
// ---------------------------------------------------------------------------

export const FORMATS: Record<TeamFormat, FormatProfile> = {
  5: {
    format: 5, key: 'f5', name: 'Fútbol 5',
    playersOnPitch: 5, matchMinutes: 40,
    defaultFormation: '1-2-1', squadHint: '10-12',
    ai: { baselineFor: 7.0, baselineAgainst: 6.5, xgClampMax: 14, winProbK: 0.9, drawLogWeight: -1.05, homeBonus: 0.1, minSamples: 15 },
  },
  7: {
    format: 7, key: 'f7', name: 'Fútbol 7',
    playersOnPitch: 7, matchMinutes: 50,
    defaultFormation: '1-2-3-1', squadHint: '14-16',
    ai: { baselineFor: 6.0, baselineAgainst: 5.5, xgClampMax: 12, winProbK: 1.0, drawLogWeight: -0.69, homeBonus: 0.12, minSamples: 25 },
  },
  8: {
    format: 8, key: 'f8', name: 'Fútbol 8',
    playersOnPitch: 8, matchMinutes: 50,
    defaultFormation: '1-3-3-1', squadHint: '16-18',
    ai: { baselineFor: 5.0, baselineAgainst: 4.5, xgClampMax: 10, winProbK: 1.1, drawLogWeight: -0.51, homeBonus: 0.15, minSamples: 30 },
  },
  11: {
    format: 11, key: 'f11', name: 'Fútbol 11',
    playersOnPitch: 11, matchMinutes: 90,
    defaultFormation: '4-3-3', squadHint: '22-25',
    ai: { baselineFor: 1.45, baselineAgainst: 1.3, xgClampMax: 5, winProbK: 1.6, drawLogWeight: 0.1, homeBonus: 0.15, minSamples: 40 },
  },
};

export const FORMAT_LIST: FormatProfile[] = [FORMATS[5], FORMATS[7], FORMATS[8], FORMATS[11]];

/** Perfil de formato; fallback a f11 si el número no corresponde a ningún formato. */
export function getFormat(f: number): FormatProfile {
  const found = FORMATS[f as TeamFormat];
  return found ?? FORMATS[11];
}

// ---------------------------------------------------------------------------
// §12.2 · Catálogo de formaciones (14 en total: 3 + 3 + 3 + 5)
// ---------------------------------------------------------------------------

function slot(slotIndex: number, x: number, y: number, role: FormationSlot['role'], label: string): FormationSlot {
  return { slotIndex, x, y, role, label };
}

export const FORMATIONS: FormationDef[] = [
  // --- f5 · 5 slots --------------------------------------------------------
  { key: '1-2-1', name: '1-2-1', format: 5, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 30, 74, 'DEF', 'LI'),
    slot(2, 70, 74, 'DEF', 'LD'),
    slot(3, 50, 50, 'MED', 'MED'),
    slot(4, 50, 24, 'DEL', 'DC'),
  ]},
  { key: '1-1-2', name: '1-1-2', format: 5, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 50, 76, 'DEF', 'LIB'),
    slot(2, 50, 52, 'MED', 'MED'),
    slot(3, 34, 26, 'DEL', 'DC'),
    slot(4, 66, 26, 'DEL', 'DC'),
  ]},
  { key: '1-2-2', name: '1-2-2', format: 5, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 30, 75, 'DEF', 'LI'),
    slot(2, 70, 75, 'DEF', 'LD'),
    slot(3, 32, 26, 'DEL', 'DC'),
    slot(4, 68, 26, 'DEL', 'DC'),
  ]},
  // --- f7 · 7 slots --------------------------------------------------------
  { key: '1-2-3-1', name: '1-2-3-1', format: 7, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 30, 77, 'DEF', 'LI'),
    slot(2, 70, 77, 'DEF', 'LD'),
    slot(3, 20, 56, 'MED', 'MI'),
    slot(4, 50, 58, 'MED', 'MC'),
    slot(5, 80, 56, 'MED', 'MD'),
    slot(6, 50, 26, 'DEL', 'DC'),
  ]},
  { key: '1-3-2-1', name: '1-3-2-1', format: 7, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 24, 78, 'DEF', 'LI'),
    slot(2, 50, 80, 'DEF', 'DFC'),
    slot(3, 76, 78, 'DEF', 'LD'),
    slot(4, 34, 55, 'MED', 'MC'),
    slot(5, 66, 55, 'MED', 'MC'),
    slot(6, 50, 26, 'DEL', 'DC'),
  ]},
  { key: '1-2-2-2', name: '1-2-2-2', format: 7, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 30, 77, 'DEF', 'LI'),
    slot(2, 70, 77, 'DEF', 'LD'),
    slot(3, 30, 54, 'MED', 'MI'),
    slot(4, 70, 54, 'MED', 'MD'),
    slot(5, 34, 25, 'DEL', 'DC'),
    slot(6, 66, 25, 'DEL', 'DC'),
  ]},
  // --- f8 · 8 slots (formato de la demo) ----------------------------------
  { key: '1-3-3-1', name: '1-3-3-1', format: 8, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 26, 78, 'DEF', 'LI'),
    slot(2, 50, 80, 'DEF', 'DFC'),
    slot(3, 76, 78, 'DEF', 'LD'),
    slot(4, 22, 56, 'MED', 'MI'),
    slot(5, 50, 58, 'MED', 'MC'),
    slot(6, 78, 56, 'MED', 'MD'),
    slot(7, 50, 26, 'DEL', 'DC'),
  ]},
  { key: '1-2-3-2', name: '1-2-3-2', format: 8, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 32, 78, 'DEF', 'LI'),
    slot(2, 68, 78, 'DEF', 'LD'),
    slot(3, 22, 58, 'MED', 'MI'),
    slot(4, 50, 56, 'MED', 'MC'),
    slot(5, 78, 58, 'MED', 'MD'),
    slot(6, 36, 25, 'DEL', 'DC'),
    slot(7, 64, 25, 'DEL', 'DC'),
  ]},
  { key: '1-3-2-2', name: '1-3-2-2', format: 8, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 26, 78, 'DEF', 'LI'),
    slot(2, 50, 80, 'DEF', 'DFC'),
    slot(3, 76, 78, 'DEF', 'LD'),
    slot(4, 34, 56, 'MED', 'MC'),
    slot(5, 66, 56, 'MED', 'MC'),
    slot(6, 36, 25, 'DEL', 'DC'),
    slot(7, 64, 25, 'DEL', 'DC'),
  ]},
  // --- f11 · 11 slots (§6 sin cambios) ------------------------------------
  { key: '4-3-3', name: '4-3-3', format: 11, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 14, 74, 'DEF', 'LI'),
    slot(2, 37, 78, 'DEF', 'DFC'),
    slot(3, 63, 78, 'DEF', 'DFC'),
    slot(4, 86, 74, 'DEF', 'LD'),
    slot(5, 30, 56, 'MED', 'MC'),
    slot(6, 50, 62, 'MED', 'MC'),
    slot(7, 70, 56, 'MED', 'MCO'),
    slot(8, 16, 30, 'DEL', 'EI'),
    slot(9, 50, 24, 'DEL', 'DC'),
    slot(10, 84, 30, 'DEL', 'ED'),
  ]},
  { key: '4-4-2', name: '4-4-2', format: 11, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 14, 74, 'DEF', 'LI'),
    slot(2, 37, 78, 'DEF', 'DFC'),
    slot(3, 63, 78, 'DEF', 'DFC'),
    slot(4, 86, 74, 'DEF', 'LD'),
    slot(5, 14, 52, 'MED', 'MI'),
    slot(6, 38, 56, 'MED', 'MC'),
    slot(7, 62, 56, 'MED', 'MC'),
    slot(8, 86, 52, 'MED', 'MD'),
    slot(9, 38, 26, 'DEL', 'DC'),
    slot(10, 62, 26, 'DEL', 'DC'),
  ]},
  { key: '4-2-3-1', name: '4-2-3-1', format: 11, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 14, 74, 'DEF', 'LI'),
    slot(2, 37, 78, 'DEF', 'DFC'),
    slot(3, 63, 78, 'DEF', 'DFC'),
    slot(4, 86, 74, 'DEF', 'LD'),
    slot(5, 38, 62, 'MED', 'MCD'),
    slot(6, 62, 62, 'MED', 'MCD'),
    slot(7, 16, 38, 'MED', 'MI'),
    slot(8, 50, 40, 'MED', 'MCO'),
    slot(9, 84, 38, 'MED', 'MD'),
    slot(10, 50, 20, 'DEL', 'DC'),
  ]},
  { key: '3-5-2', name: '3-5-2', format: 11, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 26, 78, 'DEF', 'DFC'),
    slot(2, 50, 80, 'DEF', 'DFC'),
    slot(3, 74, 78, 'DEF', 'DFC'),
    slot(4, 10, 54, 'MED', 'MI'),
    slot(5, 34, 60, 'MED', 'MCD'),
    slot(6, 50, 50, 'MED', 'MC'),
    slot(7, 66, 60, 'MED', 'MCO'),
    slot(8, 90, 54, 'MED', 'MD'),
    slot(9, 38, 26, 'DEL', 'DC'),
    slot(10, 62, 26, 'DEL', 'DC'),
  ]},
  { key: '5-3-2', name: '5-3-2', format: 11, slots: [
    slot(0, 50, 93, 'POR', 'POR'),
    slot(1, 8, 70, 'DEF', 'LI'),
    slot(2, 29, 78, 'DEF', 'DFC'),
    slot(3, 50, 80, 'DEF', 'DFC'),
    slot(4, 71, 78, 'DEF', 'DFC'),
    slot(5, 92, 70, 'DEF', 'LD'),
    slot(6, 32, 56, 'MED', 'MC'),
    slot(7, 50, 60, 'MED', 'MC'),
    slot(8, 68, 56, 'MED', 'MC'),
    slot(9, 38, 26, 'DEL', 'DC'),
    slot(10, 62, 26, 'DEL', 'DC'),
  ]},
];

/** Keys de TODAS las formaciones del catálogo (14, sin duplicados). */
export const FORMATION_KEYS: string[] = FORMATIONS.map((formation) => formation.key);

/** Formaciones válidas dentro de un formato (p.ej. `formationsFor(8)` → 3). */
export function formationsFor(format: number): FormationDef[] {
  const profile = getFormat(format);
  return FORMATIONS.filter((formation) => formation.format === profile.format);
}

/**
 * Busca una formación por key; si se pasa `format`, solo acepta las de ese
 * formato. Fallback: la formación por defecto del formato buscado.
 */
export function getFormation(key: string, format?: number): FormationDef {
  const exact = FORMATIONS.find(
    (formation) => formation.key === key && (format === undefined || formation.format === getFormat(format).format),
  );
  if (exact) return exact;
  const byKey = FORMATIONS.find((formation) => formation.key === key);
  if (byKey && format === undefined) return byKey;
  const profile = getFormat(format ?? 11);
  return (
    FORMATIONS.find(
      (formation) => formation.format === profile.format && formation.key === profile.defaultFormation,
    ) ?? FORMATIONS[0]
  );
}

// ---------------------------------------------------------------------------
// Utilidades de presentación ligadas al formato
// ---------------------------------------------------------------------------

/** §12.1 — normalización de métricas: "por 90'" solo en f11, "por partido" en el resto. */
export function rateLabel(format: number): string {
  return getFormat(format).format === 11 ? "por 90'" : 'por partido';
}

/** Badge corto del formato, p.ej. `Fútbol 8 · 50'`. */
export function formatBadge(format: number, minutes?: number): string {
  const profile = getFormat(format);
  return `${profile.name} · ${minutes ?? profile.matchMinutes}'`;
}
