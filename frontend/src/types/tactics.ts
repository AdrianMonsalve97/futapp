import type { PhaseFormations } from "../../../backend/src/domain/tactical-phases";
export type { PitchPhase, PhaseFormations } from "../../../backend/src/domain/tactical-phases";
import type {
  CoachingSource,
  TacticalPlay,
  TacticalStyle,
} from "../../../backend/src/domain/tactics";
export type {
  CoachingSource,
  TacticalPlay,
  TacticalPlayCategory,
  TacticalStyle,
} from "../../../backend/src/domain/tactics";
import type { LineupSlot, Position, TeamFormat } from "./api";
import type { LeagueContext } from "./tournament";


export interface TacticalPlan {
  match: { id: number; opponent: string; format: TeamFormat; minutes: number };
  style: TacticalStyle;
  recommendation: {
    phaseFormations: PhaseFormations;
    formation: string;
    lineup: LineupSlot[];
    explanation: string;
    bench: {
      playerId: number;
      playerName: string;
      position: string;
      predictedRating: number;
    }[];
    leagueContext?: LeagueContext;
  };
  formations: {
    key: string;
    score: number;
    avgRating: number;
    filled: number;
    naturalFit: number;
    slots: LineupSlot[];
  }[];
  positions: {
    role: Position;
    available: number;
    primary: number;
    needed: number;
    avgRating: number;
  }[];
  plays: TacticalPlay[];
  rotation: string;
  methodology: string;
}
export interface CoachingResearch {
  checkedAt: string;
  style: TacticalStyle;
  query: string;
  status: "consultado" | "parcial" | "no_disponible";
  sources: (CoachingSource & { verified: boolean })[];
}

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
