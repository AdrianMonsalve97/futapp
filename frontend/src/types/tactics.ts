export type {
  PhaseFormations,
  PitchPhase,
} from "../../../backend/src/domain/tactical-phases";
export type {
  CoachingSource,
  TacticalPlay,
  TacticalPlayCategory,
  TacticalStyle,
  TacticalPlan,
  CoachingResearch,
} from "../../../backend/src/domain/tactics";

export interface PitchSlot {
  refereePaymentPending?: boolean;
  slotIndex: number;
  x: number;
  y: number;
  role: "POR" | "DEF" | "MED" | "DEL";
  label: string;
  playerId?: number | null;
  playerName?: string | null;
  shirtNumber?: number | null;
  avatarUrl?: string | null;
  playerPosition?: PitchSlot["role"] | null;
  /** Resalta el slot (posición propia en vistas de jugador). */
  highlighted?: boolean;
}
