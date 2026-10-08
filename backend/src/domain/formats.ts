/**
 * Perfil de formato de juego (§12.1 del SPEC): fuente única de verdad de
 * fútbol 5 / 7 / 8 / 11. Define jugadores en cancha, duración del partido,
 * formación por defecto, plantel sugerido y todos los parámetros de IA
 * (recalibrados por formato).
 */

export type TeamFormat = 5 | 7 | 8 | 11;

/** Parámetros de IA del modelo recalibrados por formato (§12.1 y §12.5). */
export interface FormatAiProfile {
  /** Goles a favor base (`baselineFor`). */
  baselineFor: number;
  /** Goles en contra base (`baselineAgainst`). */
  baselineAgainst: number;
  /** Tope de goles proyectados (`xgClampMax`). */
  xgClampMax: number;
  /** k logística de la softmax de 3 vías (`winProbK`). */
  winProbK: number;
  /** Log-peso constante del empate (`drawLogWeight`). */
  drawLogWeight: number;
  /** Bonus de localía (`homeBonus`). */
  homeBonus: number;
  /** Muestras mínimas para entrenar en lugar de usar pesos por defecto (`minSamples`). */
  minSamples: number;
}

export interface FormatProfile {
  format: TeamFormat;
  key: 'f5' | 'f7' | 'f8' | 'f11';
  name: string;
  playersOnPitch: number;
  matchMinutes: number;
  defaultFormation: string;
  squadHint: string;
  ai: FormatAiProfile;
}

export const FORMATS: Record<TeamFormat, FormatProfile> = {
  5: {
    format: 5,
    key: 'f5',
    name: 'Fútbol 5',
    playersOnPitch: 5,
    matchMinutes: 40,
    defaultFormation: '1-2-1',
    squadHint: '10-12',
    ai: {
      baselineFor: 7.0,
      baselineAgainst: 6.5,
      xgClampMax: 14,
      winProbK: 0.9,
      drawLogWeight: -1.05,
      homeBonus: 0.1,
      minSamples: 15,
    },
  },
  7: {
    format: 7,
    key: 'f7',
    name: 'Fútbol 7',
    playersOnPitch: 7,
    matchMinutes: 50,
    defaultFormation: '1-2-3-1',
    squadHint: '14-16',
    ai: {
      baselineFor: 6.0,
      baselineAgainst: 5.5,
      xgClampMax: 12,
      winProbK: 1.0,
      drawLogWeight: -0.69,
      homeBonus: 0.12,
      minSamples: 25,
    },
  },
  8: {
    format: 8,
    key: 'f8',
    name: 'Fútbol 8',
    playersOnPitch: 8,
    matchMinutes: 50,
    defaultFormation: '1-3-3-1',
    squadHint: '16-18',
    ai: {
      baselineFor: 5.0,
      baselineAgainst: 4.5,
      xgClampMax: 10,
      winProbK: 1.1,
      drawLogWeight: -0.51,
      homeBonus: 0.15,
      minSamples: 30,
    },
  },
  11: {
    format: 11,
    key: 'f11',
    name: 'Fútbol 11',
    playersOnPitch: 11,
    matchMinutes: 90,
    defaultFormation: '4-3-3',
    squadHint: '22-25',
    ai: {
      baselineFor: 1.45,
      baselineAgainst: 1.3,
      xgClampMax: 5,
      winProbK: 1.6,
      drawLogWeight: 0.1,
      homeBonus: 0.15,
      minSamples: 40,
    },
  },
};

/** Catálogo completo de perfiles (f5 → f7 → f8 → f11). */
export const FORMAT_LIST: FormatProfile[] = [FORMATS[5], FORMATS[7], FORMATS[8], FORMATS[11]];

/** Formato por defecto de la demo/seed (§12: la demo arranca en fútbol 8). */
export const DEFAULT_FORMAT: TeamFormat = 8;

/** true si `value` es un formato soportado (5 | 7 | 8 | 11). */
export function isTeamFormat(value: number): value is TeamFormat {
  return value === 5 || value === 7 || value === 8 || value === 11;
}

/** Normaliza cualquier número a un formato soportado (fallback f11, §12.1). */
export function toTeamFormat(value: number | null | undefined): TeamFormat {
  return isTeamFormat(value ?? NaN) ? (value as TeamFormat) : 11;
}

/** Perfil del formato; si no existe, cae a f11 (§12.1). */
export function getFormat(f: number): FormatProfile {
  return isTeamFormat(f) ? FORMATS[f] : FORMATS[11];
}
