/**
 * Catálogo de formaciones POR FORMATO (§6 y §12.2 del SPEC).
 *
 * Coordenadas en % de la cancha: `y=0` es el arco del rival (arriba) e
 * `y=100` el arco propio (abajo); `x=0` izquierda, `x=100` derecha.
 * El portero siempre `y=93`. Las 5 formaciones de f11 de §6 no cambian.
 */
import { getFormat, type TeamFormat } from './formats';

export type FormationRole = 'POR' | 'DEF' | 'MED' | 'DEL';
export interface FormationSlot {
  slotIndex: number;
  x: number;
  y: number;
  role: FormationRole;
  label: string;
}
export interface FormationDef {
  key: string;
  name: string;
  format: TeamFormat;
  slots: FormationSlot[];
}

/* ------------------------------------------------------------------ */
/* f5 — 5 slots (default `1-2-1`)                                      */
/* ------------------------------------------------------------------ */
const F5_121: FormationDef = {
  key: '1-2-1',
  name: '1-2-1',
  format: 5,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 30, y: 74, role: 'DEF', label: 'LI' },
    { slotIndex: 2, x: 70, y: 74, role: 'DEF', label: 'LD' },
    { slotIndex: 3, x: 50, y: 50, role: 'MED', label: 'MED' },
    { slotIndex: 4, x: 50, y: 24, role: 'DEL', label: 'DC' },
  ],
};
const F5_112: FormationDef = {
  key: '1-1-2',
  name: '1-1-2',
  format: 5,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 50, y: 76, role: 'DEF', label: 'LIB' },
    { slotIndex: 2, x: 50, y: 52, role: 'MED', label: 'MED' },
    { slotIndex: 3, x: 34, y: 26, role: 'DEL', label: 'DC' },
    { slotIndex: 4, x: 66, y: 26, role: 'DEL', label: 'DC' },
  ],
};
const F5_122: FormationDef = {
  key: '1-2-2',
  name: '1-2-2',
  format: 5,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 30, y: 75, role: 'DEF', label: 'LI' },
    { slotIndex: 2, x: 70, y: 75, role: 'DEF', label: 'LD' },
    { slotIndex: 3, x: 32, y: 26, role: 'DEL', label: 'DC' },
    { slotIndex: 4, x: 68, y: 26, role: 'DEL', label: 'DC' },
  ],
};

/* ------------------------------------------------------------------ */
/* f7 — 7 slots (default `1-2-3-1`)                                    */
/* ------------------------------------------------------------------ */
const F7_1231: FormationDef = {
  key: '1-2-3-1',
  name: '1-2-3-1',
  format: 7,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 30, y: 77, role: 'DEF', label: 'LI' },
    { slotIndex: 2, x: 70, y: 77, role: 'DEF', label: 'LD' },
    { slotIndex: 3, x: 20, y: 56, role: 'MED', label: 'MI' },
    { slotIndex: 4, x: 50, y: 58, role: 'MED', label: 'MC' },
    { slotIndex: 5, x: 80, y: 56, role: 'MED', label: 'MD' },
    { slotIndex: 6, x: 50, y: 26, role: 'DEL', label: 'DC' },
  ],
};
const F7_1321: FormationDef = {
  key: '1-3-2-1',
  name: '1-3-2-1',
  format: 7,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 24, y: 78, role: 'DEF', label: 'LI' },
    { slotIndex: 2, x: 50, y: 80, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 76, y: 78, role: 'DEF', label: 'LD' },
    { slotIndex: 4, x: 34, y: 55, role: 'MED', label: 'MC' },
    { slotIndex: 5, x: 66, y: 55, role: 'MED', label: 'MC' },
    { slotIndex: 6, x: 50, y: 26, role: 'DEL', label: 'DC' },
  ],
};
const F7_1222: FormationDef = {
  key: '1-2-2-2',
  name: '1-2-2-2',
  format: 7,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 30, y: 77, role: 'DEF', label: 'LI' },
    { slotIndex: 2, x: 70, y: 77, role: 'DEF', label: 'LD' },
    { slotIndex: 3, x: 30, y: 54, role: 'MED', label: 'MI' },
    { slotIndex: 4, x: 70, y: 54, role: 'MED', label: 'MD' },
    { slotIndex: 5, x: 34, y: 25, role: 'DEL', label: 'DC' },
    { slotIndex: 6, x: 66, y: 25, role: 'DEL', label: 'DC' },
  ],
};

/* ------------------------------------------------------------------ */
/* f8 — 8 slots (default `1-3-3-1`) ← formato de la demo              */
/* ------------------------------------------------------------------ */
const F8_1331: FormationDef = {
  key: '1-3-3-1',
  name: '1-3-3-1',
  format: 8,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 26, y: 78, role: 'DEF', label: 'LI' },
    { slotIndex: 2, x: 50, y: 80, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 76, y: 78, role: 'DEF', label: 'LD' },
    { slotIndex: 4, x: 22, y: 56, role: 'MED', label: 'MI' },
    { slotIndex: 5, x: 50, y: 58, role: 'MED', label: 'MC' },
    { slotIndex: 6, x: 78, y: 56, role: 'MED', label: 'MD' },
    { slotIndex: 7, x: 50, y: 26, role: 'DEL', label: 'DC' },
  ],
};
const F8_1232: FormationDef = {
  key: '1-2-3-2',
  name: '1-2-3-2',
  format: 8,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 32, y: 78, role: 'DEF', label: 'LI' },
    { slotIndex: 2, x: 68, y: 78, role: 'DEF', label: 'LD' },
    { slotIndex: 3, x: 22, y: 58, role: 'MED', label: 'MI' },
    { slotIndex: 4, x: 50, y: 56, role: 'MED', label: 'MC' },
    { slotIndex: 5, x: 78, y: 58, role: 'MED', label: 'MD' },
    { slotIndex: 6, x: 36, y: 25, role: 'DEL', label: 'DC' },
    { slotIndex: 7, x: 64, y: 25, role: 'DEL', label: 'DC' },
  ],
};
const F8_1322: FormationDef = {
  key: '1-3-2-2',
  name: '1-3-2-2',
  format: 8,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 26, y: 78, role: 'DEF', label: 'LI' },
    { slotIndex: 2, x: 50, y: 80, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 76, y: 78, role: 'DEF', label: 'LD' },
    { slotIndex: 4, x: 34, y: 56, role: 'MED', label: 'MC' },
    { slotIndex: 5, x: 66, y: 56, role: 'MED', label: 'MC' },
    { slotIndex: 6, x: 36, y: 25, role: 'DEL', label: 'DC' },
    { slotIndex: 7, x: 64, y: 25, role: 'DEL', label: 'DC' },
  ],
};

/* ------------------------------------------------------------------ */
/* f11 — 11 slots (default `4-3-3`) — §6 sin cambios                  */
/* ------------------------------------------------------------------ */
const F11_433: FormationDef = {
  key: '4-3-3',
  name: '4-3-3',
  format: 11,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 14, y: 74, role: 'DEF', label: 'LI'  },
    { slotIndex: 2, x: 37, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 63, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 4, x: 86, y: 74, role: 'DEF', label: 'LD'  },
    { slotIndex: 5, x: 30, y: 56, role: 'MED', label: 'MC'  },
    { slotIndex: 6, x: 50, y: 62, role: 'MED', label: 'MC'  },
    { slotIndex: 7, x: 70, y: 56, role: 'MED', label: 'MCO' },
    { slotIndex: 8, x: 16, y: 30, role: 'DEL', label: 'EI'  },
    { slotIndex: 9, x: 50, y: 24, role: 'DEL', label: 'DC'  },
    { slotIndex: 10, x: 84, y: 30, role: 'DEL', label: 'ED'  },
  ],
};
const F11_442: FormationDef = {
  key: '4-4-2',
  name: '4-4-2',
  format: 11,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 14, y: 74, role: 'DEF', label: 'LI'  },
    { slotIndex: 2, x: 37, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 63, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 4, x: 86, y: 74, role: 'DEF', label: 'LD'  },
    { slotIndex: 5, x: 14, y: 52, role: 'MED', label: 'MI'  },
    { slotIndex: 6, x: 38, y: 56, role: 'MED', label: 'MC'  },
    { slotIndex: 7, x: 62, y: 56, role: 'MED', label: 'MC'  },
    { slotIndex: 8, x: 86, y: 52, role: 'MED', label: 'MD'  },
    { slotIndex: 9, x: 38, y: 26, role: 'DEL', label: 'DC'  },
    { slotIndex: 10, x: 62, y: 26, role: 'DEL', label: 'DC'  },
  ],
};
const F11_4231: FormationDef = {
  key: '4-2-3-1',
  name: '4-2-3-1',
  format: 11,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 14, y: 74, role: 'DEF', label: 'LI'  },
    { slotIndex: 2, x: 37, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 63, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 4, x: 86, y: 74, role: 'DEF', label: 'LD'  },
    { slotIndex: 5, x: 38, y: 62, role: 'MED', label: 'MCD' },
    { slotIndex: 6, x: 62, y: 62, role: 'MED', label: 'MCD' },
    { slotIndex: 7, x: 16, y: 38, role: 'MED', label: 'MI'  },
    { slotIndex: 8, x: 50, y: 40, role: 'MED', label: 'MCO' },
    { slotIndex: 9, x: 84, y: 38, role: 'MED', label: 'MD'  },
    { slotIndex: 10, x: 50, y: 20, role: 'DEL', label: 'DC'  },
  ],
};
const F11_352: FormationDef = {
  key: '3-5-2',
  name: '3-5-2',
  format: 11,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 26, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 2, x: 50, y: 80, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 74, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 4, x: 10, y: 54, role: 'MED', label: 'MI'  },
    { slotIndex: 5, x: 34, y: 60, role: 'MED', label: 'MCD' },
    { slotIndex: 6, x: 50, y: 50, role: 'MED', label: 'MC'  },
    { slotIndex: 7, x: 66, y: 60, role: 'MED', label: 'MCO' },
    { slotIndex: 8, x: 90, y: 54, role: 'MED', label: 'MD'  },
    { slotIndex: 9, x: 38, y: 26, role: 'DEL', label: 'DC'  },
    { slotIndex: 10, x: 62, y: 26, role: 'DEL', label: 'DC'  },
  ],
};
const F11_532: FormationDef = {
  key: '5-3-2',
  name: '5-3-2',
  format: 11,
  slots: [
    { slotIndex: 0, x: 50, y: 93, role: 'POR', label: 'POR' },
    { slotIndex: 1, x: 8,  y: 70, role: 'DEF', label: 'LI'  },
    { slotIndex: 2, x: 29, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 3, x: 50, y: 80, role: 'DEF', label: 'DFC' },
    { slotIndex: 4, x: 71, y: 78, role: 'DEF', label: 'DFC' },
    { slotIndex: 5, x: 92, y: 70, role: 'DEF', label: 'LD'  },
    { slotIndex: 6, x: 32, y: 56, role: 'MED', label: 'MC'  },
    { slotIndex: 7, x: 50, y: 60, role: 'MED', label: 'MC'  },
    { slotIndex: 8, x: 68, y: 56, role: 'MED', label: 'MC'  },
    { slotIndex: 9, x: 38, y: 26, role: 'DEL', label: 'DC'  },
    { slotIndex: 10, x: 62, y: 26, role: 'DEL', label: 'DC'  },
  ],
};

/** Catálogo completo: 3 f5 + 3 f7 + 3 f8 + 5 f11 = 14 formaciones (§12.2). */
export const FORMATIONS: Record<string, FormationDef> = {
  [F5_121.key]: F5_121,
  [F5_112.key]: F5_112,
  [F5_122.key]: F5_122,
  [F7_1231.key]: F7_1231,
  [F7_1321.key]: F7_1321,
  [F7_1222.key]: F7_1222,
  [F8_1331.key]: F8_1331,
  [F8_1232.key]: F8_1232,
  [F8_1322.key]: F8_1322,
  [F11_433.key]: F11_433,
  [F11_442.key]: F11_442,
  [F11_4231.key]: F11_4231,
  [F11_352.key]: F11_352,
  [F11_532.key]: F11_532,
};

/** Lista plana del catálogo completo (para `GET /api/formations`). */
export const FORMATION_LIST: FormationDef[] = Object.values(FORMATIONS);

/** Claves del catálogo completo (las 14). */
export const FORMATION_KEYS = Object.keys(FORMATIONS);

/** Formaciones disponibles para un formato (f5 → 3, f7 → 3, f8 → 3, f11 → 5). */
export function formationsFor(format: number): FormationDef[] {
  const profile = getFormat(format);
  return FORMATION_LIST.filter((formation) => formation.format === profile.format);
}

/** true si la clave existe y pertenece al formato indicado (§12.2). */
export function formationBelongsTo(key: string, format: number): boolean {
  const formation = FORMATIONS[key];
  return Boolean(formation) && formation.format === getFormat(format).format;
}

/**
 * Obtiene una formación (§12.2):
 * - sin `format`: la clave del catálogo, o `4-3-3` como fallback (§6).
 * - con `format`: la clave SOLO si pertenece al formato; en otro caso se
 *   cae a la formación por defecto del formato.
 */
export function getFormation(key: string, format?: number): FormationDef {
  const found = FORMATIONS[key];
  if (format === undefined) {
    return found ?? (FORMATIONS['4-3-3'] as FormationDef);
  }
  const profile = getFormat(format);
  if (found && found.format === profile.format) return found;
  return FORMATIONS[profile.defaultFormation] as FormationDef;
}
